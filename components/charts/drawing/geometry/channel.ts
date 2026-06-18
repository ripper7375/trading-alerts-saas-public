/**
 * Equidistant / parallel channel geometry.
 *
 * A channel is a base line (a1→a2) plus a parallel line at signed price
 * distance `offset`. Channels extend indefinitely along time, so the edge
 * values are defined for all `t` (except a vertical base line → null).
 *
 * `top`/`bottom` are ordered independently of the sign of `offset` so callers
 * can rely on top ≥ bottom.
 *
 * @module components/charts/drawing/geometry/channel
 */

import type { Anchor } from './types';

export interface ChannelLevels {
  top: (t: number) => number | null;
  bottom: (t: number) => number | null;
  median: (t: number) => number | null;
}

export function channelLevels(
  a1: Anchor,
  a2: Anchor,
  offset: number
): ChannelLevels {
  const base = (t: number): number | null => {
    if (a1.time === a2.time) return null; // vertical base line
    if (!Number.isFinite(t)) return null;
    if (!Number.isFinite(a1.price) || !Number.isFinite(a2.price)) return null;
    const slope = (a2.price - a1.price) / (a2.time - a1.time);
    if (!Number.isFinite(slope)) return null;
    return a1.price + slope * (t - a1.time);
  };

  const hi = Math.max(offset, 0);
  const lo = Math.min(offset, 0);

  return {
    top: (t) => {
      const b = base(t);
      return b === null ? null : b + hi;
    },
    bottom: (t) => {
      const b = base(t);
      return b === null ? null : b + lo;
    },
    median: (t) => {
      const b = base(t);
      return b === null ? null : b + offset / 2;
    },
  };
}
