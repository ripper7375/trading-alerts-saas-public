/**
 * Coordinate conversions between chart space (price/time) and screen pixels,
 * built on the Lightweight Charts v5 public API.
 *
 * Lives in `engine/` (not `geometry/`) because it depends on the chart and
 * series instances. The pure math stays in `geometry/`.
 *
 * The `timeToX` helper handles the out-of-range case: `timeToCoordinate`
 * returns null for times outside the current data/whitespace range, so we fall
 * back to a linear extrapolation in time using the visible range as reference.
 * This assumes roughly uniform bar spacing across the extrapolated region — a
 * reasonable approximation for drawing/extending lines.
 *
 * @module components/charts/drawing/engine/coords
 */

import type {
  IChartApiBase,
  ISeriesApi,
  SeriesType,
  Time,
} from 'lightweight-charts';

import type { Anchor } from '../geometry/types';

export interface Coords {
  priceToY(price: number): number | null;
  yToPrice(y: number): number | null;
  timeToX(time: number): number | null;
  xToTime(x: number): number | null;
  /** Pixel position of an anchor, or null if either axis can't be resolved. */
  anchorToPixel(anchor: Anchor): { x: number; y: number } | null;
  /** Convert a screen pixel to an anchor (price/time), or null. */
  pixelToAnchor(x: number, y: number): Anchor | null;
  paneWidth(): number;
  paneHeight(): number;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function createCoords(
  chart: IChartApiBase<Time>,
  series: ISeriesApi<SeriesType, Time>
): Coords {
  const priceToY = (price: number): number | null => {
    if (!Number.isFinite(price)) return null;
    const y = series.priceToCoordinate(price);
    return y === null ? null : (y as number);
  };

  const yToPrice = (y: number): number | null => {
    const p = series.coordinateToPrice(y);
    return p === null ? null : (p as number);
  };

  const timeToX = (time: number): number | null => {
    const ts = chart.timeScale();
    const direct = ts.timeToCoordinate(time as unknown as Time);
    if (direct !== null) return direct as number;

    // Fallback: linear extrapolation from the visible time range.
    const range = ts.getVisibleRange();
    if (!range) return null;
    const fromT = asNumber(range.from);
    const toT = asNumber(range.to);
    if (fromT === null || toT === null || fromT === toT) return null;

    const fromX = ts.timeToCoordinate(range.from);
    const toX = ts.timeToCoordinate(range.to);
    if (fromX === null || toX === null) return null;

    const ratio = (time - fromT) / (toT - fromT);
    return (fromX as number) + ratio * ((toX as number) - (fromX as number));
  };

  const xToTime = (x: number): number | null => {
    const t = chart.timeScale().coordinateToTime(x);
    return t === null ? null : asNumber(t);
  };

  const anchorToPixel = (anchor: Anchor): { x: number; y: number } | null => {
    const x = timeToX(anchor.time);
    const y = priceToY(anchor.price);
    if (x === null || y === null) return null;
    return { x, y };
  };

  const pixelToAnchor = (x: number, y: number): Anchor | null => {
    const time = xToTime(x);
    const price = yToPrice(y);
    if (time === null || price === null) return null;
    return { time, price };
  };

  return {
    priceToY,
    yToPrice,
    timeToX,
    xToTime,
    anchorToPixel,
    pixelToAnchor,
    paneWidth: () => chart.timeScale().width(),
    paneHeight: () => chart.paneSize().height,
  };
}
