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
 * when the crosshair's time bucket lands within one bar of a news event,
 * positioned at the crosshair's own live pixel coordinates -- so it never
 * drifts out of registration under panning/zooming the way a coordinate
 * computed once and cached would.
 *
 * @module components/currency-index-pro/chart/high-impact-news-tooltip
 */

import type { IChartApi, MouseEventParams, Time } from 'lightweight-charts';
import { useEffect, useState } from 'react';

import type { CurrencyIndexNewsEvent } from '../hooks/use-currency-index-chart';

interface HighImpactNewsTooltipProps {
  chart: IChartApi | null;
  events: readonly CurrencyIndexNewsEvent[];
  /** M15 bars are 900s apart -- a crosshair within half a bar of an event
   * counts as "hovering" it. Passed explicitly so an M5 chart (300s bars)
   * can use a tighter tolerance. */
  toleranceSeconds?: number;
}

interface TooltipState {
  x: number;
  y: number;
  event: CurrencyIndexNewsEvent;
}

export function HighImpactNewsTooltip({
  chart,
  events,
  toleranceSeconds = 450,
}: HighImpactNewsTooltipProps): React.JSX.Element | null {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    if (!chart) return;

    const handleMove = (param: MouseEventParams<Time>): void => {
      if (!param.time || !param.point) {
        setTooltip(null);
        return;
      }
      const hoveredTime = param.time as number;
      const match = events.find(
        (event) => Math.abs(event.eventTime - hoveredTime) <= toleranceSeconds
      );
      if (!match) {
        setTooltip(null);
        return;
      }
      setTooltip({ x: param.point.x, y: param.point.y, event: match });
    };

    chart.subscribeCrosshairMove(handleMove);
    return (): void => chart.unsubscribeCrosshairMove(handleMove);
  }, [chart, events, toleranceSeconds]);

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
        <span>Forecast: {event.forecastValue ?? '--'}</span>
        <span>Prev: {event.previousValue ?? '--'}</span>
      </div>
    </div>
  );
}
