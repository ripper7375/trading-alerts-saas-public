'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image'; // Using Next.js Image for the logo
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Send,
  User,
  Paperclip,
  Mic,
  PanelLeftOpen,
  Brain,
  ArrowUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message, Symbol, Timeframe } from '@/lib/types';

interface ChatPanelProps {
  symbol: Symbol;
  timeframe: Timeframe;
  onSymbolChange: (symbol: Symbol) => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

const ANALYST_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o (Generalist)' },
  { id: 'claude-3-5', name: 'Claude 3.5 Sonnet (Deep Analysis)' },
  { id: 'llama-3', name: 'Llama 3 70B (Fast)' },
  { id: 'gemini-pro', name: 'Gemini 1.5 Pro (Context)' },
  { id: 'finbert', name: 'FinBERT (Sentiment Only)' },
];

export default function ChatPanel({
  symbol,
  timeframe,
  isSidebarCollapsed = false,
  onToggleSidebar,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      timestamp: Date.now(),
      content: `Hello! I'm analyzing **${symbol}** on the **${timeframe}** timeframe. Market structure appears bullish but approaching resistance. How can I help?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!input.trim()) return;
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, newMessage]);
    setInput('');

    // Simulate AI Response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          timestamp: Date.now(),
          content: `I've analyzed the chart for ${symbol}. RSI is diverging on the ${timeframe}. A short position might be viable if we break below the immediate support zone.`,
        },
      ]);
    }, 1200);
  };

  return (
    <div className="bg-background flex h-full flex-col border-r">
      {/* Header */}
      <div className="bg-muted/20 flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          {isSidebarCollapsed && onToggleSidebar && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSidebar}
              className="mr-1 h-8 w-8"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          )}
          {/* Header Logo */}
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 flex h-6 w-6 items-center justify-center rounded-sm">
              <Brain className="text-primary h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">AI Model</span>
          </div>
        </div>

        <Select value={selectedModel} onValueChange={setSelectedModel}>
          <SelectTrigger className="bg-background h-8 w-[200px] text-xs">
            <SelectValue placeholder="Select Model" />
          </SelectTrigger>
          <SelectContent>
            {ANALYST_MODELS.map((model) => (
              <SelectItem key={model.id} value={model.id} className="text-xs">
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex w-full gap-3',
                message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              {/* Avatar Logic */}
              <Avatar className="border-border/50 h-8 w-8 shrink-0 border shadow-sm">
                {message.role === 'assistant' ? (
                  // Use Logo for AI
                  <AvatarImage
                    src="/DavinTrade_Logo.jpg"
                    className="object-cover"
                  />
                ) : (
                  // Default User Icon for User
                  <AvatarFallback className="bg-muted text-muted-foreground">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                )}
              </Avatar>

              {/* Polished Chat Bubble */}
              <div
                className={cn(
                  'relative max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-muted/50 border-border/50 text-foreground rounded-tl-sm border'
                )}
              >
                {/* AI Label inside bubble */}
                {message.role === 'assistant' && (
                  <div className="text-primary/70 mb-1 text-[10px] font-bold tracking-wider uppercase">
                    DavinTrade AI
                  </div>
                )}

                <div className="markdown whitespace-pre-wrap">
                  {message.content}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="bg-background border-t p-4">
        <div className="relative mx-auto max-w-3xl">
          <div className="absolute bottom-2.5 left-3 flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground h-8 w-8"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={`Ask ${ANALYST_MODELS.find((m) => m.id === selectedModel)?.name.split(' ')[0]}...`}
            className="bg-muted/40 border-input focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground/60 min-h-[50px] w-full resize-none rounded-xl border py-3 pr-12 pl-12 text-sm shadow-inner focus:ring-2 focus:outline-none"
            rows={1}
          />
          <div className="absolute right-3 bottom-2.5 flex gap-1">
            {input.trim() ? (
              <Button
                size="icon"
                className="h-8 w-8 rounded-lg shadow-sm"
                onClick={handleSendMessage}
              >
                <Send className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground h-8 w-8"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="mt-2 text-center">
          <span className="text-muted-foreground/50 text-[10px]">
            AI can make mistakes. Review financial advice carefully.
          </span>
        </div>
      </div>
    </div>
  );
}
