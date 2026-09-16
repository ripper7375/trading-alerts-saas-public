'use client';

/**
 * MtfStackedCharts — the two-panel multi-timeframe layout.
 *
 * M5 above, M15 below, matching the rendered PNG a PRO user downloads and the
 * arrangement in the product's own terminal design. The divider between them
 * is draggable, so a trader can give either timeframe more of the panel —
 * before this the split was a fixed 50/50 and the gap between the two charts
 * was inert, unlike the seed prototype it was ported from.
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

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useLocale } from '@/lib/context/locale-context';

import { TradingChart } from './trading-chart';
import {
  DEFAULT_SPLIT,
  FALLBACK_TOTAL_HEIGHT_PX,
  minPanePercent,
  paneCanvasHeights,
} from './mtf-split-layout';

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

/** Percentages closer than this are the same divider position. */
const SPLIT_EPSILON = 0.05;

export function MtfStackedCharts({
  symbol,
  upperTimeframe = 'M5',
  lowerTimeframe = 'M15',
  totalHeight,
}: MtfStackedChartsProps): React.JSX.Element {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const [split, setSplit] = useState<readonly number[]>(DEFAULT_SPLIT);

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

  /**
   * Fires on every frame of a drag, which is what makes both canvases follow
   * the divider live. Ignoring no-op reports keeps a drag along a panel's
   * minimum from re-rendering two charts for nothing.
   */
  const onLayout = useCallback((next: number[]): void => {
    setSplit((prev) =>
      next.every(
        (size, i) => Math.abs(size - (prev[i] ?? Number.NaN)) < SPLIT_EPSILON
      )
        ? prev
        : next
    );
  }, []);

  const available = totalHeight ?? measuredHeight ?? FALLBACK_TOTAL_HEIGHT_PX;
  const [upperHeight, lowerHeight] = paneCanvasHeights(available, split);
  const minSize = minPanePercent(available);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={totalHeight !== undefined ? { height: totalHeight } : undefined}
    >
      <ResizablePanelGroup
        direction="vertical"
        className="h-full w-full"
        onLayout={onLayout}
      >
        <ResizablePanel
          id="mtf-upper"
          order={1}
          defaultSize={DEFAULT_SPLIT[0]}
          minSize={minSize}
          className="overflow-hidden"
        >
          <TradingChart
            symbol={symbol}
            timeframe={upperTimeframe}
            height={upperHeight}
            showHeader={false}
            showFooter={false}
            label={`${symbol} · ${upperTimeframe}`}
          />
        </ResizablePanel>

        <ResizableHandle
          withHandle
          aria-label={t('Drag to resize the upper and lower charts')}
        />

        <ResizablePanel
          id="mtf-lower"
          order={2}
          defaultSize={DEFAULT_SPLIT[1]}
          minSize={minSize}
          className="overflow-hidden"
        >
          <TradingChart
            symbol={symbol}
            timeframe={lowerTimeframe}
            height={lowerHeight}
            showHeader={false}
            showFooter={false}
            label={`${symbol} · ${lowerTimeframe}`}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
