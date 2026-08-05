'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  LineSeries,
} from 'lightweight-charts';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Lock, Layers, Activity } from 'lucide-react';
import type { Symbol, Timeframe, Tier, M15ViewMode } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TradingChartProps {
  tier?: Tier;
  symbol: Symbol;
  timeframe: Timeframe;
  onSymbolChange: (symbol: Symbol) => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
  onOpenUpgradeModal?: (featureName: string) => void;
}

export default function TradingChart({
  tier = 'FREE',
  symbol,
  timeframe,
  onSymbolChange,
  onTimeframeChange,
  onOpenUpgradeModal,
}: TradingChartProps) {
  const containerM5Ref = useRef<HTMLDivElement>(null);
  const containerM15Ref = useRef<HTMLDivElement>(null);
  const chartM5Ref = useRef<IChartApi | null>(null);
  const chartM15Ref = useRef<IChartApi | null>(null);

  const seriesM5Ref = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const seriesM15Ref = useRef<ISeriesApi<'Candlestick'> | null>(null);

  // M15 Lower Chart View Mode: SSA/EDT vs ZigZag
  const [m15ViewMode, setM15ViewMode] = useState<M15ViewMode>('SSA_EDT');

  // Part 24 Engine 2 MTF Overlay Toggle: M5 on M15
  const [isM5OnM15, setIsM5OnM15] = useState(false);

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const handleResize = useCallback(() => {
    if (containerM5Ref.current && chartM5Ref.current) {
      chartM5Ref.current.applyOptions({
        width: containerM5Ref.current.clientWidth,
        height: containerM5Ref.current.clientHeight,
      });
    }
    if (containerM15Ref.current && chartM15Ref.current) {
      chartM15Ref.current.applyOptions({
        width: containerM15Ref.current.clientWidth,
        height: containerM15Ref.current.clientHeight,
      });
    }
  }, []);

  // Handle M5 on M15 Toggle
  const handleToggleM5OnM15 = (checked: boolean) => {
    if (tier === 'FREE') {
      if (onOpenUpgradeModal) {
        onOpenUpgradeModal('Part 24 Engine 2: MTF Overlay (M5 on M15)');
      }
      return;
    }
    setIsM5OnM15(checked);
  };

  // Initialize Charts with distinct shades & tones for M5 vs M15
  useEffect(() => {
    if (!containerM5Ref.current || !containerM15Ref.current) return;

    // --- Chart 1: M5 (Upper Chart) — Deep Navy-Blue Shade ---
    const bgM5 = isDark ? '#0b0e17' : '#ffffff';
    const gridM5 = isDark ? '#141a29' : '#e2e8f0';
    const textM5 = isDark ? '#94a3b8' : '#334155';

    const chartM5 = createChart(containerM5Ref.current, {
      layout: {
        background: { type: ColorType.Solid, color: bgM5 },
        textColor: textM5,
      },
      grid: {
        vertLines: { color: gridM5 },
        horzLines: { color: gridM5 },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: gridM5 },
      timeScale: {
        borderColor: gridM5,
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerM5Ref.current.clientWidth,
      height: containerM5Ref.current.clientHeight,
    });
    chartM5Ref.current = chartM5;

    const candlestickM5 = chartM5.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });
    seriesM5Ref.current = candlestickM5;

    const dataM5 = generateCandleData(2635, 120, 5);
    candlestickM5.setData(dataM5);

    // M5 SSA Line (Blue)
    const ssaM5 = chartM5.addSeries(LineSeries, {
      color: '#3b82f6',
      lineWidth: 2,
    });
    ssaM5.setData(generateLineData(dataM5, 0));

    // M5 Upper EDT Line (Gold)
    const upperEdtM5 = chartM5.addSeries(LineSeries, {
      color: '#eab308',
      lineWidth: 1.5,
    });
    upperEdtM5.setData(generateLineData(dataM5, 12));

    // M5 Lower EDT Line (Gold)
    const lowerEdtM5 = chartM5.addSeries(LineSeries, {
      color: '#eab308',
      lineWidth: 1.5,
    });
    lowerEdtM5.setData(generateLineData(dataM5, -12));

    // --- Chart 2: M15 (Lower Chart) — Deep Amethyst-Slate Shade ---
    const bgM15 = isDark ? '#110d18' : '#f8fafc';
    const gridM15 = isDark ? '#1d172a' : '#cbd5e1';
    const textM15 = isDark ? '#a78bfa' : '#475569';

    const chartM15 = createChart(containerM15Ref.current, {
      layout: {
        background: { type: ColorType.Solid, color: bgM15 },
        textColor: textM15,
      },
      grid: {
        vertLines: { color: gridM15 },
        horzLines: { color: gridM15 },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: gridM15 },
      timeScale: {
        borderColor: gridM15,
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerM15Ref.current.clientWidth,
      height: containerM15Ref.current.clientHeight,
    });
    chartM15Ref.current = chartM15;

    const candlestickM15 = chartM15.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });
    seriesM15Ref.current = candlestickM15;

    const dataM15 = generateCandleData(2635, 80, 15);
    candlestickM15.setData(dataM15);

    if (m15ViewMode === 'SSA_EDT') {
      const ssaM15 = chartM15.addSeries(LineSeries, {
        color: '#6366f1',
        lineWidth: 2,
      });
      ssaM15.setData(generateLineData(dataM15, 0));

      const upperEdtM15 = chartM15.addSeries(LineSeries, {
        color: '#f59e0b',
        lineWidth: 1.5,
      });
      upperEdtM15.setData(generateLineData(dataM15, 18));

      const lowerEdtM15 = chartM15.addSeries(LineSeries, {
        color: '#f59e0b',
        lineWidth: 1.5,
      });
      lowerEdtM15.setData(generateLineData(dataM15, -18));
    } else {
      const zigzag = chartM15.addSeries(LineSeries, {
        color: '#c084fc',
        lineWidth: 2,
      });
      zigzag.setData(generateZigZagData(dataM15));
    }

    // Overlay M5 EDT onto M15 Chart Canvas when isM5OnM15 is enabled in PRO mode
    if (isM5OnM15 && tier === 'PRO') {
      const m5OverlaidUpper = chartM15.addSeries(LineSeries, {
        color: '#06b6d4', // Cyan for overlaid M5 EDT on M15
        lineWidth: 2,
        lineStyle: 2, // Dashed
      });
      m5OverlaidUpper.setData(generateLineData(dataM15, 10));

      const m5OverlaidLower = chartM15.addSeries(LineSeries, {
        color: '#06b6d4',
        lineWidth: 2,
        lineStyle: 2,
      });
      m5OverlaidLower.setData(generateLineData(dataM15, -10));
    }

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartM5.remove();
      chartM15.remove();
    };
  }, [isDark, m15ViewMode, isM5OnM15, tier]);

  return (
    <div className="relative flex h-full flex-col overflow-hidden border-x border-slate-800/80 bg-[#07090e] shadow-2xl select-none">
      {/* Top Header Toolbar with Sleek Charcoal Slate Background */}
      <div className="flex h-14 flex-wrap items-center justify-between gap-2 border-b border-slate-800/90 bg-[#121622] px-3.5 shadow-xs">
        {/* Symbol Indicator */}
        <div className="flex items-center gap-2">
          <Badge className="border-amber-500/40 bg-amber-500/15 px-3 py-1 font-mono text-xs text-amber-400 shadow-xs">
            XAUUSD
          </Badge>

          {/* M15 View Preset Selector Buttons */}
          <div className="border-slate-750 flex items-center gap-1 rounded-lg border bg-[#0a0d14] p-1 shadow-inner">
            <Button
              variant={m15ViewMode === 'SSA_EDT' ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'h-7 px-3 text-xs font-semibold transition-all',
                m15ViewMode === 'SSA_EDT' &&
                  'border border-indigo-500/50 bg-indigo-600/30 font-bold text-indigo-300 shadow-sm shadow-indigo-500/20'
              )}
              onClick={() => setM15ViewMode('SSA_EDT')}
            >
              <Activity className="mr-1.5 h-3.5 w-3.5 text-indigo-400" />
              M15 SSA & EDT Chart
            </Button>

            <Button
              variant={m15ViewMode === 'ZIGZAG' ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'h-7 px-3 text-xs font-semibold transition-all',
                m15ViewMode === 'ZIGZAG' &&
                  'border border-purple-500/50 bg-purple-600/30 font-bold text-purple-300 shadow-sm shadow-purple-500/20'
              )}
              onClick={() => setM15ViewMode('ZIGZAG')}
            >
              <Layers className="mr-1.5 h-3.5 w-3.5 text-purple-400" />
              M15 ZigZag Chart
            </Button>
          </div>
        </div>

        {/* Part 24 Engine 2: MTF Overlay Toggle [ M5 on M15 ] */}
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-1 text-xs shadow-xs transition-all',
              isM5OnM15 && tier === 'PRO'
                ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-200 shadow-cyan-500/10'
                : 'border-slate-800 bg-[#0a0d14] text-slate-400'
            )}
          >
            <Switch
              id="m5-on-m15-toggle"
              checked={isM5OnM15 && tier === 'PRO'}
              onCheckedChange={handleToggleM5OnM15}
              className="data-[state=checked]:bg-cyan-500"
            />
            <label
              htmlFor="m5-on-m15-toggle"
              className="flex cursor-pointer items-center gap-1.5 text-xs font-bold tracking-tight"
            >
              <span>M5 on M15</span>
              {tier === 'FREE' ? (
                <Lock className="inline h-3 w-3 text-amber-400" />
              ) : (
                <Badge
                  variant="outline"
                  className="border-cyan-500/50 bg-cyan-500/20 px-1 py-0 font-mono text-[9px] text-cyan-300"
                >
                  Engine 2
                </Badge>
              )}
            </label>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-8 border-slate-700 bg-[#0a0d14] text-xs font-medium hover:bg-slate-800"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
            Auto-Refresh
          </Button>
        </div>
      </div>

      {/* Dual Stacked Chart Canvases with Distinct Color Tones */}
      <div className="flex flex-1 flex-col gap-1 overflow-hidden bg-black/80 p-1">
        {/* Upper Window: XAUUSD, M5 (Deep Navy Blue Tone #0b0e17) */}
        <div className="relative flex-1 overflow-hidden rounded-lg border border-blue-900/40 shadow-lg shadow-blue-950/20">
          <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-2">
            <Badge className="border border-blue-500/50 bg-[#0b0e17]/90 px-2.5 py-1 font-mono text-[11px] text-blue-300 shadow-md backdrop-blur-md">
              🟢 XAUUSD,M5
            </Badge>
            <span className="rounded border border-blue-900/60 bg-[#0b0e17]/80 px-2 py-0.5 font-mono text-[10px] text-blue-300/80 backdrop-blur-xs">
              M5 SSA & EDT Channel Canvas
            </span>
          </div>
          <div ref={containerM5Ref} className="absolute inset-0" />
        </div>

        {/* Lower Window: XAUUSD, M15 (Deep Amethyst Purple Tone #110d18) */}
        <div className="relative flex-1 overflow-hidden rounded-lg border border-purple-900/40 shadow-lg shadow-purple-950/20">
          <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-2">
            <Badge className="border border-purple-500/50 bg-[#110d18]/90 px-2.5 py-1 font-mono text-[11px] text-purple-300 shadow-md backdrop-blur-md">
              🟢 XAUUSD,M15
            </Badge>

            <span className="rounded border border-purple-900/60 bg-[#110d18]/80 px-2 py-0.5 font-mono text-[10px] text-purple-300/80 backdrop-blur-xs">
              {m15ViewMode === 'SSA_EDT'
                ? 'M15 SSA & EDT Channel'
                : 'M15 ZigZag Polyline'}
            </span>

            {isM5OnM15 && tier === 'PRO' && (
              <Badge
                variant="outline"
                className="border-cyan-500/60 bg-cyan-950/80 font-mono text-[10px] text-cyan-300 shadow-xs backdrop-blur-md"
              >
                ⚡ M5 EDT Overlaid
              </Badge>
            )}
          </div>

          <div ref={containerM15Ref} className="absolute inset-0" />
        </div>
      </div>
    </div>
  );
}

