/**
 * Fibonacci geometry — retracement and price-extension levels.
 *
 * Both produce horizontal (constant-in-time) price levels keyed by ratio,
 * using ids that match the API `targetLevel` vocabulary (e.g. `fib_0.618`,
 * `fib_ext_1.618`).
 *
 * @module components/charts/drawing/geometry/fib
 */

import type { Anchor } from './types';

export const DEFAULT_FIB_RETRACE_RATIOS: readonly number[] = [
  0, 0.236, 0.382, 0.5, 0.618, 0.786, 1,
];

export const DEFAULT_FIB_EXT_RATIOS: readonly number[] = [
  0, 0.618, 1, 1.272, 1.618, 2, 2.618,
];

/** Ratio → stable key fragment, e.g. 0.618 → "0.618", 1 → "1". */
function ratioKey(r: number): string {
  return String(r);
}

/**
 * Retracement levels across the range defined by two anchors.
 *   level(r) = pB + (pA − pB)·r,   pA = a1.price (r=1), pB = a2.price (r=0)
 * Each level is constant in time.
 */
export function fibRetracementLevels(
  a1: Anchor,
  a2: Anchor,
  ratios: readonly number[] = DEFAULT_FIB_RETRACE_RATIOS
): Record<string, number> {
  const pA = a1.price;
  const pB = a2.price;
  const out: Record<string, number> = {};
  for (const r of ratios) {
    out[`fib_${ratioKey(r)}`] = pB + (pA - pB) * r;
  }
  return out;
}

/**
 * Price-extension levels from a three-point swing (P0→P1→P2).
 *   projected(r) = p2 + (p1 − p0)·r
 * Each level is constant in time.
 */
export function fibExtensionLevels(
  a0: Anchor,
  a1: Anchor,
  a2: Anchor,
  ratios: readonly number[] = DEFAULT_FIB_EXT_RATIOS
): Record<string, number> {
  const swing = a1.price - a0.price;
  const out: Record<string, number> = {};
  for (const r of ratios) {
    out[`fib_ext_${ratioKey(r)}`] = a2.price + swing * r;
  }
  return out;
}
