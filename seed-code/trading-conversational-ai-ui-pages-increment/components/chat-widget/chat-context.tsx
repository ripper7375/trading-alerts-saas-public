'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { chatSocketManager, ChatMessage } from '@/lib/socket-client';

interface SupportChatContextType {
  isOpen: boolean;
  isMinimized: boolean;
  messages: ChatMessage[];
  isTyping: boolean;
  activeTopic: string;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  minimizeChat: () => void;
  openChatWithMessage: (initialText: string, topic?: string) => void;
  sendMessage: (text: string, topic?: string) => void;
  setActiveTopic: (topic: string) => void;
}

const SupportChatContext = createContext<SupportChatContextType | undefined>(
  undefined
);

const initialWelcomeMessages: ChatMessage[] = [
  {
    id: 'welcome-1',
    sender: 'bot',
    text: 'Welcome to DavinTrade Support Centre! How can our AI Quantitative Team assist you today?',
    // Raw ISO timestamp — formatted for display at render time via
    // useLocale()'s formatTimestamp(), since this module-level array is
    // built outside any component and cannot call useLocale() itself.
    timestamp: new Date().toISOString(),
  },
];

export function SupportChatProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialWelcomeMessages
  );
  const [isTyping, setIsTyping] = useState(false);
  const [activeTopic, setActiveTopic] = useState('Product Info');

  useEffect(() => {
    chatSocketManager.initSocket((incomingMsg) => {
      setMessages((prev) => [...prev, incomingMsg]);
      setIsTyping(false);
    });
  }, []);

  const openChat = () => {
    setIsOpen(true);
    setIsMinimized(false);
  };

  const closeChat = () => {
    setIsOpen(false);
  };

  const toggleChat = () => {
    if (!isOpen) {
      setIsOpen(true);
      setIsMinimized(false);
    } else {
      setIsMinimized(!isMinimized);
    }
  };

  const minimizeChat = () => {
    setIsMinimized(!isMinimized);
  };

  const sendMessage = (text: string, topic?: string) => {
    if (!text.trim()) return;

    const userMsg = chatSocketManager.sendMessage(
      text,
      topic || activeTopic,
      (fallbackReply) => {
        setMessages((prev) => [...prev, fallbackReply]);
        setIsTyping(false);
      }
    );

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);
  };

  const openChatWithMessage = (initialText: string, topic?: string) => {
    setIsOpen(true);
    setIsMinimized(false);
    if (topic) setActiveTopic(topic);
    if (initialText.trim()) {
      sendMessage(initialText, topic);
    }
  };

  return (
    <SupportChatContext.Provider
      value={{
        isOpen,
        isMinimized,
        messages,
        isTyping,
        activeTopic,
        openChat,
        closeChat,
        toggleChat,
        minimizeChat,
        openChatWithMessage,
        sendMessage,
        setActiveTopic,
      }}
    >
      {children}
    </SupportChatContext.Provider>
  );
}

export function useSupportChat() {
  const context = useContext(SupportChatContext);
  if (!context) {
    throw new Error('useSupportChat must be used within a SupportChatProvider');
  }
  return context;
}
