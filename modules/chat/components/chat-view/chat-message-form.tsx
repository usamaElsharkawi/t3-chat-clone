"use client";
import React, { useState, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { ModelSelector } from "./model-selector";
import { useGetAiModels } from "../../hooks/use-get-ai-models";

type ChatMessageFormProps = {
  initialMessage?: string;
  onMessageChange?: (message: string) => void;
};

export default function ChatMessageForm({ initialMessage = "", onMessageChange }: ChatMessageFormProps) {
  const { data: models, isPending } = useGetAiModels();
  const [message, setMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState(models?.[0]?.id);


  useEffect(()=>{
      if (initialMessage) {
      setMessage(initialMessage);
      onMessageChange?.("");
    }
  },[initialMessage, onMessageChange])

  

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-6">
      <form onSubmit={()=>{}} className="relative">
        {/* Main Input Container */}
        <div className="relative rounded-2xl border border-border shadow-sm   transition-all">
          {/* Textarea */}
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message here..."
            className="min-h-[60px] max-h-[200px] resize-none border-0 bg-transparent px-4 py-3 text-base focus-visible:ring-0 focus-visible:ring-offset-0 "
          />

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t ">
            {/* Left side tools */}
            <div className="flex items-center gap-1">
              {isPending ? (
                <>
                  <Spinner />
                </>
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
              type="submit"
              disabled={!message.trim()}
              size="sm"
              variant={message.trim() ? "default" : "ghost"}
              className="h-8 w-8 p-0 rounded-full "
              aria-label="Send message"
              title={
                message.trim() ? "Send message" : "Enter a message to enable"
              }
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Send message</span>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}