// Generate Realistic Technical Candlesticks
function generateCandleData(
  startPrice = 2635,
  count = 100,
  intervalMinutes = 5
) {
  const data = [];
  let time = Math.floor(Date.now() / 1000) - count * intervalMinutes * 60;
  let currentPrice = startPrice;

  for (let i = 0; i < count; i++) {
    const volatility = startPrice * 0.0015;
    const change = (Math.random() - 0.48) * volatility;
    const close = currentPrice + change;
    const open = currentPrice;
    const high = Math.max(open, close) + Math.random() * (volatility * 0.4);
    const low = Math.min(open, close) - Math.random() * (volatility * 0.4);

    data.push({
      time: (time + i * intervalMinutes * 60) as any,
      open,
      high,
      low,
      close,
    });
    currentPrice = close;
  }
  return data;
}

// Generate Trend Line Data for SSA and EDT Channel Lines
function generateLineData(candleData: any[], offset = 0) {
  return candleData.map((c, i) => {
    const trendBase = c.close + offset + Math.sin(i / 10) * 2;
    return {
      time: c.time,
      value: trendBase,
    };
  });
}

// Generate ZigZag Polyline Data
function generateZigZagData(candleData: any[]) {
  const points = [];
  let currentDir = 1;

  for (let i = 0; i < candleData.length; i += 8) {
    const candle = candleData[i];
    const val = currentDir === 1 ? candle.high + 1.5 : candle.low - 1.5;
    points.push({
      time: candle.time,
      value: val,
    });
    currentDir *= -1;
  }

  const last = candleData[candleData.length - 1];
  points.push({
    time: last.time,
    value: last.close,
  });

  return points;
}
