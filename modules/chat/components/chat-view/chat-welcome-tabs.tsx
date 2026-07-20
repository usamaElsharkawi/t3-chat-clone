"use client";
import React, { useState } from "react";
import { CHAT_TAB_MESSAGE } from "../../constant";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowRight } from "lucide-react";

type ChatWelcomeTabsProps = {
  userName?: string | null;
  onMessageSelect: (message: string) => void;
};

const ChatWelcomeTabs = ({ userName = "friend", onMessageSelect }: ChatWelcomeTabsProps) => {
  const [activeTab, setActiveTab] = useState(0);
  const [hoveredMessage, setHoveredMessage] = useState<number | null>(null);
  
  const displayName = userName ?? "friend";
  const firstName = displayName.slice(0, displayName.indexOf(" ")) || displayName;
  
  return (
    <div className="flex flex-col items-center justify-center px-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="w-full max-w-3xl space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text">
            How can I help you,{" "}
            <span className="text-primary">{firstName}</span>?
          </h1>
          <p className="text-muted-foreground text-sm">
            Choose a category below or type your own message
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap gap-2 w-full">
          {CHAT_TAB_MESSAGE.map((tab, index) => (
            <Button
              key={tab.tabName}
              variant={activeTab === index ? "default" : "secondary"}
              onClick={() => setActiveTab(index)}
              className={`
                min-w-[120px] justify-start transition-all duration-300
                ${activeTab === index 
                  ? "shadow-md scale-105" 
                  : "hover:scale-102 hover:shadow-sm"
                }
              `}
            >
              <span className={`transition-transform duration-300 ${activeTab === index ? "scale-110" : ""}`}>
                {tab.icon}
              </span>
              <span className="ml-2">{tab.tabName}</span>
            </Button>
          ))}
        </div>

        {/* Messages */}
        <div className="space-y-2 w-full min-h-[240px]">
          {CHAT_TAB_MESSAGE[activeTab].messages.map((message, index) => (
            <div 
              key={message}
              className="animate-in fade-in slide-in-from-left duration-300"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <button
                onClick={() => onMessageSelect(message)}
                onMouseEnter={() => setHoveredMessage(index)}
                onMouseLeave={() => setHoveredMessage(null)}
                className={`
                  group w-full text-left px-4 py-3 rounded-xl
                  transition-all duration-200
                  hover:bg-accent/50 hover:shadow-sm hover:translate-x-1
                  border border-transparent hover:border-border/50
                `}
              >
                <div className="flex items-center justify-between">
                  <span className={`
                    text-sm transition-colors duration-200
                    ${hoveredMessage === index 
                      ? "text-foreground font-medium" 
                      : "text-muted-foreground"
                    }
                  `}>
                    {message}
                  </span>
                  <ArrowRight className={`
                    h-4 w-4 transition-all duration-200
                    ${hoveredMessage === index 
                      ? "opacity-100 translate-x-0 text-primary" 
                      : "opacity-0 -translate-x-2 text-muted-foreground"
                    }
                  `} />
                </div>
              </button>
              {index < CHAT_TAB_MESSAGE[activeTab].messages.length - 1 && (
                <Separator className="my-1" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChatWelcomeTabs;
