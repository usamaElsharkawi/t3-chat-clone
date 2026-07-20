"use client";
import React, { useState, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { ModelSelector } from "./model-selector";
import { useGetAiModels } from "../../hooks/use-get-ai-models";
import { useCreateChat } from "../../hooks/use-chats";

type ChatMessageFormProps = {
  initialMessage?: string;
  onMessageChange?: (message: string) => void;
};

export default function ChatMessageForm({ initialMessage = "", onMessageChange }: ChatMessageFormProps) {
  const { data: models, isPending } = useGetAiModels();
  const [message, setMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined);

  // Sync selected model once models finish loading
  useEffect(() => {
    if (models?.length && !selectedModel) {
      setSelectedModel(models[0].id);
    }
  }, [models, selectedModel]);

  useEffect(()=>{
      if (initialMessage) {
      setMessage(initialMessage);
      onMessageChange?.("");
    }
  },[initialMessage, onMessageChange])

  const {mutateAsync,isPending:isCreatingChat} = useCreateChat();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!message.trim() || !selectedModel) return;
    
    try {
      await mutateAsync({ content: message, model: selectedModel });
      setMessage("");
    } catch (error) {
      console.error("Failed to create chat:", error);
      toast.error("Failed to create chat");
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <form onSubmit={handleSubmit} className="relative">
        {/* Main Input Container */}
        <div className={`
          relative rounded-2xl border transition-all duration-200
          ${message.trim() 
            ? "border-primary/30 shadow-lg shadow-primary/5" 
            : "border-border shadow-md hover:shadow-lg hover:border-border/80"
          }
        `}>
          {/* Textarea */}
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message the AI..."
            className="min-h-[60px] max-h-[200px] resize-none border-0 bg-transparent px-4 py-3.5 text-base focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (message.trim() && selectedModel && !isCreatingChat) {
                  handleSubmit(e as any);
                }
              }
            }}
          />

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-t border-border/50 bg-accent/20">
            {/* Left side tools */}
            <div className="flex items-center gap-1">
              {isPending ? (
                <div className="flex items-center gap-2 px-2">
                  <Spinner className="h-4 w-4" />
                  <span className="text-xs text-muted-foreground">Loading models...</span>
                </div>
              ) : (
                <ModelSelector
                  models={models}
                  selectedModelId={selectedModel}
                  onModelSelect={setSelectedModel}
                  className="ml-1"
                />
              )}
            </div>

            {/* Submit Button */}
            <Button
              disabled={isCreatingChat || isPending || !message.trim() || !selectedModel}
              type="submit"
              size="sm"
              className={`
                h-9 w-9 p-0 rounded-xl transition-all duration-200
                ${message.trim() && selectedModel
                  ? "bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg hover:scale-105" 
                  : "bg-muted text-muted-foreground cursor-not-allowed"
                }
              `}
              aria-label="Send message"
              title={
                !message.trim()
                  ? "Enter a message to enable"
                  : !selectedModel
                  ? "Select a model first"
                  : "Send message (Enter)"
              }
            >
              {isCreatingChat ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="sr-only">Send message</span>
            </Button>
          </div>
        </div>

        {/* Hint text */}
        <p className="text-xs text-muted-foreground/60 text-center mt-2">
          Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-xs">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-xs">Shift + Enter</kbd> for new line
        </p>
      </form>
    </div>
  );
}