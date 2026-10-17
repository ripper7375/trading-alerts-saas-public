'use client';

import dynamic from 'next/dynamic';
import { createContext, useContext, useMemo, useState } from 'react';

import { useCurrencyGoldIndexHistory } from '@/components/market/useCurrencyIndexHistory';
import {
  REBASE_DEFAULT,
  REBASE_MAX,
  REBASE_MIN,
  XAUX_USDX_CHART_HEIGHT,
} from '@/components/market/xaux-usdx-chart-config';
import { ChartSkeleton } from '@/components/ui/chart-skeleton';
import { Slider } from '@/components/ui/slider';
import type { ComparisonTimeframe } from '@/lib/currency-gold-indices/history';
import type { CurrencyGoldIndexHistorySeries } from '@/lib/currency-gold-indices/queries';

/**
 * The state behind the public /xaux-vs-usdx page: the M5/M15 choice, the two
 * display-only rebase bases, and the history they fetch. The page is a Server
 * Component (heading, definitions); the toggle sits in its header, the rebase
 * panel and the chart below it, so the state lives in a provider that wraps
 * all three and renders no markup of its own.
 *
 * The chart (lightweight-charts) is loaded on demand; the values this file
 * needs from it are in xaux-usdx-chart-config.ts. The skeleton has the chart's
 * own height, so nothing below it moves when the chart arrives.
 *
 * @module components/market/xaux-usdx-workspace
 */

const XauxUsdxComparisonChart = dynamic(
  () =>
    import('@/components/market/xaux-usdx-comparison-chart').then(
      (mod) => mod.XauxUsdxComparisonChart
    ),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={XAUX_USDX_CHART_HEIGHT} />,
  }
);

const TIMEFRAMES: ComparisonTimeframe[] = ['M5', 'M15'];

interface XauxUsdxState {
  timeframe: ComparisonTimeframe;
  setTimeframe: (timeframe: ComparisonTimeframe) => void;
  xauxBase: number;
  setXauxBase: (base: number) => void;
  usdxBase: number;
  setUsdxBase: (base: number) => void;
  series: CurrencyGoldIndexHistorySeries[];
  isLoading: boolean;
}

const XauxUsdxContext = createContext<XauxUsdxState | null>(null);

function useXauxUsdx(): XauxUsdxState {
  const state = useContext(XauxUsdxContext);
  if (!state) throw new Error('XAUX/USDX parts must sit in XauxUsdxWorkspace');
  return state;
}

export function XauxUsdxWorkspace({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [timeframe, setTimeframe] = useState<ComparisonTimeframe>('M15');
  const { series, isLoading } = useCurrencyGoldIndexHistory(timeframe);

  // Both indices are rebased to exactly 100.00 at their own inception by
  // construction (Lane 4's own schema) -- overlaid, their lines start from
  // the same point and can sit close together. These sliders shift each
  // series' DISPLAYED values by a constant amount so the two visually
  // separate; nothing here reaches the API or the database (see
  // XauxUsdxComparisonChart's own `rebase` prop doc comment).
  const [xauxBase, setXauxBase] = useState(REBASE_DEFAULT);
  const [usdxBase, setUsdxBase] = useState(REBASE_DEFAULT);

  const value = useMemo(
    () => ({
      timeframe,
      setTimeframe,
      xauxBase,
      setXauxBase,
      usdxBase,
      setUsdxBase,
      series,
      isLoading,
    }),
    [timeframe, xauxBase, usdxBase, series, isLoading]
  );

  return (
    <XauxUsdxContext.Provider value={value}>
      {children}
    </XauxUsdxContext.Provider>
  );
}

/** M5/M15 Toggle */
export function XauxUsdxTimeframeToggle(): React.ReactElement {
  const { timeframe, setTimeframe } = useXauxUsdx();
  return (
    <div className="bg-muted/40 flex items-center self-end rounded-lg border border-border p-1 text-xs">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          type="button"
          onClick={() => setTimeframe(tf)}
          className={`rounded-md px-4 py-1.5 font-semibold transition-colors ${
            timeframe === tf
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}

export interface XauxUsdxRebaseLabels {
  title: string;
  reset: string;
  description: string;
  xauxBase: string;
  usdxBase: string;
}

/** Rebase controls */
export function XauxUsdxRebasePanel({
  labels,
}: {
  labels: XauxUsdxRebaseLabels;
}): React.ReactElement {
  const { xauxBase, setXauxBase, usdxBase, setUsdxBase } = useXauxUsdx();
  const isRebased = xauxBase !== REBASE_DEFAULT || usdxBase !== REBASE_DEFAULT;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-xl shadow-black/5 md:p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{labels.title}</p>
        <button
          type="button"
          disabled={!isRebased}
          onClick={() => {
            setXauxBase(REBASE_DEFAULT);
            setUsdxBase(REBASE_DEFAULT);
          }}
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {labels.reset}
        </button>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        {labels.description}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
              {labels.xauxBase}
            </span>
            <span className="font-mono tabular-nums text-foreground">
              {xauxBase}
            </span>
          </div>
          <Slider
            value={[xauxBase]}
            min={REBASE_MIN}
            max={REBASE_MAX}
            step={1}
            onValueChange={(v) => setXauxBase(v[0] ?? xauxBase)}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
              <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
              {labels.usdxBase}
            </span>
            <span className="font-mono tabular-nums text-foreground">
              {usdxBase}
            </span>
          </div>
          <Slider
            value={[usdxBase]}
            min={REBASE_MIN}
            max={REBASE_MAX}
            step={1}
            onValueChange={(v) => setUsdxBase(v[0] ?? usdxBase)}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Chart -- always mounted, even with no price data yet, so the drawing tools
 * stay usable regardless of Lane 4's VPS deployment status (drawing doesn't
 * need price data at all). The "no data" message floats ON TOP as a
 * non-blocking hint instead of replacing the chart entirely, matching
 * trading-chart.tsx's own established "overlay a status message over an
 * already-mounted chart" pattern. Needs an EXPLICIT z-index (matching the
 * drawing toolbar's own z-10): confirmed live that a plain z-index:auto
 * sibling does not reliably paint above the chart's <canvas> layers in this
 * stacking setup, the same reason the toolbar itself already carries z-10.
 */
export function XauxUsdxChartCard({
  noDataLabel,
}: {
  noDataLabel: string;
}): React.ReactElement {
  const { series, isLoading, xauxBase, usdxBase } = useXauxUsdx();
  const rebase = useMemo(
    () => ({ XAUX: xauxBase, USDX: usdxBase }),
    [xauxBase, usdxBase]
  );
  const hasData = series.some((s) => s.bars.length > 0);

  return (
    <div className="relative rounded-2xl border border-border bg-card p-4 shadow-xl shadow-black/5 md:p-6">
      <XauxUsdxComparisonChart series={series} rebase={rebase} />
      {!isLoading && !hasData && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <p className="rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-sm font-semibold text-amber-600 shadow-md dark:text-amber-400">
            {noDataLabel}
          </p>
        </div>
      )}
    </div>
  );
}
