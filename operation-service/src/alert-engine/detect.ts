/**
 * Cross / touch detection (pure).
 *
 * Combines close-to-close crossing (directional) with an intrabar high/low
 * touch (catches wicks the close would miss). For directional alerts the
 * intrabar touch only contributes via 'either'; cross_up/cross_down require the
 * close to actually cross, matching the documented Phase 4 semantics.
 *
 * @module alert-engine/detect
 */

import type { Direction } from './types';

export function detectCross(
  prev: number | null,
  curr: number,
  low: number,
  high: number,
  level: number,
  tolerance: number,
  direction: Direction
): boolean {
  const band = Math.max(0, tolerance);

  const up = prev !== null && prev < level - band && curr >= level - band;
  const down = prev !== null && prev > level + band && curr <= level + band;
  const touched = low <= level + band && high >= level - band;

  if (direction === 'cross_up') return up;
  if (direction === 'cross_down') return down;
  return up || down || touched; // either
}
