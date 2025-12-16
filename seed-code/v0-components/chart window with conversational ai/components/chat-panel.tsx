'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Bot, User, Paperclip, Mic, Sparkles } from 'lucide-react';
import type { Message, Symbol, Timeframe } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ChatPanelProps {
  symbol: Symbol;
  timeframe: Timeframe;
  onSymbolChange: (symbol: Symbol) => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
}

const MODELS = [
  { id: 'sonnet-3.5', name: 'Claude 3.5 Sonnet' },
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'gpt-5', name: 'GPT-5 (Preview)' },
];

export default function ChatPanel({
  symbol,
  timeframe,
  onSymbolChange,
  onTimeframeChange,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hello! I'm your technical analysis assistant. I can help you analyze the ${symbol} chart on the ${timeframe} timeframe. What would you like to know?`,
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('sonnet-3.5');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]'
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate AI processing and context awareness
    setTimeout(() => {
      let responseContent = '';
      const lowerInput = userMessage.content.toLowerCase();

      // Context-aware responses based on keywords
      if (lowerInput.includes('bitcoin') || lowerInput.includes('btc')) {
        onSymbolChange('BTCUSD');
        responseContent =
          "I've switched the chart to BTCUSD for you. Looking at the current price action, we're seeing some consolidation near the upper resistance levels.";
      } else if (lowerInput.includes('gold') || lowerInput.includes('xau')) {
        onSymbolChange('XAUUSD');
        responseContent =
          'Switching to Gold (XAUUSD). The chart shows a strong support level forming around 2646.59, as indicated by the B-B1 support line.';
      } else if (lowerInput.includes('daily') || lowerInput.includes('d1')) {
        onTimeframeChange('D1');
        responseContent =
          "I've updated the timeframe to Daily (D1). This gives us a better view of the long-term trend structure.";
      } else if (
        lowerInput.includes('support') ||
        lowerInput.includes('resistance')
      ) {
        responseContent = `On the ${symbol} ${timeframe} chart, we have a clear resistance zone at the P-P1 level ($2,656.79) and support at B-B1 ($2,646.59). The price is currently consolidating between these fractal boundaries.`;
      } else {
        responseContent = `I'm analyzing the ${symbol} chart on the ${timeframe} timeframe. The market structure suggests a potential breakout scenario if we can clear the immediate resistance. Would you like me to identify specific entry points?`;
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseContent,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full bg-white border-r">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="font-semibold">AI Analyst</span>
        </div>
        <Select value={selectedModel} onValueChange={setSelectedModel}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder="Select Model" />
          </SelectTrigger>
          <SelectContent>
            {MODELS.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-6 max-w-3xl mx-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-4',
                message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              <Avatar
                className={cn(
                  'w-8 h-8',
                  message.role === 'assistant' ? 'bg-primary/10' : 'bg-gray-100'
                )}
              >
                <AvatarFallback
                  className={
                    message.role === 'assistant'
                      ? 'text-primary'
                      : 'text-gray-600'
                  }
                >
                  {message.role === 'assistant' ? (
                    <Bot className="w-5 h-5" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </AvatarFallback>
              </Avatar>
              <div
                className={cn(
                  'rounded-2xl px-4 py-3 max-w-[85%] text-sm leading-relaxed',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-gray-100 text-gray-800'
                )}
              >
                {message.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4">
              <Avatar className="w-8 h-8 bg-primary/10">
                <AvatarFallback className="text-primary">
                  <Bot className="w-5 h-5" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-gray-100 rounded-2xl px-4 py-3 flex items-center gap-2">
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t bg-white">
        <div className="max-w-3xl mx-auto relative">
          <div className="absolute left-3 bottom-3 flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-gray-600"
            >
              <Paperclip className="w-5 h-5" />
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
            placeholder="Ask about the chart, indicators, or market structure..."
            className="w-full min-h-[50px] max-h-[200px] pl-12 pr-12 py-3 bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none text-sm"
            rows={1}
          />
          <div className="absolute right-3 bottom-2.5 flex gap-2">
            {input.trim() ? (
              <Button
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={handleSendMessage}
              >
                <Send className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-gray-600"
              >
                <Mic className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
        <div className="text-center mt-2">
          <p className="text-[10px] text-gray-400">
            AI can make mistakes. Please double-check responses.
          </p>
        </div>
      </div>
    </div>
  );
}
