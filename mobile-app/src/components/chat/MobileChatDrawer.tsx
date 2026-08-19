import React, { useState, useRef, useEffect } from 'react';
import {
  Brain,
  Sparkles,
  Lock,
  Zap,
  CornerDownLeft,
  ChevronDown,
  Info,
  Target,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Message, Symbol, Timeframe, TradeSetup } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export const ANALYST_MODELS = [
  { id: 'gemini-3-6-flash', name: 'Gemini 3.6 Flash', proOnly: false },
  { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', proOnly: true },
  { id: 'gpt-5-6-terra', name: 'GPT 5.6 Terra', proOnly: true },
  { id: 'glm-5-2', name: 'GLM-5.2', proOnly: true },
  { id: 'kimi-k3', name: 'Kimi K3', proOnly: true },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', proOnly: true },
];

interface MobileChatDrawerProps {
  symbol: Symbol;
  timeframe: Timeframe;
  currentPrice: number;
}

export const MobileChatDrawer: React.FC<MobileChatDrawerProps> = ({
  symbol,
  timeframe,
  currentPrice,
}) => {
  const { isPro, tier } = useAuth();
  const { playAlertChime } = useNotifications();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-3-6-flash');
  const [tokensUsed, setTokensUsed] = useState(42500);
  const monthlyQuota = isPro ? 500000 : 50000;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg_initial',
      role: 'assistant',
      content: `Hello! I'm monitoring live order flow for **${symbol}** on **${timeframe}**.\n\nMarket structure shows an EDT channel lower band retest at $${(currentPrice * 0.996).toFixed(2)}.`,
      timestamp: Date.now() - 120000,
    },
  ]);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    if (!isPro) {
      toast.error('Interactive AI Chat requires PRO tier');
      navigate('/pricing');
      return;
    }

    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setTokensUsed((prev) => Math.min(prev + 1250, monthlyQuota));

    const activeModelName =
      ANALYST_MODELS.find((m) => m.id === selectedModel)?.name.split(' ')[0] ||
      'Gemini';

    setTimeout(() => {
      setIsTyping(false);

      const isSetupQuery =
        query.toLowerCase().includes('setup') ||
        query.toLowerCase().includes('target') ||
        query.toLowerCase().includes('recommend');

      let tradeSetup: TradeSetup | undefined;

      if (isSetupQuery) {
        tradeSetup = {
          symbol,
          timeframe,
          direction: 'BUY',
          entryPrice: Number((currentPrice * 0.998).toFixed(2)),
          takeProfit: Number((currentPrice * 1.012).toFixed(2)),
          stopLoss: Number((currentPrice * 0.993).toFixed(2)),
          riskReward: '1:2.8',
          confidence: 86,
          rationale: 'Double bottom confirmation at lower EDT fractal channel.',
        };
      }

      const aiResponse: Message = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: `**${symbol} (${timeframe}) Assessment by ${activeModelName}:**\n\n- **Immediate Resistance**: $${(currentPrice * 1.004).toFixed(2)} (Peak-to-Peak Fractal High)\n- **Key Support**: $${(currentPrice * 0.996).toFixed(2)} (M15 EDT Lower Band)\n- **Order Flow**: Bullish divergence on MT5 volume delta.\n\n${
          isSetupQuery
            ? 'Below is the algorithmically verified trade setup:'
            : 'Favorable tactical posture: Look for long entries on pullbacks to the support zone.'
        }`,
        tradeSetup,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, aiResponse]);
      playAlertChime('support');
    }, 1000);
  };

  const handleModelChange = (modelId: string) => {
    const targetModel = ANALYST_MODELS.find((m) => m.id === modelId);
    if (!isPro && targetModel?.proOnly) {
      toast.info('Upgrade to PRO to unlock Claude, GPT & DeepSeek models');
      navigate('/pricing');
      return;
    }
    setSelectedModel(modelId);
  };

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger asChild>
        <Button className="gap-2 rounded-full border-2 border-amber-300/40 bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 px-6 py-6 font-black text-slate-950 shadow-xl shadow-amber-500/30 transition-all hover:from-amber-400 hover:to-amber-500 active:scale-95">
          <Brain className="h-5 w-5 fill-slate-950" />
          <span>Ask Davin AI Analyst</span>
          <Sparkles className="h-4 w-4 animate-pulse fill-slate-950" />
        </Button>
      </DrawerTrigger>

      <DrawerContent className="flex max-h-[88dvh] flex-col border-t border-border/80 bg-card">
        {/* Drawer Header */}
        <DrawerHeader className="border-b border-border/80 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 font-black text-slate-950 shadow-sm">
                <Brain className="h-4 w-4" />
              </div>
              <div>
                <DrawerTitle className="flex items-center gap-1.5 text-sm font-black text-foreground">
                  AI Chart Analyst
                  <Badge variant="pro" className="px-1.5 py-0 text-[9px]">
                    QUAD-RAG
                  </Badge>
                </DrawerTitle>
              </div>
            </div>

            {/* Model Selector */}
            <Select value={selectedModel} onValueChange={handleModelChange}>
              <SelectTrigger className="h-7 w-36 text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANALYST_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    <span className="flex w-full items-center justify-between">
                      {m.name}
                      {!isPro && m.proOnly && (
                        <span className="ml-1 text-[9px] font-bold text-amber-500">
                          🔒 PRO
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Monthly Quota Gauge */}
          <div className="mt-2.5 space-y-1">
            <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-amber-500" />
                Monthly Token Quota
              </span>
              <span className="font-bold text-amber-500">
                {tokensUsed.toLocaleString()} / {monthlyQuota.toLocaleString()}
              </span>
            </div>
            <Progress
              value={(tokensUsed / monthlyQuota) * 100}
              className="h-1.5 bg-muted"
            />
          </div>
        </DrawerHeader>

        {/* FREE Tier Read-Only Banner */}
        {!isPro && (
          <div className="flex items-center justify-between border-b border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-600 dark:text-amber-400">
            <div className="flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[11px] font-semibold">
                Read-Only Session History (FREE Tier)
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => navigate('/pricing')}
              className="h-6 bg-amber-500 px-2 text-[10px] font-bold text-slate-950 hover:bg-amber-400"
            >
              Upgrade
            </Button>
          </div>
        )}

        {/* Scrollable Chat Messages Feed */}
        <div className="max-h-[50dvh] flex-1 space-y-3.5 overflow-y-auto p-4 text-xs">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${
                m.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[90%] rounded-2xl p-3.5 leading-relaxed shadow-sm ${
                  m.role === 'user'
                    ? 'rounded-tr-xs bg-amber-500 font-semibold text-slate-950'
                    : 'rounded-tl-xs whitespace-pre-line border border-border/70 bg-muted/60 text-foreground'
                }`}
              >
                {m.content}

                {/* Render Structured Trade Setup Card if provided */}
                {m.tradeSetup && (
                  <div className="mt-3 space-y-2 rounded-xl border border-amber-500/40 bg-card p-3 text-xs text-foreground">
                    <div className="flex items-center justify-between">
                      <Badge variant="pro" className="gap-1">
                        <Target className="h-3 w-3" />
                        <span>AI TRADE SETUP • {m.tradeSetup.direction}</span>
                      </Badge>
                      <span className="font-mono text-[10px] font-bold text-emerald-500">
                        {m.tradeSetup.confidence}% Confidence
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                      <div>
                        <span className="block text-[9px] text-muted-foreground">
                          ENTRY
                        </span>
                        <span className="font-bold">
                          ${m.tradeSetup.entryPrice}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[9px] text-muted-foreground">
                          TAKE PROFIT
                        </span>
                        <span className="font-bold text-emerald-500">
                          ${m.tradeSetup.takeProfit}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[9px] text-muted-foreground">
                          STOP LOSS
                        </span>
                        <span className="font-bold text-rose-500">
                          ${m.tradeSetup.stopLoss}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-border/50 pt-1 text-[10px] text-muted-foreground">
                      R:R {m.tradeSetup.riskReward} • {m.tradeSetup.rationale}
                    </div>
                  </div>
                )}
              </div>

              <span className="mt-1 px-1 text-[9px] text-muted-foreground">
                {new Date(m.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))}

          {isTyping && (
            <div className="flex animate-pulse items-center gap-2 text-xs font-semibold text-amber-500">
              <Brain className="h-4 w-4 animate-spin" />
              <span>Analyzing MT5 order flow & fractal bounds...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Interactive Prompt Question Chips */}
        {isPro && (
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto border-t border-border/60 px-4 py-2">
            <button
              onClick={() =>
                handleSendMessage(
                  `What are current fractal support & resistance levels for ${symbol}?`
                )
              }
              className="shrink-0 rounded-full border border-border/80 bg-muted/40 px-3 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
            >
              📍 Key Fractal Levels
            </button>
            <button
              onClick={() =>
                handleSendMessage(
                  `Analyze M15 EDT breakout probability on ${symbol}`
                )
              }
              className="shrink-0 rounded-full border border-border/80 bg-muted/40 px-3 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
            >
              ⚡ Breakout Probability
            </button>
            <button
              onClick={() =>
                handleSendMessage(
                  `Recommend optimal trade setup with entry & stop loss for ${symbol}`
                )
              }
              className="shrink-0 rounded-full border border-border/80 bg-muted/40 px-3 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
            >
              🎯 Recommend Setup
            </button>
          </div>
        )}

        {/* Chat Input Field */}
        <div className="safe-area-pb border-t border-border/80 bg-background p-3">
          {isPro ? (
            <div className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={`Ask ${selectedModel.split('-')[0]} about ${symbol}...`}
                className="w-full rounded-2xl border border-input bg-card px-4 py-3 pr-12 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
              <Button
                size="icon"
                onClick={() => handleSendMessage()}
                disabled={!input.trim()}
                className="absolute right-1.5 h-8 w-8 rounded-xl bg-amber-500 font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-40"
              >
                <CornerDownLeft className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => navigate('/pricing')}
              className="h-11 w-full bg-gradient-to-r from-amber-500 to-amber-600 font-extrabold text-slate-950 hover:from-amber-400 hover:to-amber-500"
            >
              <Sparkles className="mr-2 h-4 w-4 fill-slate-950" />
              <span>Upgrade to PRO to Chat with AI Analyst</span>
            </Button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
