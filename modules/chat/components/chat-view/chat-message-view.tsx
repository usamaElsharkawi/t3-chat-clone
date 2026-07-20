"use client"
import React, { useState } from 'react'
import ChatWelcomeTabs from './chat-welcome-tabs';
import ChatMessageForm from './chat-message-form';

type ChatMessageViewProps = {
  user?: {
    name?: string | null;
    image?: string | null;
  } | null;
};

const ChatMessageView = ({user}: ChatMessageViewProps) => {
    const [selectedMessage , setSelectedMessage] = useState("");

      const handleMessageSelect = (message: string) => {
    setSelectedMessage(message);
  };

  const handleMessageChange = () => {
    setSelectedMessage("");
  };


  return (
    <div className='flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] space-y-12 py-8'>
        <ChatWelcomeTabs
        userName={user?.name}
        onMessageSelect={handleMessageSelect}
        />

        <ChatMessageForm
           initialMessage={selectedMessage}
          onMessageChange={handleMessageChange}
        />
    </div>
  )
}

export default ChatMessageView