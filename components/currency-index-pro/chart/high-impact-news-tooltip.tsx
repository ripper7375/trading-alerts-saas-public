'use client';

/**
 * HighImpactNewsTooltip — hover tooltip for the vertical news markers drawn
 * by `EventVerticalLine` (spec Section 7.2: "Hover Tooltip: Shows Event
 * Title, Country, Forecast, Previous...").
 *
 * `EventVerticalLine` itself is deliberately line-only (its own header
 * comment already flags a hover tooltip as "a natural follow-up rather
 * than something the line itself needs to be useful") -- this component is
 * that follow-up, built as a DOM overlay rather than forking the primitive:
 * it subscribes to the chart's own `subscribeCrosshairMove()` (the live
 * cursor position lightweight-charts already tracks) and shows a tooltip
 * while the pointer is on a news line, found by the same `eventCoordinate`
 * the line itself uses. The test is on pixels, not on the crosshair's time:
 * right of the last bar the crosshair has no time. Everything is read live, so
 * it never drifts out of registration under panning/zooming the way a
 * coordinate computed once and cached would.
 *
 * @module components/currency-index-pro/chart/high-impact-news-tooltip
 */

import type {
  IChartApi,
  ISeriesApi,
  Logical,
  MouseEventParams,
  SeriesType,
  Time,
  UTCTimestamp,
} from 'lightweight-charts';
import { useEffect, useState } from 'react';

import { eventCoordinate } from '@/components/charts/drawing/eventPlacement';
import { useLocale } from '@/lib/context/locale-context';
import type { CurrencyIndexNewsEvent } from '../hooks/use-currency-index-chart';

interface HighImpactNewsTooltipProps {
  chart: IChartApi | null;
  /** The series the news lines are attached to. */
  series: ISeriesApi<SeriesType> | null;
  events: readonly CurrencyIndexNewsEvent[];
}

interface TooltipState {
  x: number;
  y: number;
  event: CurrencyIndexNewsEvent;
}

/** The pointer is on a line within half a bar of it, and never less than this,
 * so a line stays reachable when the chart is zoomed far out. */
const MIN_REACH_PX = 4;

/** The event whose line the pointer at `x` is on, the nearest if several are. */
function eventAt(
  chart: IChartApi,
  series: ISeriesApi<SeriesType>,
  events: readonly CurrencyIndexNewsEvent[],
  x: number
): CurrencyIndexNewsEvent | null {
  const timeScale = chart.timeScale();
  const first = timeScale.logicalToCoordinate(0 as Logical);
  const second = timeScale.logicalToCoordinate(1 as Logical);
  if (first === null || second === null) return null;
  let reach = Math.max(MIN_REACH_PX, (second - first) / 2);
  let found: CurrencyIndexNewsEvent | null = null;
  for (const event of events) {
    const time = event.eventTime as UTCTimestamp;
    const lineX = eventCoordinate(chart, series, time);
    if (lineX === null || Math.abs(lineX - x) > reach) continue;
    reach = Math.abs(lineX - x);
    found = event;
  }
  return found;
}

export function HighImpactNewsTooltip({
  chart,
  series,
  events,
}: HighImpactNewsTooltipProps): React.JSX.Element | null {
  const { t } = useLocale();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    if (!chart || !series) return;

    const handleMove = (param: MouseEventParams<Time>): void => {
      const { point } = param;
      const match = point ? eventAt(chart, series, events, point.x) : null;
      setTooltip(
        point && match ? { x: point.x, y: point.y, event: match } : null
      );
    };

    chart.subscribeCrosshairMove(handleMove);
    return (): void => chart.unsubscribeCrosshairMove(handleMove);
  }, [chart, series, events]);

  if (!tooltip) return null;

  const { event } = tooltip;
  return (
    <div
      className="pointer-events-none absolute z-10 max-w-[220px] rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
      style={{
        left: tooltip.x + 12,
        top: Math.max(0, tooltip.y - 12),
      }}
    >
      <div className="font-semibold">
        {event.countryCode} · {event.currency}
      </div>
      <div className="text-muted-foreground">{event.eventName}</div>
      <div className="mt-1 flex justify-between gap-3 font-mono tabular-nums">
        <span>
          {t('currency_index_pro.news_tooltip.forecast', 'Forecast')}:{' '}
          {event.forecastValue ?? '--'}
        </span>
        <span>
          {t('currency_index_pro.news_tooltip.previous', 'Prev')}:{' '}
          {event.previousValue ?? '--'}
        </span>
      </div>
    </div>
  );
}
