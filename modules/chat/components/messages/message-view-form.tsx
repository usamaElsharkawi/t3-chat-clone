"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import React, { Fragment, useEffect, useRef, useState } from "react";
import { useGetChatById } from "../../hooks/use-chats";
import { useGetAiModels } from "../../hooks/use-get-ai-models";
import { Message, MessageContent } from "@/components/ui/message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { ModelSelector } from "../chat-view/model-selector";
import { toast } from "sonner";
import { Send, Square, Sparkles, BrainCircuit, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/ui/markdown";

type DBMessage = {
  id: string;
  content: string;
  messageRole: "USER" | "ASSISTANT";
  createdAt: string | Date;
};

// Minimal client-side view of a Chat — only the fields this component reads.
// Intentionally decoupled from the Prisma type the server action returns.
type ChatData = {
  id: string;
  model: string;
  messages?: DBMessage[] | null;
};

type MessagePartShape = {
  type: string;
  text?: string;
  [key: string]: unknown;
};

function parseMessageToUI(msg: DBMessage) {
  const basePart = { type: "text" as const, text: msg.content };
  const role = msg.messageRole.toLowerCase() as "user" | "assistant";

  try {
    const parts = JSON.parse(msg.content);
    return {
      id: msg.id,
      role,
      parts: Array.isArray(parts) ? parts : [basePart],
      createdAt: msg.createdAt,
    };
  } catch {
    return {
      id: msg.id,
      role,
      parts: [basePart],
      createdAt: msg.createdAt,
    };
  }
}

// ── Animated thinking dots ──────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="AI is thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
        />
      ))}
    </span>
  );
}

