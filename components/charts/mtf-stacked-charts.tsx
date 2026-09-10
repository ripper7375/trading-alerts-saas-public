'use client';

/**
 * MtfStackedCharts — the two-panel multi-timeframe layout.
 *
 * M5 above, M15 below, matching the rendered PNG a PRO user downloads and the
 * arrangement in the product's own terminal design.
 *
 * This is deliberately a *composition* of two `TradingChart` instances rather
 * than a chart component that owns two canvases. `TradingChart` is already
 * self-contained and parameterized by timeframe, and it carries a reactive
 * appearance effect, a drawing layer, alert markers and live socket wiring that
 * a rewrite would have had to reproduce. Two instances get all of it for free.
 *
 * It also places the PRO overlay toggle correctly with no extra logic:
 * `TradingChart` shows `MtfToggle` only when its own timeframe is M15, so the
 * toggle lands on the lower chart and nowhere else.
 *
 * Each instance holds its own socket subscription, so this doubles WebSocket
 * connections per viewer. That is a deliberate, recorded trade-off (plan D8) —
 * the alternative is a shared-socket refactor of `useOhlcvSocket`, which would
 * touch the single-chart consumers too.
 *
 * @module components/charts/mtf-stacked-charts
 */

import { useEffect, useRef, useState } from 'react';

import { TradingChart } from './trading-chart';

interface MtfStackedChartsProps {
  symbol: string;
  /** Upper panel. Defaults to the pair the PNG renders. */
  upperTimeframe?: string;
  /** Lower panel — the one the M5 overlay toggle attaches to. */
  lowerTimeframe?: string;
  /**
   * Total height for both charts combined. Omit to measure the container,
   * which is what a resizable panel needs.
   */
  totalHeight?: number;
}

/** Chrome around each canvas (label strip, padding, gap) — subtracted so the
 *  two charts fit the measured box instead of overflowing it. */
const CHROME_PER_CHART = 44;
const MIN_CHART_HEIGHT = 160;

export function MtfStackedCharts({
  symbol,
  upperTimeframe = 'M5',
  lowerTimeframe = 'M15',
  totalHeight,
}: MtfStackedChartsProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);

  /**
   * lightweight-charts needs an explicit pixel height, but both workspaces put
   * this inside a drag-resizable panel — so observe the box rather than
   * guessing. Falls back to `totalHeight` when given.
   */
  useEffect(() => {
    if (totalHeight !== undefined) return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.height;
      if (next && next > 0) setMeasuredHeight(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [totalHeight]);

  const available = totalHeight ?? measuredHeight ?? 640;
  const perChart = Math.max(
    MIN_CHART_HEIGHT,
    Math.floor(available / 2) - CHROME_PER_CHART
  );

  return (
    <div ref={containerRef} className="flex h-full w-full flex-col gap-2">
      <TradingChart
        symbol={symbol}
        timeframe={upperTimeframe}
        height={perChart}
        showHeader={false}
        showFooter={false}
        label={`${symbol} · ${upperTimeframe}`}
      />
      <TradingChart
        symbol={symbol}
        timeframe={lowerTimeframe}
        height={perChart}
        showHeader={false}
        showFooter={false}
        label={`${symbol} · ${lowerTimeframe}`}
      />
    </div>
  );
}
