import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain,
  Sparkles,
  Lock,
  Zap,
  TrendingUp,
  Info,
  Bell,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Symbol, Timeframe } from '@/lib/types';
import {
  FREE_ALLOWED_SYMBOLS,
  FREE_ALLOWED_TIMEFRAMES,
} from '@/lib/tier-config';
import { MobileTradingChart } from '@/components/charts/MobileTradingChart';
import { MobileChatDrawer } from '@/components/chat/MobileChatDrawer';

export default function FreeTerminalPage() {
  const navigate = useNavigate();
  const [symbol, setSymbol] = useState<Symbol>('XAUUSD');
  const [timeframe, setTimeframe] = useState<Timeframe>('H1');
  const [currentPrice] = useState(2642.8);

  return (
    <div className="relative flex h-full flex-1 flex-col overflow-hidden bg-background">
      {/* Free Tier Upgrade Banner */}
      <div className="z-10 flex items-center justify-between border-b border-amber-500/30 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400">
        <div className="flex items-center gap-1.5 text-[11px] font-bold">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>FREE Plan (5 Symbols / 3 TFs)</span>
        </div>
        <Button
          size="sm"
          onClick={() => navigate('/pricing')}
          className="h-6 bg-amber-500 px-2.5 text-[10px] font-extrabold text-slate-950 hover:bg-amber-400"
        >
          <Zap className="mr-1 h-3 w-3 fill-current" />
          Upgrade to PRO
        </Button>
      </div>

      {/* Top Chart Controls Bar */}
      <div className="z-10 flex items-center justify-between border-b border-border/80 bg-card/70 px-3 py-2">
        <div className="flex items-center gap-2">
          <Select
            value={symbol}
            onValueChange={(val) => setSymbol(val as Symbol)}
          >
            <SelectTrigger className="h-8 w-28 border-border/80 bg-background text-xs font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREE_ALLOWED_SYMBOLS.map((s) => (
                <SelectItem key={s} value={s} className="text-xs font-bold">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="font-mono text-xs font-bold text-foreground">
            $2,642.80
          </span>
        </div>

        <div className="flex items-center gap-1">
          {FREE_ALLOWED_TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                timeframe === tf
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/60 text-muted-foreground'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="relative flex flex-1 flex-col overflow-hidden bg-gradient-to-b from-card/30 to-background p-3">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-3xl border border-border/80 bg-card/80 shadow-inner">
          <MobileTradingChart
            symbol={symbol}
            timeframe={timeframe}
            currentPrice={currentPrice}
            showIndicators={false}
          />

          <div className="flex items-center justify-between border-t border-border/60 bg-card/90 p-3">
            <Badge variant="outline" className="text-[10px]">
              FREE DELAYED FEED
            </Badge>

            <Button
              size="sm"
              onClick={() => navigate('/pricing')}
              className="h-7 gap-1 bg-amber-500 text-xs font-bold text-slate-950 shadow-sm hover:bg-amber-400"
            >
              <Sparkles className="h-3 w-3" />
              <span>Unlock Real-Time Feed</span>
            </Button>
          </div>
        </div>

        {/* Sliding AI Drawer (Free Mode) */}
        <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center px-4">
          <MobileChatDrawer
            symbol={symbol}
            timeframe={timeframe}
            currentPrice={currentPrice}
          />
        </div>
      </div>
    </div>
  );
}
