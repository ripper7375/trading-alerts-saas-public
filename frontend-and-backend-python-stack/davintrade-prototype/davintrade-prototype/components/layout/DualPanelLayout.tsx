'use client';

// components/layout/DualPanelLayout.tsx
// Two-column responsive wrapper.
// Manages chartType, showTrendlines, darkMode state.
// Left: flex-[3]   Right: flex-[2]
// Right top: flex-[55]  Right bottom gauges: flex-[45]

import type { CandlestickData, UTCTimestamp } from 'lightweight-charts';
import { useState, useCallback } from 'react';

import { EChartsBPIGauge } from '@/components/charts/echarts/EChartsBPIGauge';
import { EChartsHeatmapChart } from '@/components/charts/echarts/EChartsHeatmapChart';
import { EChartsHMIGauge } from '@/components/charts/echarts/EChartsHMIGauge';
import { EChartsRPIGauge } from '@/components/charts/echarts/EChartsRPIGauge';
import { LWCPrimaryChart } from '@/components/charts/lwc/LWCPrimaryChart';
import { DashboardToolbar } from '@/components/controls/DashboardToolbar';
import type { ChartType } from '@/types/chart';
import type { HeatmapApiResponse } from '@/types/heatmap';
import type { TrendlineMarker } from '@/types/trendline';

type Timeframe = 'M5' | 'M15' | 'M30' | 'H1';

interface Props {
  heatmapPayload: HeatmapApiResponse;
  ohlcvData: CandlestickData[];
  lwcTrendlines?: TrendlineMarker[]; // golden plot markers for left LWC panel
  symbol?: string;
  timeframe?: string;
  onTimeframeChange?: (tf: Timeframe) => void;
  onSymbolChange?: (sym: string) => void;
}

export function DualPanelLayout({
  heatmapPayload,
  ohlcvData,
  lwcTrendlines = [],
  symbol = 'XAUUSD',
  timeframe = 'M5',
  onTimeframeChange,
  onSymbolChange,
}: Props) {
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [showTrendlines, setShowTrendlines] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [activeTf, setActiveTf] = useState<Timeframe>(
    (timeframe as Timeframe) ?? 'M5'
  );
  const [activeSymbol, setActiveSymbol] = useState(symbol);

  const handleCrosshairMove = useCallback(
    (_time: UTCTimestamp | null, _price: number | null) => {
      // Extend: drive ECharts axisPointer programmatically if needed
    },
    []
  );

  const handleTimeframeChange = useCallback(
    (tf: Timeframe) => {
      setActiveTf(tf);
      onTimeframeChange?.(tf);
    },
    [onTimeframeChange]
  );

  const handleSymbolChange = useCallback(
    (sym: string) => {
      setActiveSymbol(sym);
      onSymbolChange?.(sym);
    },
    [onSymbolChange]
  );

  // Sandwich prices from payload
  const sandwich = {
    upper: heatmapPayload.upper_sandwich_price,
    lower: heatmapPayload.lower_sandwich_price,
  };

  // ECharts layers from payload
  const ssaData = heatmapPayload.data.ssa_data ?? [];
  const fractals = heatmapPayload.data.fractals ?? [];
  const trendlines = heatmapPayload.data.trendlines ?? [];
  const heatZones = heatmapPayload.data.heat_zones;

  const bg = darkMode ? 'bg-gray-950' : 'bg-gray-100';
  const toolbarBorder = darkMode ? 'border-gray-800' : 'border-gray-300';

  return (
    <div className={`flex h-screen w-full flex-col ${bg} overflow-hidden`}>
      {/* ── TOP TOOLBAR — full width, shared controls ─────────────────────── */}
      <div
        className={`flex h-12 flex-none items-center gap-3 border-b px-3 ${toolbarBorder}`}
      >
        <DashboardToolbar
          chartType={chartType}
          showTrendlines={showTrendlines}
          activeTimeframe={activeTf}
          activeSymbol={activeSymbol}
          darkMode={darkMode}
          onChartType={setChartType}
          onToggleTrendlines={() => setShowTrendlines((v) => !v)}
          onToggleTheme={() => setDarkMode((v) => !v)}
          onTimeframeChange={handleTimeframeChange}
          onSymbolChange={handleSymbolChange}
          ssaRegime={heatmapPayload.ssa_regime}
          entropy={heatmapPayload.entropy}
        />
      </div>

      {/* ── MAIN CONTENT — two panels ────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2 lg:flex-row">
        {/* ── LEFT: TradingView Lightweight Charts ──────────────────────── */}
        <div className="min-h-[400px] flex-[3] overflow-hidden rounded-lg border border-blue-500/30 lg:min-h-0">
          <LWCPrimaryChart
            ohlcvData={ohlcvData}
            chartType={chartType}
            showTrendlines={showTrendlines}
            trendlines={lwcTrendlines}
            onCrosshairMove={handleCrosshairMove}
            darkMode={darkMode}
          />
        </div>

        {/* ── RIGHT: ECharts supplement panel ──────────────────────────── */}
        <div className="flex min-h-[600px] flex-[2] flex-col gap-2 lg:min-h-0">
          {/* RIGHT TOP: Heatmap analytical chart */}
          <div className="min-h-0 flex-[55] overflow-hidden rounded-lg border border-green-500/30">
            <EChartsHeatmapChart
              ssaData={ssaData}
              fractals={fractals}
              trendlines={trendlines}
              heatZones={heatZones}
              sandwich={sandwich}
            />
          </div>

          {/* RIGHT BOTTOM: 3 gauges — HMI | RPI | BPI — same blue, same style */}
          <div className="flex min-h-0 flex-[45] flex-row gap-2">
            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-green-500/20">
              <EChartsHMIGauge payload={heatmapPayload} />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-green-500/20">
              <EChartsRPIGauge payload={heatmapPayload} />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-green-500/20">
              <EChartsBPIGauge payload={heatmapPayload} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
