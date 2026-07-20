import { NextRequest } from "next/server";
import { streamText, convertToModelMessages, createUIMessageStreamResponse } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { MessageRole, MessageType } from "@/lib/generated/prisma/enums";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/chat/[chatId]
//
// This is the streaming endpoint that `DefaultChatTransport` in the client
// calls every time the user sends a message or triggers a regeneration.
//
// Request body (sent by AI SDK v7 DefaultChatTransport):
//   {
//     messages: UIMessage[],       // full conversation history
//     chatId: string,              // our DB chat id (from the `body` option)
//     model: string,               // selected OpenRouter model id
//     skipUserMessage: boolean     // true during regenerate — don't re-save user msg
//   }
//
// Response: a UI-message stream that the client's useChat() hook consumes.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> },
) {
  // 1. Authenticate ────────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { chatId } = await params;

  // 2. Parse request ───────────────────────────────────────────────────────────
  const body = await req.json();
  const {
    messages,
    model,
    skipUserMessage = false,
  } = body as {
    messages: Parameters<typeof convertToModelMessages>[0];
    model: string;
    skipUserMessage: boolean;
  };

  if (!model) {
    return new Response(JSON.stringify({ error: "model is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. Verify chat belongs to the authenticated user ───────────────────────────
  const chat = await prisma.chat.findUnique({
    where: { id: chatId, userId: session.user.id },
  });

  if (!chat) {
    return new Response(JSON.stringify({ error: "Chat not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 4. Optionally persist the incoming user message ────────────────────────────
  // `skipUserMessage` is true when the client calls `regenerate()` — the user
  // message is already saved from the initial createChatWithMessage() call.
  if (!skipUserMessage) {
    const lastMessage = messages.at(-1);
    if (lastMessage?.role === "user") {
      const textPart = lastMessage.parts.find(
        (p: { type: string }) => p.type === "text",
      ) as { type: "text"; text: string } | undefined;

      if (textPart?.text) {
        // Update the chat's `updatedAt` and save the message in one transaction
        await prisma.$transaction([
          prisma.chat.update({
            where: { id: chatId },
            data: { updatedAt: new Date(), model },
          }),
          prisma.message.create({
            data: {
              chatId,
              content: textPart.text,
              model,
              messageRole: MessageRole.USER,
              messageType: MessageType.NORMAL,
            },
          }),
        ]);
      }
    }
  }

  // 5. Build the OpenRouter provider ───────────────────────────────────────────
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY!,
  });

  // 6. Convert UI messages → model messages ────────────────────────────────────
  // AI SDK v7: convertToModelMessages() takes the UIMessage[] array that the
  // client sends and converts it into the CoreMessage[] format that streamText()
  // expects. This handles multi-part messages, tool calls, etc. correctly.
  const modelMessages = await convertToModelMessages(messages);

  // 7. Stream the response ─────────────────────────────────────────────────────
  const result = streamText({
    model: openrouter(model),
    messages: modelMessages,
  });

  return createUIMessageStreamResponse({
    stream: result.toUIMessageStream({
      onFinish: async ({ responseMessage }) => {
        try {
          const parts = responseMessage.parts as Array<{ type: string; text?: string }>;
          const validParts = parts.filter(
            (p) => (p.type === "text" || p.type === "reasoning") && p.text,
          );

          const content =
            validParts.length === 1 && validParts[0].type === "text"
              ? validParts[0].text!
              : JSON.stringify(validParts);

          await prisma.message.create({
            data: {
              chatId,
              content,
              model,
              messageRole: MessageRole.ASSISTANT,
              messageType: MessageType.NORMAL,
            },
          });

          // Keep the chat's updatedAt fresh so the sidebar sorts correctly
          await prisma.chat.update({
            where: { id: chatId },
            data: { updatedAt: new Date() },
          });
        } catch (err) {
          console.error("[chat/route] Failed to persist assistant message:", err);
        }
      },
    }),
  });
}
