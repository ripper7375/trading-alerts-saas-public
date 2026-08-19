import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Sparkles, TrendingUp, RefreshCw, Plus, Zap } from 'lucide-react';
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
import { PRO_ALLOWED_SYMBOLS, PRO_ALLOWED_TIMEFRAMES } from '@/lib/tier-config';
import { MobileTradingChart } from '@/components/charts/MobileTradingChart';
import { MobileChatDrawer } from '@/components/chat/MobileChatDrawer';
import { useNotifications } from '@/contexts/NotificationContext';
import { toast } from 'sonner';

export default function TerminalPage() {
  const navigate = useNavigate();
  const { playAlertChime, addAlert } = useNotifications();

  const [symbol, setSymbol] = useState<Symbol>('XAUUSD');
  const [timeframe, setTimeframe] = useState<Timeframe>('M15');
  const [currentPrice, setCurrentPrice] = useState(2642.8);
  const [priceChange, setPriceChange] = useState('+1.42%');

  // Realistic MT5 live tick simulator
  useEffect(() => {
    const base =
      symbol === 'BTCUSD'
        ? 96850
        : symbol === 'XAUUSD'
          ? 2642.8
          : symbol === 'US30'
            ? 43210
            : 1.0864;
    setCurrentPrice(base);

    const interval = setInterval(() => {
      setCurrentPrice((prev) => {
        const delta =
          (Math.random() - 0.48) *
          (symbol === 'BTCUSD'
            ? 28
            : symbol === 'XAUUSD'
              ? 0.35
              : symbol === 'US30'
                ? 12
                : 0.0002);
        return Number(
          (prev + delta).toFixed(
            symbol.includes('USD') &&
              !symbol.includes('XAU') &&
              !symbol.includes('BTC')
              ? 4
              : 2
          )
        );
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [symbol]);

  const handleArmQuickAlert = () => {
    const target = Number((currentPrice * 1.004).toFixed(2));
    addAlert({
      symbol,
      timeframe,
      condition: 'ABOVE',
      targetPrice: target,
      currentPrice,
      sound: 'chime_crystal',
      note: `M15 EDT Resistance armed from terminal`,
    });
    playAlertChime('breakout');
    toast.success(`Armed alert for ${symbol} at $${target}`);
  };

  return (
    <div className="relative flex h-full flex-1 flex-col overflow-hidden bg-background">
      {/* Top Symbol Selector & Timeframe Chips Bar */}
      <div className="z-10 flex items-center justify-between border-b border-border/80 bg-card/80 px-3 py-2 backdrop-blur-md">
        {/* Symbol Selector & Price */}
        <div className="flex items-center gap-2">
          <Select
            value={symbol}
            onValueChange={(val) => setSymbol(val as Symbol)}
          >
            <SelectTrigger className="h-8 w-28 border-border/80 bg-background text-xs font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRO_ALLOWED_SYMBOLS.map((s) => (
                <SelectItem key={s} value={s} className="text-xs font-bold">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex flex-col">
            <span className="font-mono text-xs font-black text-foreground">
              $
              {currentPrice.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </span>
            <span className="text-[10px] font-semibold text-emerald-500">
              {priceChange}
            </span>
          </div>
        </div>

        {/* Timeframe Chips */}
        <div className="no-scrollbar flex max-w-[180px] items-center gap-1 overflow-x-auto">
          {PRO_ALLOWED_TIMEFRAMES.slice(1, 7).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`rounded-lg px-2 py-1 text-[11px] font-bold transition-all ${
                timeframe === tf
                  ? 'shadow-xs bg-amber-500 text-slate-950'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Main Interactive Candlestick Chart Canvas */}
      <div className="relative flex flex-1 flex-col overflow-hidden bg-gradient-to-b from-card/30 to-background p-3">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-3xl border border-border/80 bg-card/80 shadow-inner">
          <MobileTradingChart
            symbol={symbol}
            timeframe={timeframe}
            currentPrice={currentPrice}
            showIndicators={true}
          />

          {/* Quick Action Bar at bottom of chart */}
          <div className="flex items-center justify-between border-t border-border/60 bg-card/90 p-3">
            <div className="flex items-center gap-2">
              <Badge variant="pro" className="px-2 py-0.5 text-[10px]">
                MT5 FRACTAL ENGINE
              </Badge>
              <span className="font-mono text-[10px] text-muted-foreground">
                Latency: 42ms
              </span>
            </div>

            <Button
              size="sm"
              onClick={handleArmQuickAlert}
              className="h-7 gap-1 bg-amber-500 text-xs font-bold text-slate-950 shadow-sm hover:bg-amber-400"
            >
              <Bell className="h-3 w-3" />
              <span>Arm Alert</span>
            </Button>
          </div>
        </div>

        {/* Floating Conversational AI Drawer Pill */}
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
