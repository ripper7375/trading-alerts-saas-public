/**
 * Trendline / line-segment geometry.
 *
 * @module @trading-alerts/types/geometry/trendline
 */

import type { Anchor } from './types';

export interface TrendlineExtent {
  /** Extend the line indefinitely before the earlier anchor. */
  extendLeft?: boolean;
  /** Extend the line indefinitely after the later anchor. */
  extendRight?: boolean;
}

/**
 * Price of the line through `a1`→`a2` at time `t`:
 *   value(t) = p1 + (p2 − p1)·(t − t1)/(t2 − t1)
 *
 * Returns `null` when:
 *  - the line is vertical (`t1 === t2`) — price is not a function of time, or
 *  - `t` lies outside the [min,max] anchor span and the matching extension
 *    (`extendLeft`/`extendRight`) is disabled, or
 *  - any input is non-finite.
 */
export function trendlineValueAt(
  a1: Anchor,
  a2: Anchor,
  t: number,
  opts: TrendlineExtent = {}
): number | null {
  const { time: t1, price: p1 } = a1;
  const { time: t2, price: p2 } = a2;

  if (!Number.isFinite(t) || !Number.isFinite(t1) || !Number.isFinite(t2)) {
    return null;
  }
  if (!Number.isFinite(p1) || !Number.isFinite(p2)) {
    return null;
  }
  if (t1 === t2) {
    return null; // vertical line
  }

  const tMin = Math.min(t1, t2);
  const tMax = Math.max(t1, t2);
  const extendLeft = opts.extendLeft ?? false;
  const extendRight = opts.extendRight ?? false;

  if (t < tMin && !extendLeft) return null;
  if (t > tMax && !extendRight) return null;

  const slope = (p2 - p1) / (t2 - t1);
  return p1 + slope * (t - t1);
}
