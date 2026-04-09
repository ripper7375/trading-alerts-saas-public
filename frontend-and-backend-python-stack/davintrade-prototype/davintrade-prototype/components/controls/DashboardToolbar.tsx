'use client';

// components/controls/DashboardToolbar.tsx
// Top toolbar: chart-type switcher + trendlines toggle + symbol dropdown
//              + timeframe buttons (M5/M15/M30/H1 only) + light/dark toggle.
// Trendlines toggle controls LEFT panel only — ECharts trendlines always visible.
// Timeframe buttons update URL search params → both panels re-fetch.

import type { ChartType } from '@/types/chart';

const TIMEFRAMES = ['M5', 'M15', 'M30', 'H1'] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

interface ToolbarProps {
  chartType: ChartType;
  showTrendlines: boolean;
  activeTimeframe: Timeframe;
  activeSymbol: string;
  darkMode: boolean;
  onChartType: (t: ChartType) => void;
  onToggleTrendlines: () => void;
  onToggleTheme: () => void;
  onTimeframeChange: (tf: Timeframe) => void;
  onSymbolChange: (sym: string) => void;
  // Stats for info bar
  ssaRegime?: string;
  entropy?: number;
}

const CHART_ICONS: Record<ChartType, { icon: string; label: string }> = {
  line: { icon: '〜', label: 'Line' },
  candlestick: { icon: '┃┃', label: 'Candle' },
  bar: { icon: '▌▌', label: 'Bar' },
};

export function DashboardToolbar({
  chartType,
  showTrendlines,
  activeTimeframe,
  activeSymbol,
  darkMode,
  onChartType,
  onToggleTrendlines,
  onToggleTheme,
  onTimeframeChange,
  onSymbolChange,
  ssaRegime,
  entropy,
}: ToolbarProps) {
  const regimeColor: Record<string, string> = {
    Trend: 'text-green-400',
    Transition: 'text-yellow-400',
    Chaotic: 'text-red-400',
  };

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      {/* ── Chart type icon switcher — controls left LWC panel ─────────── */}
      <div className="flex gap-1" title="Chart type (left panel)">
        {(
          Object.entries(CHART_ICONS) as [
            ChartType,
            { icon: string; label: string },
          ][]
        ).map(([t, { icon, label }]) => (
          <button
            key={t}
            onClick={() => onChartType(t)}
            title={label}
            className={`rounded px-2 py-1 font-mono text-sm transition-colors ${
              chartType === t
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* ── Trendlines toggle — LEFT panel only ──────────────────────────── */}
      <button
        onClick={onToggleTrendlines}
        title="Show/hide golden trendlines (left panel only)"
        className={`rounded border px-2 py-1 text-xs font-medium transition-colors ${
          showTrendlines
            ? 'border-yellow-500 bg-yellow-600/80 text-white'
            : 'border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700'
        }`}
      >
        Trendlines
      </button>

      {/* ── Symbol dropdown ───────────────────────────────────────────────── */}
      <select
        value={activeSymbol}
        onChange={(e) => onSymbolChange(e.target.value)}
        className="cursor-pointer rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm font-bold text-yellow-300"
      >
        <option value="XAUUSD">XAUUSD</option>
        <option value="EURUSD" disabled>
          EURUSD (PRO)
        </option>
        <option value="GBPUSD" disabled>
          GBPUSD (PRO)
        </option>
      </select>

      {/* ── Timeframe buttons — controls BOTH panels ─────────────────────── */}
      <div className="flex gap-1">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => onTimeframeChange(tf)}
            className={`rounded border px-2 py-1 text-xs font-medium transition-colors ${
              activeTimeframe === tf
                ? 'border-green-400 bg-green-900/40 text-green-300 shadow-sm shadow-green-500/20'
                : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* ── Regime + entropy info ─────────────────────────────────────────── */}
      {ssaRegime && (
        <div className="ml-2 flex items-center gap-2 text-xs">
          <span className="text-gray-500">Regime:</span>
          <span
            className={`font-semibold ${regimeColor[ssaRegime] ?? 'text-gray-300'}`}
          >
            {ssaRegime}
          </span>
          {entropy !== undefined && (
            <>
              <span className="text-gray-600">|</span>
              <span className="text-gray-500">H:</span>
              <span className="font-mono text-gray-300">
                {entropy.toFixed(2)}
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Light / Dark mode toggle ──────────────────────────────────────── */}
      <button
        onClick={onToggleTheme}
        title="Toggle light/dark mode"
        className="ml-auto rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-700"
      >
        {darkMode ? '☾ Dark' : '☀ Light'}
      </button>
    </div>
  );
}
