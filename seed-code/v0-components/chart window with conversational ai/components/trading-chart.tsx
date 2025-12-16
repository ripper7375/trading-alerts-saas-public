'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  createSeriesMarkers,
} from 'lightweight-charts';
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
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [nextUpdate, setNextUpdate] = useState<number>(
    tier === 'PRO' ? 30 : 60
  );
  const [isLoading, setIsLoading] = useState(false);

  // Generate mock data
  const generateMockData = useCallback(() => {
    const data = [];
    let time = Math.floor(Date.now() / 1000) - 100 * 3600; // 100 hours ago
    let price = symbol === 'BTCUSD' ? 65000 : symbol === 'XAUUSD' ? 2650 : 1.08;
    const volatility =
      symbol === 'BTCUSD' ? 100 : symbol === 'XAUUSD' ? 5 : 0.002;

    for (let i = 0; i < 120; i++) {
      const change = (Math.random() - 0.5) * volatility;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * (volatility * 0.5);
      const low = Math.min(open, close) - Math.random() * (volatility * 0.5);

      data.push({
        time: time as UTCTimestamp,
        open,
        high,
        low,
        close,
      });

      time += 3600; // 1 hour
      price = close;
    }

    return data;
  }, [symbol]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#f0f0f0',
      },
      rightPriceScale: {
        borderColor: '#f0f0f0',
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#059669',
      borderDownColor: '#dc2626',
      wickUpColor: '#059669',
      wickDownColor: '#dc2626',
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  // Update data when symbol/timeframe changes
  useEffect(() => {
    if (!candlestickSeriesRef.current || !chartRef.current) return;

    setIsLoading(true);
    const data = generateMockData();
    candlestickSeriesRef.current.setData(data);

    // Add custom fractal overlays
    const currentPrice = data[data.length - 1].close;
    const resistancePrice = currentPrice * 1.005;
    const supportPrice = currentPrice * 0.995;

    // Horizontal Resistance Line (P-P1)
    candlestickSeriesRef.current.createPriceLine({
      price: resistancePrice,
      color: '#ef4444',
      lineWidth: 2,
      lineStyle: 0, // solid
      axisLabelVisible: true,
      title: 'P-P1 Resistance',
    });

    // Horizontal Support Line (B-B1)
    candlestickSeriesRef.current.createPriceLine({
      price: supportPrice,
      color: '#10b981',
      lineWidth: 2,
      lineStyle: 0,
      axisLabelVisible: true,
      title: 'B-B1 Support',
    });

    // Current Price Line
    candlestickSeriesRef.current.createPriceLine({
      price: currentPrice,
      color: '#f59e0b',
      lineWidth: 1,
      lineStyle: 2, // dashed
      axisLabelVisible: true,
      title: 'Current',
    });

    createSeriesMarkers(candlestickSeriesRef.current, [
      {
        time: data[data.length - 20].time,
        position: 'aboveBar',
        color: '#ef4444',
        shape: 'arrowDown',
        text: 'Peak',
      },
      {
        time: data[data.length - 10].time,
        position: 'belowBar',
        color: '#10b981',
        shape: 'arrowUp',
        text: 'Bottom',
      },
    ]);

    chartRef.current.timeScale().fitContent();

    setLastUpdated(new Date());
    setIsLoading(false);
  }, [symbol, timeframe, generateMockData]);

  // Timer for "Next update"
  useEffect(() => {
    const interval = setInterval(() => {
      setNextUpdate((prev) => {
        if (prev <= 1) return tier === 'PRO' ? 30 : 60;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [tier]);

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      if (candlestickSeriesRef.current) {
        const data = generateMockData();
        candlestickSeriesRef.current.setData(data);
        setLastUpdated(new Date());
        setNextUpdate(tier === 'PRO' ? 30 : 60);
      }
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className="flex flex-col h-full gap-4 p-4 bg-gray-50/50">
      {/* Top Controls Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={symbol}
            onValueChange={(v) => onSymbolChange(v as Symbol)}
          >
            <SelectTrigger className="w-[140px]">
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

          <Select
            value={timeframe}
            onValueChange={(v) => onTimeframeChange(v as Timeframe)}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Timeframe" />
            </SelectTrigger>
            <SelectContent>
              {TIMEFRAMES.map((t) => (
                <SelectItem
                  key={t.value}
                  value={t.value}
                  disabled={tier === 'FREE' && t.locked}
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <span>{t.label}</span>
                    {tier === 'FREE' && t.locked && (
                      <Lock className="w-3 h-3 opacity-50" />
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </Button>
        </div>

        <div className="text-xs text-muted-foreground text-right">
          <div>
            Last updated:{' '}
            {Math.floor((new Date().getTime() - lastUpdated.getTime()) / 1000)}s
            ago
          </div>
          <div className="font-medium text-primary">
            Next update: {nextUpdate}s
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative flex-1 min-h-[400px] bg-white rounded-lg border shadow-sm overflow-hidden">
        <div ref={chartContainerRef} className="absolute inset-0" />
        {tier === 'FREE' && (
          <div className="absolute top-2 right-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full border border-yellow-200 flex items-center gap-1">
            <span>Updates every 60s</span>
          </div>
        )}
        {tier === 'PRO' && (
          <div className="absolute top-2 right-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full border border-blue-200 flex items-center gap-1">
            <span>⚡ 30s updates</span>
          </div>
        )}
      </div>

      {/* Bottom Info Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-500 flex items-center gap-2">
              Horizontal Resistance (P-P1)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold">
                {symbol === 'XAUUSD'
                  ? '$2,656.79'
                  : symbol === 'BTCUSD'
                    ? '$65,420.50'
                    : '1.0850'}
              </span>
              <span className="text-xs text-green-600">+$4.70 (+0.18%)</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              5 touches | 8.5° | 120 bars
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3 bg-transparent"
            >
              Create Alert
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-emerald-500">
                Horizontal Support (B-B1)
              </CardTitle>
              <span className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5 rounded font-medium">
                NEAR
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold">
                {symbol === 'XAUUSD'
                  ? '$2,646.59'
                  : symbol === 'BTCUSD'
                    ? '$64,850.20'
                    : '1.0780'}
              </span>
              <span className="text-xs text-red-600">-$5.50 (-0.21%)</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              4 touches | -1.2° | 100 bars
            </div>
            <Button
              size="sm"
              className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Create Alert
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
