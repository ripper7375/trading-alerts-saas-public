'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useSupportChat } from '@/components/chat-widget/chat-context';
import { Button } from '@/components/ui/button';
import {
  X,
  Minus,
  Send,
  Sparkles,
  Bot,
  Headphones,
  Maximize2,
  Paperclip,
} from 'lucide-react';
import { useLocale } from '@/lib/context/locale-context';

const topicOptions = [
  'Product Info',
  'Technical Support',
  'PRO Subscription',
  'Billing',
];

export function SupportChatWidget() {
  const {
    isOpen,
    isMinimized,
    messages,
    isTyping,
    activeTopic,
    closeChat,
    minimizeChat,
    sendMessage,
    setActiveTopic,
  } = useSupportChat();

  const { t, formatTimestamp } = useLocale();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isTyping, isOpen, isMinimized]);

  if (!isOpen) return null;

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  const handleTopicClick = (topic: string) => {
    setActiveTopic(topic);
    sendMessage(`I have a question regarding ${topic}.`, topic);
  };

  return (
    <div
      className={`fixed right-4 bottom-4 z-50 w-[92vw] rounded-2xl border border-slate-700/80 bg-[#0a0d16]/95 shadow-2xl shadow-black/90 backdrop-blur-2xl transition-all duration-300 sm:right-6 sm:w-[420px] ${
        isMinimized
          ? 'h-14 overflow-hidden'
          : 'flex h-[580px] flex-col justify-between'
      }`}
    >
      {/* Widget Header */}
      <div className="flex h-14 shrink-0 items-center justify-between rounded-t-2xl border-b border-slate-800 bg-[#0c101d] px-4">
        <div className="flex items-center space-x-3">
          <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-amber-500/40 bg-amber-500/10">
            <Image
              src="/davintrade-ai-icon.png"
              alt={t('Davin Support Mascot')}
              width={32}
              height={32}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center space-x-1.5 text-sm font-bold text-white">
              <span>{t('Support Centre')}</span>
              <span className="py-0.2 rounded bg-amber-500/20 px-1.5 text-[9px] font-bold text-amber-300">
                {t('AI SaaS')}
              </span>
            </div>
            <div className="flex items-center space-x-1 text-[10px] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />
              <span>{t('Online 24/7 • Sub-2min Response')}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={minimizeChat}
            className="h-7 w-7 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            {isMinimized ? (
              <Maximize2 className="h-3.5 w-3.5" />
            ) : (
              <Minus className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeChat}
            className="h-7 w-7 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Message History Feed (chat-feature-1.png) */}
          <div className="flex-1 scrollbar-thin scrollbar-thumb-slate-800 space-y-3 overflow-y-auto p-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div className="flex max-w-[85%] items-end space-x-2">
                  {msg.sender !== 'user' && (
                    <div className="mb-1 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-amber-500/30 bg-amber-500/20">
                      <Image
                        src="/davintrade-ai-icon.png"
                        alt={t('Davin Mascot')}
                        width={24}
                        height={24}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}

                  <div
                    className={`rounded-2xl px-3.5 py-2.5 font-sans text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'rounded-br-none bg-gradient-to-r from-amber-500 to-amber-600 font-medium text-slate-950 shadow-md shadow-amber-500/10'
                        : 'rounded-bl-none border border-slate-800 bg-[#121726] text-slate-200 shadow-sm'
                    }`}
                  >
                    {t(msg.text)}
                  </div>
                </div>

                <span className="mt-1 px-1 font-mono text-[10px] text-slate-400">
                  {formatTimestamp(msg.timestamp)}
                </span>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center space-x-2 font-mono text-xs text-amber-400/90 italic">
                <Sparkles className="h-3.5 w-3.5 animate-spin" />
                <span>{t('Davin Support AI is typing response...')}</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Topic Selector Chips */}
          <div className="no-scrollbar flex items-center space-x-1.5 overflow-x-auto border-t border-slate-800/80 bg-[#080b13] px-4 py-2">
            {topicOptions.map((topic) => (
              <button
                key={topic}
                onClick={() => handleTopicClick(topic)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-all ${
                  activeTopic === topic
                    ? 'border-amber-500/60 bg-amber-500/20 text-amber-300'
                    : 'border-slate-800 bg-[#0e121e] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {t(topic)}
              </button>
            ))}
          </div>

          {/* Input Box & Send Bar */}
          <div className="rounded-b-2xl border-t border-slate-800 bg-[#0c101d] p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center space-x-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('User type inquiry here...')}
                className="flex-1 rounded-xl border border-slate-800 bg-[#060810] px-3 py-2 text-xs font-medium text-white placeholder:text-slate-500 focus:border-amber-500/60 focus:outline-none"
              />
              <Button
                type="submit"
                disabled={!input.trim()}
                size="sm"
                className="h-9 bg-gradient-to-r from-amber-500 to-amber-600 px-3.5 font-bold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
