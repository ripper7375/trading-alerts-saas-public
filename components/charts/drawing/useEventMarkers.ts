'use client';

/**
 * useEventMarkers — draws a vertical line on the chart at each upcoming
 * high-impact economic-event time. Reuses the same
 * `/api/market/economic-events` route and its default currency relevance
 * filter (`XAU_RELEVANT_CURRENCIES`) that the terminal's session banner news
 * row already uses -- one source of truth for "what counts as relevant"
 * rather than a second, possibly-diverging one invented here.
 *
 * The route is already PRO-gated server-side; `enabled` additionally skips
 * the request entirely for a FREE-tier chart rather than firing one that
 * will always come back 403.
 *
 * @module components/charts/drawing/useEventMarkers
 */

import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { useEffect, useRef } from 'react';

import type { UpcomingEconomicEvent } from '@/lib/economic-events/queries';

import { EventVerticalLine } from './EventVerticalLine';

/** Events shift on the order of minutes; re-asking every second is pointless. */
const REFRESH_MS = 5 * 60 * 1000;

export function useEventMarkers(
  chart: IChartApi | null,
  series: ISeriesApi<'Candlestick'> | null,
  enabled: boolean
): void {
  const linesRef = useRef<EventVerticalLine[]>([]);

  useEffect(() => {
    if (!chart || !series || !enabled) return;

    // Aborted on unmount/dep-change so an in-flight request cannot resolve
    // into a torn-down chart -- the same shape as useUpcomingEvents.
    const controller = new AbortController();

    const clearLines = (): void => {
      linesRef.current.forEach((line) => series.detachPrimitive(line));
      linesRef.current = [];
    };

    const load = async (): Promise<void> => {
      try {
        const res = await fetch('/api/market/economic-events', {
          signal: controller.signal,
        });
        if (!res.ok) {
          clearLines();
          return;
        }
        const data: { events?: UpcomingEconomicEvent[] } = await res.json();
        const lines = (data.events ?? []).map((event) => {
          const line = new EventVerticalLine(
            chart,
            series,
            event.eventTime as UTCTimestamp
          );
          series.attachPrimitive(line);
          return line;
        });
        // Detach the previous set only after the new one has attached, so
        // there is never a frame with zero markers while a poll refreshes.
        linesRef.current.forEach((line) => series.detachPrimitive(line));
        linesRef.current = lines;
      } catch {
        // Includes the AbortError from unmount/dep-change. No markers is the
        // correct rendering of "we do not know", matching the banner's own
        // news row.
        clearLines();
      }
    };

    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);

    return (): void => {
      controller.abort();
      clearInterval(timer);
      clearLines();
    };
  }, [chart, series, enabled]);
}
