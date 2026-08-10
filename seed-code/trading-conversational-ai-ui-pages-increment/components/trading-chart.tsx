'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  ColorType,
  CrosshairMode,
  TickMarkType,
  CandlestickSeries,
  LineSeries,
  BarSeries,
} from 'lightweight-charts';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import {
  RefreshCw,
  Lock,
  Layers,
  Activity,
  MousePointer,
  TrendingUp,
  GitBranch,
  Type,
  Ruler,
  Sliders,
  CandlestickChart as CandleIcon,
  BarChart2,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Symbol, Timeframe, Tier } from '@/lib/types';
import { useLocale } from '@/lib/context/locale-context';
import type { M15ViewMode } from '@/lib/types';
import { useChartAppearance } from '@/components/providers/appearance-provider';

interface TradingChartProps {
  tier?: Tier;
  symbol: Symbol;
  timeframe: Timeframe;
  onSymbolChange: (symbol: Symbol) => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
  onOpenUpgradeModal?: (featureName: string) => void;
  onAskAiFromChart?: (question: string) => void;
}

export type PriceDisplayMode = 'CANDLE' | 'BAR' | 'HIDE';

export default function TradingChart({
  tier = 'FREE',
  symbol,
  timeframe,
  onSymbolChange,
  onTimeframeChange,
  onOpenUpgradeModal,
  onAskAiFromChart,
}: TradingChartProps) {
  const { t, language, timezone, timeFormat, formatDate } = useLocale();
  const { chartUpColor, chartDownColor, gridOpacity, gridOpacityDecimal } =
    useChartAppearance();
  const containerM5Ref = useRef<HTMLDivElement>(null);
  const containerM15Ref = useRef<HTMLDivElement>(null);
  const chartM5Ref = useRef<IChartApi | null>(null);
  const chartM15Ref = useRef<IChartApi | null>(null);

  // M15 Lower Chart View Mode: SSA/EDT vs ZigZag
  const [m15ViewMode, setM15ViewMode] = useState<M15ViewMode>('SSA_EDT');

  // Part 24 Engine 2 MTF Overlay Toggle: M5 on M15
  const [isM5OnM15, setIsM5OnM15] = useState(false);

  // Price Display Mode for M5 and M15 (BAR | CANDLE | HIDE)
  const [m5PriceMode, setM5PriceMode] = useState<PriceDisplayMode>('CANDLE');
  const [m15PriceMode, setM15PriceMode] = useState<PriceDisplayMode>('CANDLE');

  // Active Drawing Tool (Left vertical strip)
  const [activeTool, setActiveTool] = useState<string>('pointer');

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

  // Chart time-axis/crosshair localization — lightweight-charts defaults to
  // navigator.language for date/time formatting, which silently ignores the
  // app's own selected language/timezone/time-format. Drive it from the same
  // preferences (via formatDate) the rest of the app uses instead, so the
  // crosshair label and axis tick marks always match the active locale.
  const chartLocalization = useMemo(() => {
    const toMs = (time: Time): number => {
      if (typeof time === 'number') return time * 1000;
      if (typeof time === 'string') return new Date(time).getTime();
      return new Date(time.year, time.month - 1, time.day).getTime();
    };

    const formatTimeOfDay = (ms: number): string => {
      try {
        return new Intl.DateTimeFormat('en-GB', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: timeFormat === '12h',
        }).format(new Date(ms));
      } catch {
        return '--:--';
      }
    };

    return {
      locale: language,
      timeFormatter: (time: Time) => {
        const ms = toMs(time);
        return `${formatDate(ms)} ${formatTimeOfDay(ms)}`;
      },
      tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) => {
        const ms = toMs(time);
        if (
          tickMarkType === TickMarkType.Time ||
          tickMarkType === TickMarkType.TimeWithSeconds
        ) {
          return formatTimeOfDay(ms);
        }
        return formatDate(ms);
      },
    };
  }, [language, timezone, timeFormat, formatDate]);

  // ResizeObserver for dynamic container drag resizing
  useEffect(() => {
    if (!containerM5Ref.current || !containerM15Ref.current) return;

    const observer = new ResizeObserver(() => {
      handleResize();
    });

    observer.observe(containerM5Ref.current);
    observer.observe(containerM15Ref.current);

    return () => {
      observer.disconnect();
    };
  }, [handleResize]);

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

  // Initialize Charts with dynamic appearance tokens
  useEffect(() => {
    if (!containerM5Ref.current || !containerM15Ref.current) return;

    // --- Chart 1: M5 (Upper Chart) ---
    const bgM5 = isDark ? '#080b12' : '#ffffff';
    const textM5 = isDark ? '#94a3b8' : '#334155';

    const chartM5 = createChart(containerM5Ref.current, {
      layout: {
        background: { type: ColorType.Solid, color: bgM5 },
        textColor: textM5,
      },
      grid: {
        vertLines: {
          visible: gridOpacity > 0,
          color: isDark
            ? `rgba(148, 163, 184, ${gridOpacityDecimal})`
            : `rgba(203, 213, 225, ${gridOpacityDecimal})`,
        },
        horzLines: {
          visible: gridOpacity > 0,
          color: isDark
            ? `rgba(148, 163, 184, ${gridOpacityDecimal})`
            : `rgba(203, 213, 225, ${gridOpacityDecimal})`,
        },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: isDark ? '#1e293b' : '#cbd5e1' },
      timeScale: {
        borderColor: isDark ? '#1e293b' : '#cbd5e1',
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: chartLocalization.tickMarkFormatter,
      },
      localization: {
        locale: chartLocalization.locale,
        timeFormatter: chartLocalization.timeFormatter,
      },
      width: containerM5Ref.current.clientWidth,
      height: containerM5Ref.current.clientHeight,
    });
    chartM5Ref.current = chartM5;

    const dataM5 = generateCandleData(2635, 120, 5);

    if (m5PriceMode === 'CANDLE') {
      const candlestickM5 = chartM5.addSeries(CandlestickSeries, {
        upColor: chartUpColor,
        downColor: chartDownColor,
        borderVisible: false,
        wickUpColor: chartUpColor,
        wickDownColor: chartDownColor,
      });
      candlestickM5.setData(dataM5);
    } else if (m5PriceMode === 'BAR') {
      const barM5 = chartM5.addSeries(BarSeries, {
        upColor: chartUpColor,
        downColor: chartDownColor,
      });
      barM5.setData(dataM5);
    }

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

    // --- Chart 2: M15 (Lower Chart) ---
    const bgM15 = isDark ? '#0f0a17' : '#f8fafc';
    const textM15 = isDark ? '#a78bfa' : '#475569';

    const chartM15 = createChart(containerM15Ref.current, {
      layout: {
        background: { type: ColorType.Solid, color: bgM15 },
        textColor: textM15,
      },
      grid: {
        vertLines: {
          visible: gridOpacity > 0,
          color: isDark
            ? `rgba(167, 139, 250, ${gridOpacityDecimal})`
            : `rgba(203, 213, 225, ${gridOpacityDecimal})`,
        },
        horzLines: {
          visible: gridOpacity > 0,
          color: isDark
            ? `rgba(167, 139, 250, ${gridOpacityDecimal})`
            : `rgba(203, 213, 225, ${gridOpacityDecimal})`,
        },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: isDark ? '#1e293b' : '#cbd5e1' },
      timeScale: {
        borderColor: isDark ? '#1e293b' : '#cbd5e1',
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: chartLocalization.tickMarkFormatter,
      },
      localization: {
        locale: chartLocalization.locale,
        timeFormatter: chartLocalization.timeFormatter,
      },
      width: containerM15Ref.current.clientWidth,
      height: containerM15Ref.current.clientHeight,
    });
    chartM15Ref.current = chartM15;

    const dataM15 = generateCandleData(2635, 80, 15);

    if (m15PriceMode === 'CANDLE') {
      const candlestickM15 = chartM15.addSeries(CandlestickSeries, {
        upColor: chartUpColor,
        downColor: chartDownColor,
        borderVisible: false,
        wickUpColor: chartUpColor,
        wickDownColor: chartDownColor,
      });
      candlestickM15.setData(dataM15);
    } else if (m15PriceMode === 'BAR') {
      const barM15 = chartM15.addSeries(BarSeries, {
        upColor: chartUpColor,
        downColor: chartDownColor,
      });
      barM15.setData(dataM15);
    }

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
        color: '#06b6d4',
        lineWidth: 2,
        lineStyle: 2,
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
  }, [
    m15ViewMode,
    isM5OnM15,
    m5PriceMode,
    m15PriceMode,
    tier,
    chartLocalization,
    chartUpColor,
    chartDownColor,
    gridOpacity,
    gridOpacityDecimal,
  ]);

  // Reactive Incremental Theme Updates (0ms flash-free theme switching)
  useEffect(() => {
    if (!chartM5Ref.current || !chartM15Ref.current) return;
    const bgM5 = isDark ? '#080b12' : '#ffffff';
    const textM5 = isDark ? '#94a3b8' : '#334155';
    const bgM15 = isDark ? '#0f0a17' : '#f8fafc';
    const textM15 = isDark ? '#a78bfa' : '#475569';

    chartM5Ref.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: bgM5 },
        textColor: textM5,
      },
    });
    chartM15Ref.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: bgM15 },
        textColor: textM15,
      },
    });
  }, [isDark]);

  // Drawing Tools Definition for left vertical strip
  const drawingTools = [
    { id: 'pointer', icon: MousePointer, label: 'Crosshair' },
    { id: 'trendline', icon: TrendingUp, label: 'Trendline' },
    { id: 'pitchfork', icon: GitBranch, label: 'Fork' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'ruler', icon: Ruler, label: 'Ruler' },
  ];

  return (
    // `animate-in fade-in` crossfades the real chart over the ChartSkeleton it
    // replaces. The two share an identical outer box, so this is a pure opacity
    // transition with no layout shift.
    <div className="animate-in fade-in bg-background text-foreground relative flex h-full flex-col overflow-hidden border-x border-slate-200 shadow-2xl duration-500 ease-out select-none dark:border-slate-800/80 dark:bg-[#06070b]">
      {/* C2: Top Header Toolbar */}
      <div className="flex h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-100 px-3.5 shadow-xs dark:border-slate-800/90 dark:bg-[#11141e]">
        <div className="flex items-center gap-2">
          <Badge className="border-amber-500/40 bg-amber-500/15 px-3 py-1 font-mono text-xs font-bold text-amber-400 shadow-xs">
            XAUUSD
          </Badge>

          <div className="border-slate-750 flex items-center gap-1 rounded-lg border bg-[#090b10] p-1 shadow-inner">
            <Button
              variant={m15ViewMode === 'SSA_EDT' ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'h-7 px-3 text-xs font-semibold text-slate-200 transition-all hover:bg-slate-800/60 hover:text-slate-100',
                m15ViewMode === 'SSA_EDT'
                  ? 'border border-[var(--primary)]/50 bg-[var(--primary)]/20 font-bold text-[var(--primary)] shadow-[var(--primary)]/20 shadow-sm'
                  : 'text-slate-300'
              )}
              onClick={() => setM15ViewMode('SSA_EDT')}
            >
              <Activity className="mr-1.5 h-3.5 w-3.5 text-[var(--primary)]" />
              {t('chart.m15_ssa_edt', 'M15 SSA & EDT Chart')}
            </Button>

            <Button
              variant={m15ViewMode === 'ZIGZAG' ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'h-7 px-3 text-xs font-semibold text-slate-200 transition-all hover:bg-slate-800/60 hover:text-slate-100',
                m15ViewMode === 'ZIGZAG'
                  ? 'border border-purple-500/50 bg-purple-600/30 font-bold text-purple-300 shadow-sm shadow-purple-500/20'
                  : 'text-slate-300'
              )}
              onClick={() => setM15ViewMode('ZIGZAG')}
            >
              <Layers className="mr-1.5 h-3.5 w-3.5 text-purple-400" />
              {t('chart.m15_zigzag', 'M15 ZigZag Chart')}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-1 text-xs shadow-xs transition-all',
              isM5OnM15 && tier === 'PRO'
                ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-200 shadow-cyan-500/10'
                : 'border-slate-800 bg-[#090b10] text-slate-300'
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
              className="flex cursor-pointer items-center gap-1.5 text-xs font-bold tracking-tight text-slate-200"
            >
              <span>{t('chart.ms_on_m15', 'M5 on M15')}</span>
              {tier === 'FREE' && (
                <Lock className="inline h-3 w-3 text-amber-400" />
              )}
            </label>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="border-slate-750 h-8 bg-[#090b10] text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-slate-100"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
            {t('chart.auto_refresh', 'Auto-Refresh')}
          </Button>
        </div>
      </div>

      {/* C4: Dual Stacked Chart Canvases with Horizontal Reciprocal Drag-Resizable Divider */}
      <ResizablePanelGroup
        direction="vertical"
        className="flex-1 overflow-hidden bg-black/80 p-1"
      >
        {/* C3: Upper Window: XAUUSD, M5 */}
        <ResizablePanel defaultSize={50} minSize={20}>
          <div className="relative h-full w-full overflow-hidden rounded-lg border border-blue-900/40 shadow-lg shadow-blue-950/20">
            {/* Left Vertical Drawing Toolbar Strip */}
            <div className="absolute top-12 left-2 z-20 flex flex-col gap-0.5 rounded-lg border border-slate-800 bg-[#090c14]/90 p-0.5 shadow-lg backdrop-blur-md">
              {drawingTools.map((tool) => (
                <Button
                  key={tool.id}
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-7 w-7 rounded-md text-slate-400 hover:bg-slate-800/80 hover:text-slate-100',
                    activeTool === tool.id &&
                      'border border-blue-500/50 bg-blue-600/30 font-bold text-blue-300'
                  )}
                  onClick={() => setActiveTool(tool.id)}
                  title={tool.label}
                >
                  <tool.icon className="h-3.5 w-3.5" />
                </Button>
              ))}
            </div>

            {/* Top Left Badge Overlay */}
            <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-2">
              <Badge className="border border-blue-500/50 bg-[#080b12]/90 px-2.5 py-1 font-mono text-[11px] text-blue-300 shadow-md backdrop-blur-md">
                🟢 XAUUSD,M5
              </Badge>
              <span className="rounded border border-blue-900/60 bg-[#080b12]/80 px-2 py-0.5 font-mono text-[10px] text-blue-300/80 backdrop-blur-xs">
                {t('M5 SSA & EDT Channel Canvas')}
              </span>
            </div>

            {/* Top Right Controls: EDT Configuration + 3 Price View Modes */}
            <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#080b12]/90 p-1 shadow-md backdrop-blur-md">
              <div className="border-slate-750 flex items-center rounded border bg-black/40 p-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-6 w-6 text-slate-400 hover:text-slate-100',
                    m5PriceMode === 'BAR' && 'bg-blue-600/30 text-blue-300'
                  )}
                  onClick={() => setM5PriceMode('BAR')}
                  title={t('Show Price Bar')}
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-6 w-6 text-slate-400 hover:text-slate-100',
                    m5PriceMode === 'CANDLE' && 'bg-blue-600/30 text-blue-300'
                  )}
                  onClick={() => setM5PriceMode('CANDLE')}
                  title={t('Show Price Candle')}
                >
                  <CandleIcon className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-6 w-6 text-slate-400 hover:text-slate-100',
                    m5PriceMode === 'HIDE' && 'bg-rose-600/30 text-rose-300'
                  )}
                  onClick={() => setM5PriceMode('HIDE')}
                  title={t('Hide Price Bar & Candle (Indicators Only)')}
                >
                  <EyeOff className="h-3.5 w-3.5" />
                </Button>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    className="h-7 border border-slate-700 bg-slate-800/80 text-[11px] font-bold text-slate-200 hover:bg-slate-700"
                  >
                    <Sliders className="mr-1 h-3 w-3 text-amber-400" />
                    {t('EDT Configuration', 'การตั้งค่า EDT')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="border-slate-750 w-64 space-y-2 bg-[#121622] p-3 text-xs text-slate-200">
                  <div className="border-b border-slate-800 pb-1 font-bold text-amber-400">
                    {t('M5 EDT Parameters', 'พารามิเตอร์ M5 EDT')}
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>{t('Channel Width:', 'ความกว้างช่อง:')}</span>{' '}
                    <span className="font-mono font-bold text-emerald-400">
                      12.0 pips
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>
                      {t('SSA Smoothing Period:', 'ระยะเวลาการเกลี่ย SSA:')}
                    </span>{' '}
                    <span className="font-mono font-bold text-blue-400">
                      24 bars
                    </span>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Lower Left Overlay: Ask AI Avatar Button */}
            <div className="absolute bottom-2.5 left-2.5 z-20">
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-2 rounded-full border-amber-500/50 bg-[#090d16]/95 px-3 text-[11px] font-bold text-amber-300 shadow-xl backdrop-blur-md transition-all hover:border-amber-400 hover:bg-amber-500/30 hover:text-amber-200"
                onClick={() => {
                  if (onAskAiFromChart) {
                    onAskAiFromChart(
                      'What is the current M5 SSA trend & EDT channel situation for XAUUSD?'
                    );
                  }
                }}
                title={t('Click to ask AI about M5 chart situation')}
              >
                <Avatar className="h-4.5 w-4.5 border border-amber-400/80">
                  <AvatarImage src="/DavinTrade_Logo.jpg" />
                  <AvatarFallback>AI</AvatarFallback>
                </Avatar>
                <span>{t('Ask AI about M5 Chart')}</span>
              </Button>
            </div>

            <div ref={containerM5Ref} className="absolute inset-0" />
          </div>
        </ResizablePanel>

        {/* C4: Reciprocal Drag-Resizable Horizontal Divider Handle */}
        <ResizableHandle
          withHandle
          className="my-0.5 cursor-row-resize border-y border-amber-500/40 bg-[#101522] shadow-lg hover:bg-amber-500/60"
        />

        {/* C5: Lower Window: XAUUSD, M15 */}
        <ResizablePanel defaultSize={50} minSize={20}>
          <div className="relative h-full w-full overflow-hidden rounded-lg border border-purple-900/40 shadow-lg shadow-purple-950/20">
            {/* Left Vertical Drawing Toolbar Strip */}
            <div className="absolute top-12 left-2 z-20 flex flex-col gap-0.5 rounded-lg border border-slate-800 bg-[#0f0a17]/90 p-0.5 shadow-lg backdrop-blur-md">
              {drawingTools.map((tool) => (
                <Button
                  key={tool.id}
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-7 w-7 rounded-md text-slate-400 hover:bg-slate-800/80 hover:text-slate-100',
                    activeTool === tool.id &&
                      'border border-purple-500/50 bg-purple-600/30 font-bold text-purple-300'
                  )}
                  onClick={() => setActiveTool(tool.id)}
                  title={tool.label}
                >
                  <tool.icon className="h-3.5 w-3.5" />
                </Button>
              ))}
            </div>

            {/* Top Left Badge Overlay */}
            <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-2">
              <Badge className="border border-purple-500/50 bg-[#0f0a17]/90 px-2.5 py-1 font-mono text-[11px] text-purple-300 shadow-md backdrop-blur-md">
                🟢 XAUUSD,M15
              </Badge>

              <span className="rounded border border-purple-900/60 bg-[#0f0a17]/80 px-2 py-0.5 font-mono text-[10px] text-purple-300/80 backdrop-blur-xs">
                {m15ViewMode === 'SSA_EDT'
                  ? t('M15 SSA & EDT Channel', 'ช่อง M15 SSA & EDT')
                  : t('M15 ZigZag Polyline', 'เส้นหลายเหลี่ยม M15 ZigZag')}
              </span>

              {isM5OnM15 && tier === 'PRO' && (
                <Badge
                  variant="outline"
                  className="border-cyan-500/60 bg-cyan-950/80 font-mono text-[10px] text-cyan-300 shadow-xs backdrop-blur-md"
                >
                  {t('⚡ M5 EDT Overlaid')}
                </Badge>
              )}
            </div>

            {/* Top Right Controls: EDT Configuration + 3 Price View Modes */}
            <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0f0a17]/90 p-1 shadow-md backdrop-blur-md">
              <div className="border-slate-750 flex items-center rounded border bg-black/40 p-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-6 w-6 text-slate-400 hover:text-slate-100',
                    m15PriceMode === 'BAR' && 'bg-purple-600/30 text-purple-300'
                  )}
                  onClick={() => setM15PriceMode('BAR')}
                  title={t('Show Price Bar')}
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-6 w-6 text-slate-400 hover:text-slate-100',
                    m15PriceMode === 'CANDLE' &&
                      'bg-purple-600/30 text-purple-300'
                  )}
                  onClick={() => setM15PriceMode('CANDLE')}
                  title={t('Show Price Candle')}
                >
                  <CandleIcon className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-6 w-6 text-slate-400 hover:text-slate-100',
                    m15PriceMode === 'HIDE' && 'bg-rose-600/30 text-rose-300'
                  )}
                  onClick={() => setM15PriceMode('HIDE')}
                  title={t('Hide Price Bar & Candle (Indicators Only)')}
                >
                  <EyeOff className="h-3.5 w-3.5" />
                </Button>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    className="h-7 border border-slate-700 bg-slate-800/80 text-[11px] font-bold text-slate-200 hover:bg-slate-700"
                  >
                    <Sliders className="mr-1 h-3 w-3 text-amber-400" />
                    {t('EDT Configuration')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="border-slate-750 w-64 space-y-2 bg-[#121622] p-3 text-xs text-slate-200">
                  <div className="border-b border-slate-800 pb-1 font-bold text-amber-400">
                    {t('M15 EDT Parameters')}
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>{t('Channel Width:')}</span>{' '}
                    <span className="font-mono font-bold text-emerald-400">
                      18.0 pips
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>{t('SSA Smoothing Period:')}</span>{' '}
                    <span className="font-mono font-bold text-purple-400">
                      48 bars
                    </span>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Lower Left Overlay: Ask AI Avatar Button */}
            <div className="absolute bottom-2.5 left-2.5 z-20">
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-2 rounded-full border-amber-500/50 bg-[#0e0817]/95 px-3 text-[11px] font-bold text-amber-300 shadow-xl backdrop-blur-md transition-all hover:border-amber-400 hover:bg-amber-500/30 hover:text-amber-200"
                onClick={() => {
                  if (onAskAiFromChart) {
                    onAskAiFromChart(
                      'What is the M15 market structure & ZigZag confirmation for XAUUSD?'
                    );
                  }
                }}
                title={t('Click to ask AI about M15 chart situation')}
              >
                <Avatar className="h-4.5 w-4.5 border border-amber-400/80">
                  <AvatarImage src="/DavinTrade_Logo.jpg" />
                  <AvatarFallback>AI</AvatarFallback>
                </Avatar>
                <span>{t('Ask AI about M15 Chart')}</span>
              </Button>
            </div>

            <div ref={containerM15Ref} className="absolute inset-0" />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
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

function generateLineData(candleData: any[], offset = 0) {
  return candleData.map((c, i) => {
    const trendBase = c.close + offset + Math.sin(i / 10) * 2;
    return {
      time: c.time,
      value: trendBase,
    };
  });
}

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
