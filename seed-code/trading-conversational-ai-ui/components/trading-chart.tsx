'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  ColorType,
  CrosshairMode,
  CandlestickSeries, // Explicit import for safety
} from 'lightweight-charts';
import { useTheme } from 'next-themes';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Lock } from 'lucide-react';
import type { Symbol, Timeframe } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TradingChartProps {
  tier?: 'FREE' | 'PRO';
  symbol: Symbol;
  timeframe: Timeframe;
  onSymbolChange: (symbol: Symbol) => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
}

const SYMBOLS: Symbol[] = ['XAUUSD', 'BTCUSD', 'EURUSD', 'USDJPY', 'US30'];
const TIMEFRAMES: { value: Timeframe; label: string; locked?: boolean }[] = [
  { value: 'M5', label: 'M5', locked: true },
  { value: 'M15', label: 'M15', locked: true },
  { value: 'M30', label: 'M30', locked: true },
  { value: 'H1', label: 'H1' },
  { value: 'H2', label: 'H2', locked: true },
  { value: 'H4', label: 'H4' },
  { value: 'H8', label: 'H8', locked: true },
  { value: 'H12', label: 'H12', locked: true },
  { value: 'D1', label: 'D1' },
];

export default function TradingChart({
  tier = 'FREE',
  symbol,
  timeframe,
  onSymbolChange,
  onTimeframeChange,
}: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [isChartReady, setIsChartReady] = useState(false);
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

  const handleResize = useCallback(() => {
    if (chartContainerRef.current && chartRef.current) {
      chartRef.current.applyOptions({
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
      });
    }
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 1. Configure Colors based on Theme
    const backgroundColor = isDark ? '#171717' : '#ffffff';
    const textColor = isDark ? '#9ca3af' : '#374151';
    const gridColor = isDark ? '#262626' : '#e5e7eb';

    const chartOptions = {
      layout: {
        background: { type: ColorType.Solid, color: backgroundColor },
        textColor: textColor,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: gridColor,
      },
      timeScale: {
        borderColor: gridColor,
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    };

    // 2. Initialize Chart
    const chart = createChart(chartContainerRef.current, chartOptions);
    chartRef.current = chart;

    // 3. Add Series (Safe Mode)
    // This handles version differences in the library to prevent crashes
    let candlestickSeries;
    try {
      if (typeof chart.addCandlestickSeries === 'function') {
        candlestickSeries = chart.addCandlestickSeries({
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderVisible: false,
          wickUpColor: '#22c55e',
          wickDownColor: '#ef4444',
        });
      } else {
        candlestickSeries = chart.addSeries(CandlestickSeries, {
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderVisible: false,
          wickUpColor: '#22c55e',
          wickDownColor: '#ef4444',
        });
      }
    } catch (e) {
      console.error('Failed to add series:', e);
      return;
    }

    seriesRef.current = candlestickSeries;

    // 4. Set Initial Data
    const data = generateData(symbol === 'BTCUSD' ? 64000 : 2650);
    candlestickSeries.setData(data);

    window.addEventListener('resize', handleResize);
    setIsChartReady(true);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [isDark]); // Re-render when theme changes

  // Update Data on Symbol Change
  useEffect(() => {
    if (seriesRef.current) {
      const startPrice = symbol.includes('BTC')
        ? 64000
        : symbol.includes('JPY')
          ? 145
          : symbol.includes('EUR')
            ? 1.08
            : 2650;
      const data = generateData(startPrice);
      seriesRef.current.setData(data);
    }
  }, [symbol]);

  return (
    <div className="bg-background flex h-full flex-col">
      {/* Chart Toolbar */}
      <div className="bg-muted/20 flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <Select
            value={symbol}
            onValueChange={(val) => onSymbolChange(val as Symbol)}
          >
            <SelectTrigger className="bg-background w-[120px]">
              <SelectValue placeholder="Symbol" />
            </SelectTrigger>
            <SelectContent>
              {SYMBOLS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="bg-background flex items-center rounded-md border p-1">
            {TIMEFRAMES.map((tf) => (
              <Button
                key={tf.value}
                variant={timeframe === tf.value ? 'secondary' : 'ghost'}
                size="sm"
                className={cn(
                  'h-7 px-2 text-xs',
                  tf.locked && tier === 'FREE' && 'opacity-50'
                )}
                onClick={() => !tf.locked && onTimeframeChange(tf.value)}
                disabled={tf.locked && tier === 'FREE'}
              >
                {tf.label}
                {tf.locked && tier === 'FREE' && (
                  <Lock className="ml-1 h-3 w-3" />
                )}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8">
            <RefreshCw className="mr-2 h-3 w-3" />
            Auto-Refresh
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chart Area */}
        <div className="bg-card relative flex-1">
          <div ref={chartContainerRef} className="absolute inset-0" />
          {!isChartReady && (
            <div className="bg-background/50 absolute inset-0 flex items-center justify-center">
              <span className="text-muted-foreground text-sm">
                Loading Chart...
              </span>
            </div>
          )}
        </div>

        {/* Right Info Panel */}
        <div className="bg-muted/10 w-80 space-y-4 overflow-y-auto border-l p-4">
          <h3 className="mb-2 text-sm font-semibold">Technical Signals</h3>

          <Card className="bg-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-emerald-500">
                  Bullish Flag
                </CardTitle>
                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                  ACTIVE
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold">
                  {symbol.includes('BTC') ? '$64,230.50' : '$2,652.10'}
                </span>
                <span className="text-xs text-green-600">+0.18%</span>
              </div>
              <div className="text-muted-foreground mt-1 text-xs">
                Target: R2 | Stop: Swing Low
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-destructive text-sm font-medium">
                  Resistance (H4)
                </CardTitle>
                <span className="bg-destructive/10 text-destructive rounded px-1.5 py-0.5 text-[10px] font-medium">
                  NEAR
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold">
                  {symbol.includes('BTC') ? '$64,500.00' : '$2,655.00'}
                </span>
                <span className="text-muted-foreground text-xs">
                  Strong Rejection Zone
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// "Random Walk" Generator for Realistic Data
function generateData(startPrice = 64000) {
  const data = [];
  let time = Math.floor(Date.now() / 1000) - 24 * 60 * 60; // Start 24h ago
  let currentPrice = startPrice;

  for (let i = 0; i < 150; i++) {
    // Random Walk: The next price depends on the previous price (creates trends)
    const volatility = startPrice * 0.002; // 0.2% volatility per candle
    const change = (Math.random() - 0.5) * volatility;

    const close = currentPrice + change;
    // Generate realistic High/Low based on Open/Close
    const open = currentPrice;
    const high = Math.max(open, close) + Math.random() * (volatility * 0.5);
    const low = Math.min(open, close) - Math.random() * (volatility * 0.5);

    data.push({
      time: time + i * 15 * 60, // 15 min intervals
      open,
      high,
      low,
      close,
    });

    currentPrice = close;
  }
  return data;
}