// ── Collapsible reasoning block ─────────────────────────────────────────────
function ReasoningBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="my-4 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-primary/5 transition-all duration-200 group"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 group-hover:bg-primary/15 transition-colors">
          <BrainCircuit className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-primary/90 block">
            Reasoning Process
          </span>
          <span className="text-xs text-muted-foreground">
            {open ? "Click to collapse" : "Click to expand"}
          </span>
        </div>
        <div className="shrink-0">
          {open ? (
            <ChevronUp className="h-4 w-4 text-primary/70 transition-transform" />
          ) : (
            <ChevronDown className="h-4 w-4 text-primary/70 transition-transform" />
          )}
        </div>
      </button>
      {open && (
        <div className="border-t border-primary/10 bg-background/50 px-4 py-4 animate-in slide-in-from-top-2 duration-200">
          <p className="text-sm leading-[1.7] text-muted-foreground whitespace-pre-wrap">
            {text}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Individual message part ─────────────────────────────────────────────────
function MessagePart({
  part,
  messageId,
  partIndex,
  role,
  timestamp,
}: {
  part: MessagePartShape;
  messageId: string;
  partIndex: number;
  role: UIMessage["role"];
  timestamp?: string | Date;
}) {
  const key = `${messageId}-${partIndex}`;
  const isUser = role === "user";

  // Format timestamp
  const getTimeString = () => {
    if (!timestamp) return "";
    const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (part.type === "text" && part.text) {
    if (isUser) {
      return (
        <Message align="end" key={key} className="px-4 py-1.5 animate-in fade-in slide-in-from-right-4 duration-300">
          <MessageContent>
            <div className="flex flex-col items-end gap-1 max-w-[85%]">
              <div className="rounded-2xl rounded-br-md bg-primary px-4 py-3 text-primary-foreground text-[15px] leading-relaxed shadow-md hover:shadow-lg transition-all group">
                <p className="whitespace-pre-wrap break-words">{part.text}</p>
              </div>
              {timestamp && (
                <span className="text-[11px] text-muted-foreground/60 px-2">
                  {getTimeString()}
                </span>
              )}
            </div>
          </MessageContent>
        </Message>
      );
    }

    // Assistant message — clean prose, no bubble
    return (
      <Message align="start" key={key} className="px-4 py-1.5 group animate-in fade-in slide-in-from-left-4 duration-300">
        {/* Avatar */}
        <div className="mt-1 h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-primary/10 to-primary/20 border border-primary/20 flex items-center justify-center transition-all group-hover:scale-110 group-hover:shadow-md">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <MessageContent>
          <div className="flex flex-col gap-1 max-w-[90%]">
            <div className="prose-content">
              <Markdown content={part.text} />
            </div>
            {timestamp && (
              <span className="text-[11px] text-muted-foreground/60 px-1">
                {getTimeString()}
              </span>
            )}
          </div>
        </MessageContent>
      </Message>
    );
  }

  if (part.type === "reasoning" && part.text) {
    return <ReasoningBlock key={key} text={part.text} />;
  }

  if (part.type === "step-start" && partIndex > 0) {
    return (
      <div key={key} className="my-4 px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>
    );
  }

  return null;
}

// ── Empty state ─────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center animate-in fade-in duration-500">
      <div className="text-center space-y-5 px-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 shadow-sm">
          <Sparkles className="h-8 w-8 text-primary animate-pulse" />
        </div>
        <div className="space-y-2">
          <p className="text-lg font-semibold tracking-tight">Start a conversation</p>
          <p className="text-sm text-muted-foreground max-w-md">
            Ask anything — your AI assistant is ready to help.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatView — the interactive chat. Rendered ONLY once `chat` exists, so it can
// call useChat() unconditionally on every render.
//
// WHY THIS SPLIT EXISTS (teaching):
// The previous version called useChat() (plus two useState / one useEffect)
// AFTER an early `return` for the loading/error states. That violated the
// Rules of Hooks: on the first render (still loading) only 5 hooks ran, but
// once data arrived 9 hooks ran. React requires the SAME hooks in the SAME
// order every render, so it throws "Rendered more hooks than during the
// previous render" — typically on a hard refresh / cold cache. The fix is to
// load data in the wrapper and only mount ChatView when the data is ready.
// ─────────────────────────────────────────────────────────────────────────────
function ChatView({ chat, autoTrigger }: { chat: ChatData; autoTrigger: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: modelsData, isPending: isModelsLoading } = useGetAiModels();

  const rawMessages = chat.messages ?? [];
  const initialMessages: UIMessage[] = rawMessages
    .filter((m: DBMessage) => m?.id && m?.content?.trim())
    .map(parseMessageToUI);

  const [selectedModel, setSelectedModel] = useState<string | null>(chat.model);

  // 🔑 AI SDK v7: useChat no longer accepts `api` / `streamMode` at the top
  // level. Those moved onto a *transport* — the strategy that knows how to talk
  // to your server. DefaultChatTransport is the built-in HTTP strategy and
  // streams UI Messages by default, so no `streamMode: "text"` is needed.
  //
  // Create the transport ONCE via a lazy useState so it is stable for the
  // component's lifetime. Recreating it each render is wasteful and could
  // reset the underlying chat session.
  const [transport] = useState(
    () => new DefaultChatTransport({ api: `/api/ai/chat/${chat.id}` }),
  );

  const { messages, status, error, sendMessage, regenerate, stop } = useChat({
    transport,
    // v7: the initial-message option is `messages` (not `initialMessages`).
    messages: initialMessages,
    onFinish() {
      console.log("Stream finished");
      // Invalidate the chat cache so next navigation shows fresh data from DB
      queryClient.invalidateQueries({ queryKey: ["chats", chat.id] });
      // Also invalidate the chat list to update titles/timestamps in sidebar
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
    onError() {
      toast.error("Chat error");
    },
  });

  const isBusy = status === "submitted" || status === "streaming";

  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  // Auto-trigger: when the create flow redirects here with ?autoTrigger=true,
  // regenerate the assistant reply for the single user message we already saved.
  const hasAutoTriggered = useRef(false);
  useEffect(() => {
    if (!autoTrigger) return;
    if (hasAutoTriggered.current) return;
    if (!selectedModel) return;
    if (messages.length === 0) return;
    if (messages.at(-1)?.role !== "user") return;

    hasAutoTriggered.current = true;

    regenerate({
      body: { chatId: chat.id, model: selectedModel, skipUserMessage: true },
    }).catch((err: Error) => {
      console.error("Auto-trigger failed:", err);
      toast.error("Failed to generate response");
    });

    const params = new URLSearchParams(window.location.search);
    params.delete("autoTrigger");
    const query = params.toString();
    router.replace(`/chat/${chat.id}${query ? `?${query}` : ""}`, {
      scroll: false,
    });
  }, [autoTrigger, selectedModel, messages, chat.id, regenerate, router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    if (!selectedModel) {
      toast.error("Please select a model first");
      return;
    }

    if (isBusy) return;

    try {
      // 🔑 AI SDK v7: the message is `{ text }` (role defaults to "user") — not a
      // bare string and not { role, content }. Extra per-request data
      // (chatId, model, skipUserMessage) goes in the 2nd arg as `body`.
      await sendMessage({ text }, {
        body: { chatId: chat.id, model: selectedModel, skipUserMessage: false },
      });
      setInput("");
    } catch (err) {
      console.error("Send message failed:", err);
      toast.error("Failed to send message");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-4xl mx-auto w-full">
      {/* ── Messages area ── */}
      <ScrollArea className="flex-1 min-h-0 scrollbar-thin">
        <div className="py-8 flex flex-col gap-0.5">
          {messages.length === 0 ? (
            <div className="h-[calc(100vh-16rem)]">
              <EmptyState />
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <Fragment key={message.id}>
                  {message.parts.map((part, i) => (
                    <MessagePart
                      key={`${message.id}-${i}`}
                      part={part as MessagePartShape}
                      messageId={message.id}
                      partIndex={i}
                      role={message.role}
                      timestamp={(message as any).createdAt}
                    />
                  ))}
                </Fragment>
              ))}

              {/* Streaming / submitted indicator */}
              {status === "submitted" && (
                <div className="flex items-center gap-3 px-4 py-3 animate-in fade-in duration-300">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-primary/10 to-primary/20 border border-primary/20 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <ThinkingDots />
                    <span className="text-[11px] text-muted-foreground/60">
                      Thinking...
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Error */}
          {error && (
            <div className="mx-4 mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3.5 text-sm text-destructive animate-in fade-in slide-in-from-top duration-300 shadow-sm">
              <div className="flex items-start gap-2">
                <svg className="h-5 w-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-medium">Error</p>
                  <p className="mt-1 text-sm">{error.message || "Something went wrong. Please try again."}</p>
                </div>
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* ── Input dock ── */}
      <div className="shrink-0 px-4 pb-5 pt-3 border-t border-border/50 bg-background/80 backdrop-blur-sm">
        <div
          className={cn(
            "rounded-2xl border bg-card transition-all duration-200",
            input.trim()
              ? "border-primary/30 shadow-lg shadow-primary/5"
              : "border-border shadow-md hover:shadow-lg hover:border-border/80",
            isBusy && "border-primary/20"
          )}
        >
          <form onSubmit={handleSubmit}>
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message the AI…"
              disabled={isBusy}
              rows={1}
              className={cn(
                "border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:border-transparent",
                "min-h-[56px] max-h-[200px] resize-none px-4 pt-4 pb-1 text-sm rounded-none rounded-t-2xl",
                "placeholder:text-muted-foreground/50"
              )}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
                }
              }}
            />

            {/* Bottom toolbar */}
            <div className="flex items-center justify-between px-3 pb-3 pt-1.5 border-t border-border/50 bg-accent/20">
              {/* Left: model selector */}
              <div className="flex items-center">
                {isModelsLoading ? (
                  <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                    <Spinner className="h-3.5 w-3.5" />
                    <span>Loading models…</span>
                  </div>
                ) : (
                  <ModelSelector
                    models={modelsData ?? []}
                    selectedModelId={selectedModel ?? undefined}
                    onModelSelect={(id) => setSelectedModel(id)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  />
                )}
              </div>

              {/* Right: action buttons */}
              <div className="flex items-center gap-2">
                {input.trim() && (
                  <span className="text-[10px] text-muted-foreground/60 tabular-nums px-1">
                    {input.trim().length}
                  </span>
                )}
                {isBusy ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={stop}
                    title="Stop generating"
                    className="h-9 w-9 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive transition-all hover:scale-105"
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={!input.trim() || !selectedModel}
                    size="icon"
                    title={
                      !input.trim()
                        ? "Enter a message"
                        : !selectedModel
                        ? "Select a model"
                        : "Send message (Enter)"
                    }
                    className={cn(
                      "h-9 w-9 rounded-xl transition-all duration-200",
                      input.trim() && selectedModel
                        ? "bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg hover:scale-105"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>

        <p className="mt-2.5 text-center text-[10px] text-muted-foreground/60">
          Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">Shift + Enter</kbd> for new line
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MessageViewWithForm — data-loading wrapper. Owns the loading / error /
// redirect states and only mounts ChatView once `chat` is guaranteed to exist.
// ─────────────────────────────────────────────────────────────────────────────
export function MessageViewWithForm({ chatId }: { chatId: string }) {
  const { data, isPending } = useGetChatById(chatId);
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoTrigger = searchParams.get("autoTrigger") === "true";

  if (isPending) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-6 w-6 text-primary" />
          <p className="text-sm text-muted-foreground">Loading chat…</p>
        </div>
      </div>
    );
  }

  if (!data?.success || !data?.data) {
    router.push("/");
    return null;
  }

  return <ChatView key={chatId} chat={data.data} autoTrigger={autoTrigger} />;
}

export default MessageViewWithForm;
