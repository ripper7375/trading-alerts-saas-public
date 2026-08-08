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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Brain,
  Lock,
  Sparkles,
  ChevronLeft,
  Zap,
  CornerDownLeft,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message, Symbol, Timeframe, Tier } from '@/lib/types';
import { PRO_TIER_CONFIG } from '@/lib/tier-config';

import { useLocale } from '@/lib/context/locale-context';

export const ANALYST_MODELS = [
  {
    id: 'gemini-3-6-flash',
    name: 'Gemini 3.6 Flash',
    isDefault: true,
    proOnly: false,
  },
  { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', proOnly: true },
  { id: 'gpt-5-6-terra', name: 'GPT 5.6 Terra', proOnly: true },
  { id: 'glm-5-2', name: 'GLM-5.2', proOnly: true },
  { id: 'kimi-k3', name: 'Kimi K3', proOnly: true },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', proOnly: true },
];

export default function ChatPanel({
  tier,
  symbol,
  timeframe,
  onCollapsePanel,
  onOpenUpgradeModal,
  predeterminedQuestion,
  onClearPredeterminedQuestion,
}: ChatPanelProps) {
  const { t } = useLocale();
  const [selectedModel, setSelectedModel] = useState('gemini-3-6-flash');
  const [tokensUsed, setTokensUsed] = useState(42500);
  const monthlyQuota = PRO_TIER_CONFIG.aiMonthlyTokenQuota; // 500,000

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      timestamp: Date.now() - 300000,
      content: `Hello! I'm analyzing **${symbol}** on **${timeframe}**. Market structure shows a bullish momentum retest at the lower EDT channel line ($2,634.50).`,
    },
    {
      id: '2',
      role: 'user',
      timestamp: Date.now() - 240000,
      content: `What is the current M5 SSA trend & EDT channel situation for XAUUSD?`,
    },
    {
      id: '3',
      role: 'assistant',
      timestamp: Date.now() - 180000,
      content: `Real-time XAUUSD Technical Assessment:\n\n- **M5 Structure**: Double bottom wick rejection at lower EDT channel boundary ($2,634.50).\n- **M15 SSA Slope**: Bullish trend alignment with Z-score candle expansion.\n- **Tactical Action**: Favorable BUY LIMIT entry at $2,634.50 targeting $2,648.00.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle predetermined questions triggered from the chart avatar button (C3/C5)
  useEffect(() => {
    if (predeterminedQuestion) {
      if (tier === 'FREE') {
        if (onOpenUpgradeModal) {
          onOpenUpgradeModal('Interactive AI Analyst Chart Query');
        }
        if (onClearPredeterminedQuestion) onClearPredeterminedQuestion();
        return;
      }

      const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: predeterminedQuestion,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsTyping(true);
      setTokensUsed((prev) => Math.min(prev + 1250, monthlyQuota));

      setTimeout(() => {
        setIsTyping(false);
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          timestamp: Date.now(),
          content: `Real-time XAUUSD Technical Assessment:\n\n- **M5 Structure**: Double bottom wick rejection at lower EDT channel boundary ($2,634.50).\n- **M15 SSA Slope**: Bullish trend alignment with Z-score candle expansion.\n- **Tactical Action**: Favorable BUY LIMIT entry at $2,634.50 targeting $2,648.00.`,
        };
        setMessages((prev) => [...prev, aiResponse]);
      }, 1000);

      if (onClearPredeterminedQuestion) onClearPredeterminedQuestion();
    }
  }, [predeterminedQuestion, tier]);

  const handleSendMessage = () => {
    if (!input.trim()) return;

    if (tier === 'FREE') {
      if (onOpenUpgradeModal) {
        onOpenUpgradeModal('Interactive AI Analyst');
      }
      return;
    }

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
      };
      setMessages((prev) => [...prev, aiResponse]);
    }, 1200);
  };

  const handleModelChange = (modelId: string) => {
    const targetModel = ANALYST_MODELS.find((m) => m.id === modelId);
    if (tier === 'FREE' && targetModel?.proOnly) {
      if (onOpenUpgradeModal) {
        onOpenUpgradeModal(`Multi-LLM Analyst (${targetModel.name})`);
      }
      return;
    }
    setSelectedModel(modelId);
  };

  const activeModelObj = ANALYST_MODELS.find((m) => m.id === selectedModel);

  return (
    <div className="relative flex h-full flex-col overflow-hidden border-r border-slate-800/80 bg-[#0b0d14] shadow-xl select-none">
      {/* B2: Panel Header — AI Chart Analyst */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800/80 bg-[#121622] px-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 shadow-xs ring-1 ring-amber-500/30">
            <Brain className="h-4 w-4" />
          </div>
          <div>
            <h2 className="flex items-center gap-1.5 text-xs font-extrabold tracking-tight text-slate-100">
              {t('AI Chart Analyst', 'นักวิเคราะห์กราฟ AI')}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Select value={selectedModel} onValueChange={handleModelChange}>
            <SelectTrigger className="border-slate-750 h-7 w-[165px] bg-[#090b10] text-xs font-semibold text-slate-200 focus:ring-amber-500/30">
              <SelectValue
                placeholder={t('Select AI Model', 'เลือกโมเดล AI')}
              />
            </SelectTrigger>
            <SelectContent className="border-slate-750 bg-[#121622]">
              {ANALYST_MODELS.map((model) => (
                <SelectItem
                  key={model.id}
                  value={model.id}
                  className="flex items-center justify-between text-xs focus:bg-amber-500/20 focus:text-amber-300"
                >
                  <span>{model.name}</span>
                  {tier === 'FREE' && model.proOnly && (
                    <Badge className="ml-1.5 h-3.5 border-amber-500/40 bg-amber-500/20 font-mono text-[8px] text-amber-300">
                      🔒 PRO
                    </Badge>
                  )}
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
              title={t('Collapse AI Analyst Panel')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* FREE Tier Read-Only Banner */}
      {tier === 'FREE' && (
        <div className="flex shrink-0 items-center justify-between border-b border-amber-500/30 bg-[#121017] px-3.5 py-2 text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-amber-400" />
            <span className="text-[11px] font-semibold">
              {t(
                'Read-Only Session History (FREE Tier) — Upgrade to PRO to resume interactive AI Chart Analysis.',
                'ประวัติเซสชันแบบอ่านอย่างเดียว (แพ็กเกจ FREE) — อัปเกรดเป็น PRO เพื่อกลับมาใช้การวิเคราะห์กราฟด้วย AI แบบโต้ตอบ'
              )}
            </span>
          </div>
          <Button
            size="sm"
            onClick={() =>
              onOpenUpgradeModal && onOpenUpgradeModal('AI Chart Analyst')
            }
            className="h-6 bg-amber-500 px-2 text-[10px] font-extrabold text-slate-950 hover:bg-amber-400"
          >
            {t('Upgrade', 'อัปเกรด')}
          </Button>
        </div>
      )}

      {/* Messages Scroll Area — Visible & Readable in both PRO and FREE tier */}
      <ScrollArea className="flex-1 p-3.5">
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

              <div className="flex max-w-[90%] flex-col gap-2">
                <div
                  className={cn(
                    'relative rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-md',
                    message.role === 'user'
                      ? 'rounded-tr-xs bg-amber-500 font-semibold text-slate-950'
                      : 'rounded-tl-xs border border-slate-800/90 bg-[#131724] text-slate-100 backdrop-blur-xs'
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="mb-1.5 flex items-center justify-between border-b border-slate-800/80 pb-1 text-[10px] font-extrabold tracking-wider text-amber-400 uppercase">
                      <span>
                        DAVINTRADE AI • {activeModelObj?.name.split(' ')[0]}
                      </span>
                      <span className="font-mono text-[9px] font-normal text-slate-400">
                        SUB-500MS QUAD-RAG
                      </span>
                    </div>
                  )}

                  <div className="whitespace-pre-wrap">
                    {t(message.content)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Avatar className="h-6 w-6 border border-amber-500/40">
                <AvatarImage src="/DavinTrade_Logo.jpg" />
              </Avatar>
              <span className="animate-pulse font-mono text-[11px] text-amber-300">
                {activeModelObj?.name.split(' ')[0]} is processing market
                analysis...
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* B3: Monthly Token Quota Bar */}
      <div className="shrink-0 border-t border-slate-800/60 bg-[#0e1018] px-3.5 py-1.5 text-[11px]">
        <div className="mb-1 flex items-center justify-between font-medium">
          <span className="flex items-center gap-1 text-slate-300">
            <Zap className="h-3 w-3 text-amber-400" />
            {t('chat.monthly_token_quota', 'Monthly Token Quota')}
          </span>
          <span className="font-mono text-[10px] font-bold text-amber-400">
            {tokensUsed.toLocaleString()} /{' '}
            {tier === 'PRO' ? monthlyQuota.toLocaleString() : '50,000'}
          </span>
        </div>
        <Progress
          value={(tokensUsed / (tier === 'PRO' ? monthlyQuota : 50000)) * 100}
          className="h-1.5 bg-slate-800"
        />
      </div>

      {/* B7: Input Box — Interactive in PRO Tier vs Locked Read-Only Banner in FREE Tier */}
      <div className="shrink-0 border-t border-slate-800/90 bg-[#0d0f17] p-3.5">
        {tier === 'PRO' ? (
          <div className="relative mx-auto max-w-2xl">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={`Ask ${activeModelObj?.name.split(' ')[0]}...`}
              className="border-slate-750 min-h-[58px] w-full resize-none rounded-xl border bg-[#07090f] py-3.5 pr-12 pl-4 text-sm text-slate-100 shadow-inner placeholder:text-base placeholder:font-medium placeholder:text-slate-500 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/30 focus:outline-none"
              rows={2}
            />
            <div className="absolute right-3 bottom-3.5 flex gap-1">
              <Button
                size="icon"
                disabled={!input.trim()}
                className="h-8 w-8 rounded-lg bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-30"
                onClick={handleSendMessage}
                title={t('Press ENTER to send')}
              >
                <CornerDownLeft className="h-4 w-4 stroke-[2.5]" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-center sm:flex-row sm:text-left">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0 text-amber-400" />
              <div>
                <div className="text-xs font-bold text-slate-100">
                  {t(
                    'Read-Only History (FREE Tier)',
                    'ประวัติแบบอ่านอย่างเดียว (แพ็กเกจ FREE)'
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  {t(
                    'Upgrade to PRO to ask new questions or continue this session.',
                    'อัปเกรดเป็น PRO เพื่อถามคำถามใหม่หรือใช้งานเซสชันนี้ต่อ'
                  )}
                </div>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() =>
                onOpenUpgradeModal &&
                onOpenUpgradeModal('Interactive AI Analyst')
              }
              className="shrink-0 bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5 fill-black" />
              {t('Upgrade to PRO', 'อัปเกรดเป็น PRO')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
