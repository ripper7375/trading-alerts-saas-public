'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
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
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Send,
  User,
  Paperclip,
  Brain,
  ArrowUp,
  Lock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Activity,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message, Symbol, Timeframe, Tier } from '@/lib/types';
import { PRO_TIER_CONFIG } from '@/lib/tier-config';

interface ChatPanelProps {
  tier: Tier;
  symbol: Symbol;
  timeframe: Timeframe;
  onSymbolChange: (symbol: Symbol) => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onCollapsePanel?: () => void;
  onOpenUpgradeModal?: (feature: string) => void;
}

export const ANALYST_MODELS = [
  { id: 'gemini-3-6-flash', name: 'Gemini 3.6 Flash (High)', isDefault: true },
  { id: 'claude-sonnet-5', name: 'Claude Sonnet 5' },
  { id: 'gpt-5-6-terra', name: 'GPT 5.6 Terra' },
  { id: 'glm-5-2', name: 'GLM-5.2' },
  { id: 'kimi-k3', name: 'Kimi K3' },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
];

export default function ChatPanel({
  tier,
  symbol,
  timeframe,
  onCollapsePanel,
  onOpenUpgradeModal,
}: ChatPanelProps) {
  const [selectedModel, setSelectedModel] = useState('gemini-3-6-flash');
  const [tokensUsed, setTokensUsed] = useState(42500);
  const monthlyQuota = PRO_TIER_CONFIG.aiMonthlyTokenQuota; // 500,000

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      timestamp: Date.now() - 300000,
      content: `Hello! I'm analyzing **${symbol}** on **${timeframe}**. Market structure shows a bullish momentum retest at the lower EDT channel line ($2,634.50).\n\nBelow is the quad-retrieved 3-panel Matplotlib vision analysis rendering for XAUUSD:`,
      chartThumbnail: '/mtf_render_xauusd_sample.png',
      tradeSetup: {
        symbol: 'XAUUSD',
        timeframe: 'M5',
        direction: 'BUY',
        entryPrice: 2634.5,
        takeProfit: 2648.0,
        stopLoss: 2627.0,
        riskReward: '1 : 3.2',
        confidence: 88,
        rationale:
          'Double bottom wick rejection at lower M5 EDT boundary aligned with M15 SSA bullish trend bias.',
      },
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!input.trim() || tier === 'FREE') return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTokensUsed((prev) => Math.min(prev + 1250, monthlyQuota));

    setTimeout(() => {
      setIsTyping(false);
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        timestamp: Date.now(),
        content: `I've evaluated the **${symbol}** M5/M15 order flow using VANNA SQL retrieval & txtai strategy rules.\n\n- **Immediate Resistance**: $2,648.10 (SSA Upper Limit)\n- **Key Support**: $2,634.50 (EDT Lower Channel Line)\n- **Structure**: M15 ZigZag Higher Low confirmed.\n\nRecommended tactical posture: Wait for price confirmation above $2,636.00 before executing buy limit.`,
        tradeSetup: {
          symbol: 'XAUUSD',
          timeframe: 'M5',
          direction: 'BUY',
          entryPrice: 2635.0,
          takeProfit: 2648.0,
          stopLoss: 2628.5,
          riskReward: '1 : 2.8',
          confidence: 84,
          rationale:
            'Confluence of lower EDT channel support & bullish M15 SSA slope.',
        },
      };
      setMessages((prev) => [...prev, aiResponse]);
    }, 1200);
  };

  const activeModelObj = ANALYST_MODELS.find((m) => m.id === selectedModel);

  return (
    <div className="relative flex h-full flex-col overflow-hidden border-r border-slate-800/80 bg-[#0c0d12] shadow-xl select-none">
      {/* Panel Header — Dark Slate Tone #131620 */}
      <div className="flex h-14 items-center justify-between border-b border-slate-800/80 bg-[#131620] px-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 shadow-xs ring-1 ring-amber-500/30">
            <Brain className="h-4 w-4" />
          </div>
          <div>
            <h2 className="flex items-center gap-1.5 text-xs font-bold tracking-tight text-slate-100">
              AI Analyst
              <span className="font-mono text-[10px] text-amber-400/80">
                (Stack D)
              </span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Select
            value={selectedModel}
            onValueChange={setSelectedModel}
            disabled={tier === 'FREE'}
          >
            <SelectTrigger className="border-slate-750 h-7 w-[170px] bg-[#090a0f] text-xs font-medium text-slate-200 focus:ring-amber-500/30">
              <SelectValue placeholder="Select AI Model" />
            </SelectTrigger>
            <SelectContent className="border-slate-750 bg-[#121520]">
              {ANALYST_MODELS.map((model) => (
                <SelectItem
                  key={model.id}
                  value={model.id}
                  className="text-xs focus:bg-amber-500/20 focus:text-amber-300"
                >
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {onCollapsePanel && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCollapsePanel}
              className="h-7 w-7 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              title="Collapse AI Analyst Panel"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Monthly Token Usage Bar (PRO ONLY) */}
      {tier === 'PRO' && (
        <div className="border-b border-slate-800/60 bg-[#10121a] px-3.5 py-1.5 text-[11px]">
          <div className="mb-1 flex items-center justify-between font-medium">
            <span className="flex items-center gap-1 text-slate-300">
              <Zap className="h-3 w-3 text-amber-400" />
              Monthly Token Quota
            </span>
            <span className="font-mono text-[10px] font-bold text-amber-400">
              {tokensUsed.toLocaleString()} / {monthlyQuota.toLocaleString()}
            </span>
          </div>
          <Progress
            value={(tokensUsed / monthlyQuota) * 100}
            className="h-1.5 bg-slate-800"
          />
        </div>
      )}

      {/* Messages Scroll Area */}
      <ScrollArea className="flex-1 p-3">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex w-full gap-2.5',
                message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              <Avatar className="h-7 w-7 shrink-0 border border-slate-700 shadow-xs">
                {message.role === 'assistant' ? (
                  <AvatarImage
                    src="/DavinTrade_Logo.jpg"
                    className="object-cover"
                  />
                ) : (
                  <AvatarFallback className="bg-slate-800 text-xs text-slate-300">
                    <User className="h-3.5 w-3.5" />
                  </AvatarFallback>
                )}
              </Avatar>

              <div className="flex max-w-[88%] flex-col gap-2">
                <div
                  className={cn(
                    'relative rounded-xl px-4 py-2.5 text-xs leading-relaxed shadow-md',
                    message.role === 'user'
                      ? 'rounded-tr-xs bg-amber-500 font-semibold text-slate-950'
                      : 'rounded-tl-xs border border-slate-800/90 bg-[#141722] text-slate-100 backdrop-blur-xs'
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="mb-1 flex items-center justify-between border-b border-slate-800/80 pb-1 text-[10px] font-bold tracking-wider text-amber-400 uppercase">
                      <span>
                        DAVINTRADE AI • {activeModelObj?.name.split(' ')[0]}
                      </span>
                      <span className="text-[9px] font-normal text-slate-400">
                        Sub-500ms Quad-RAG
                      </span>
                    </div>
                  )}

                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>

                {/* Multimodal 3-Panel Matplotlib PNG Chart Thumbnail */}
                {message.chartThumbnail && (
                  <div className="space-y-1 overflow-hidden rounded-lg border border-amber-500/40 bg-[#07080d] p-2 shadow-lg shadow-black/40">
                    <div className="flex items-center justify-between px-1 text-[10px] font-semibold text-amber-300">
                      <span>
                        Matplotlib 3-Panel Vision Render (Part 24 Engine 1)
                      </span>
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 bg-amber-500/10 px-1 py-0 text-[9px] text-amber-400"
                      >
                        PNG Artifact
                      </Badge>
                    </div>

                    <div className="relative flex h-32 w-full flex-col justify-between overflow-hidden rounded border border-blue-900/40 bg-[#0b0e17] p-2 shadow-inner">
                      <div className="flex items-center justify-between font-mono text-[10px] font-bold text-emerald-400">
                        <span>XAUUSD,M5 [SSA & EDT]</span>
                        <span>$2,634.50</span>
                      </div>
                      <svg className="h-20 w-full" viewBox="0 0 300 80">
                        <line
                          x1="0"
                          y1="20"
                          x2="300"
                          y2="10"
                          stroke="#eab308"
                          strokeWidth="1.5"
                          strokeDasharray="3,3"
                        />
                        <path
                          d="M 0 45 Q 75 35 150 40 T 300 25"
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="2"
                        />
                        <line
                          x1="0"
                          y1="70"
                          x2="300"
                          y2="55"
                          stroke="#eab308"
                          strokeWidth="1.5"
                        />
                        <line
                          x1="30"
                          y1="50"
                          x2="30"
                          y2="30"
                          stroke="#ef4444"
                          strokeWidth="1"
                        />
                        <rect
                          x="28"
                          y="35"
                          width="4"
                          height="10"
                          fill="#ef4444"
                        />
                        <line
                          x1="80"
                          y1="45"
                          x2="80"
                          y2="25"
                          stroke="#22c55e"
                          strokeWidth="1"
                        />
                        <rect
                          x="78"
                          y="28"
                          width="4"
                          height="12"
                          fill="#22c55e"
                        />
                        <line
                          x1="140"
                          y1="65"
                          x2="140"
                          y2="40"
                          stroke="#22c55e"
                          strokeWidth="1"
                        />
                        <rect
                          x="138"
                          y="45"
                          width="4"
                          height="15"
                          fill="#22c55e"
                        />
                        <circle cx="140" cy="62" r="3" fill="#22c55e" />
                      </svg>
                    </div>
                  </div>
                )}

                {/* Trade Setup Card */}
                {message.tradeSetup && (
                  <div className="space-y-2 rounded-lg border border-emerald-500/40 bg-[#091512] p-3 text-xs shadow-lg shadow-emerald-950/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                        <span className="text-[11px] font-bold tracking-wider text-emerald-400 uppercase">
                          Trade Setup Card
                        </span>
                      </div>
                      <Badge className="border border-emerald-500/50 bg-emerald-500/20 font-mono text-[10px] font-bold text-emerald-300">
                        {message.tradeSetup.direction} LIMIT @ $
                        {message.tradeSetup.entryPrice.toFixed(2)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 rounded border border-emerald-900/40 bg-[#060b09] p-2 font-mono text-[11px]">
                      <div>
                        <div className="text-[9px] text-slate-400">
                          Take Profit
                        </div>
                        <div className="font-bold text-emerald-400">
                          ${message.tradeSetup.takeProfit.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] text-slate-400">
                          Stop Loss
                        </div>
                        <div className="font-bold text-rose-400">
                          ${message.tradeSetup.stopLoss.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] text-slate-400">
                          Risk / Reward
                        </div>
                        <div className="font-bold text-amber-400">
                          {message.tradeSetup.riskReward}
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] leading-tight text-slate-300">
                      {message.tradeSetup.rationale}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Avatar className="h-6 w-6 border border-amber-500/40">
                <AvatarImage src="/DavinTrade_Logo.jpg" />
              </Avatar>
              <span className="animate-pulse font-mono text-[11px] text-amber-300">
                {activeModelObj?.name.split(' ')[0]} is generating vision
                analysis...
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-slate-800/80 bg-[#0e1017] p-3">
        <div className="relative mx-auto max-w-2xl">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={tier === 'FREE'}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={
              tier === 'PRO'
                ? `Ask ${activeModelObj?.name.split(' ')[0]} about XAUUSD chart structure...`
                : 'AI Analyst Chat is locked in FREE tier.'
            }
            className="border-slate-750 min-h-[44px] w-full resize-none rounded-xl border bg-[#07080d] py-2.5 pr-10 pl-3 text-xs text-slate-100 shadow-inner placeholder:text-slate-500 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/30 focus:outline-none disabled:opacity-40"
            rows={1}
          />
          <div className="absolute right-2.5 bottom-2 flex gap-1">
            <Button
              size="icon"
              disabled={tier === 'FREE' || !input.trim()}
              className="h-7 w-7 rounded-lg bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-30"
              onClick={handleSendMessage}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* FREE Tier Glassmorphism Blur Overlay Gate */}
      {tier === 'FREE' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#07080c]/85 p-6 text-center backdrop-blur-md">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 shadow-lg ring-1 shadow-amber-500/10 ring-amber-500/40">
            <Lock className="h-6 w-6" />
          </div>
          <Badge
            variant="outline"
            className="mb-2 border-amber-500/50 bg-amber-500/10 font-mono text-[10px] text-amber-400"
          >
            🔒 PRO Subscriber Feature
          </Badge>
          <h3 className="mb-1 text-base font-bold text-slate-100">
            AI Analyst Chat (Stack D)
          </h3>
          <p className="mb-4 max-w-xs text-xs leading-relaxed text-slate-400">
            AI Analyst Chat is exclusive to PRO subscribers. Upgrade to access
            real-time Gemini 3.6 multimodal chart vision, VANNA SQL quantitative
            queries, and trade setup cards.
          </p>
          <Button
            size="sm"
            onClick={() =>
              onOpenUpgradeModal &&
              onOpenUpgradeModal('Stack D: AI Analyst Chat')
            }
            className="bg-gradient-to-r from-amber-500 to-amber-600 font-bold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5 fill-black" />
            Upgrade to PRO
          </Button>
        </div>
      )}
    </div>
  );
}
