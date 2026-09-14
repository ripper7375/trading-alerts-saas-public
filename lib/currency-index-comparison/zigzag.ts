/**
 * Currency Index Comparison (PRO) -- ZigZag on index candles.
 *
 * Pure and client-safe, so the page recomputes instantly when the Depth slider
 * moves, with no request.
 *
 * Ground truth is ZigZagExportv43_v2_29.mq5 (backend-stack-c/.../mq5/), the
 * MT5 ZigZag whose exported pivots the certified zigzag_metrics.py was checked
 * against. Two layers, ported separately:
 *
 * 1. PIVOTS (detectZigZagPivots). OnCalculate()'s full-recalculation path
 *    (prev_calculated == 0): CalculateZigZag() from bar depth - 1 with
 *    CalculateHighLowMaps() and FindExtremes(), then CollectValidPoints().
 *    Ported line for line, including its quirks: a high map fires when a bar's
 *    high equals the highest high of the last `depth` bars (itself included);
 *    a new peak is accepted on ANY high-map bar while searching for a peak,
 *    with no check against the previous bottom; and the high branch wins when
 *    both maps fire on one bar. CollectValidPoints()'s two filters are no-ops
 *    for a full recalculation (every pivot sits on a map bar, and
 *    `i > lastValidIndex - 2` holds for every pivot), so every pivot is kept.
 *
 *    DEVIATION AND BACK STEP DO NOT AFFECT THE PIVOTS, in v43 or here.
 *    xInpDeviation is read only by ValidateZigZagPoint(), which nothing calls;
 *    xInpBackstep is only range-checked in OnInit(). Both appear in the
 *    indicator's short name, "ZigZagColor(12,5,3)". The page shows them as
 *    fixed values for that reason (Davin's call, 2026-09-14), rather than as
 *    sliders that move without changing anything.
 *
 * 2. SEGMENT CLASS (classifyZigZagSegments). UpdateZigZagColors(): each
 *    segment's %-change is classified Normal / Large / Extreme by a sample
 *    z-score of |%-change| over up to 50 trailing segments, the segment itself
 *    included. This is GetPercentChangeClassification(), the same function
 *    zigzag_metrics.py ports and golden_certification.py certified (M5 and
 *    M15, all 9 metrics PASS).
 *
 * Both run on the REAL candles, never Heiken Ashi, like every other indicator
 * on this page.
 *
 * @module lib/currency-index-comparison/zigzag
 */

import type { IndexCandle } from './series';

/** ZigZagExportv43 `xInpDepth`. */
export const DEFAULT_ZIGZAG_DEPTH = 12;
/** OnInit(): `if(xInpDepth < 2 ...) return INIT_PARAMETERS_INCORRECT`. */
export const ZIGZAG_DEPTH_MIN = 2;
export const ZIGZAG_DEPTH_MAX = 100;
/** `xInpDeviation` -- shown, never used by the calculation (see above). */
export const ZIGZAG_DEVIATION = 5;
/** `xInpBackstep` -- shown, never used by the calculation (see above). */
export const ZIGZAG_BACKSTEP = 3;

/** Segment-class inputs: `InpZScoreLength`, `InpThresholdZ1`, `InpThresholdZ2`. */
export const ZIGZAG_CLASS_ZSCORE_LENGTH = 50;
export const ZIGZAG_CLASS_THRESHOLD_Z1 = 1.41;
export const ZIGZAG_CLASS_THRESHOLD_Z2 = 1.88;

export interface ZigZagPivot {
  /** Position in the candle array the pivots were detected on. */
  index: number;
  time: number;
  /** The bar's high for a peak, its low for a bottom. */
  price: number;
  isPeak: boolean;
}

export type ZigZagClass = 'normal' | 'large' | 'extreme';

/** MQL5 Highest(): max of `array` over the `count` bars ending at `start`. */
function highest(
  array: readonly number[],
  count: number,
  start: number
): number {
  if (start < count - 1) count = start + 1;
  let res = array[start] as number;
  for (let i = start - 1; i > start - count && i >= 0; i--) {
    const v = array[i] as number;
    if (res < v) res = v;
  }
  return res;
}

/** MQL5 Lowest(). */
function lowest(
  array: readonly number[],
  count: number,
  start: number
): number {
  if (start < count - 1) count = start + 1;
  let res = array[start] as number;
  for (let i = start - 1; i > start - count && i >= 0; i--) {
    const v = array[i] as number;
    if (res > v) res = v;
  }
  return res;
}

const SEARCH_EXTREMUM = 0;
const SEARCH_PEAK = 1;
const SEARCH_BOTTOM = -1;

/**
 * Confirmed ZigZag pivots, oldest first. Empty when there are fewer candles
 * than `depth` (OnCalculate: `if(rates_total < xInpDepth) return 0;`).
 *
 * Zero is the MQL5 buffers' "no value" sentinel and is kept as such; an index
 * price is never zero.
 */
export function detectZigZagPivots(
  candles: readonly IndexCandle[],
  depth: number
): ZigZagPivot[] {
  const n = candles.length;
  if (depth < ZIGZAG_DEPTH_MIN || n < depth) return [];

  const high = candles.map((c) => c.high);
  const low = candles.map((c) => c.low);
  const peakBuffer = new Array<number>(n).fill(0);
  const bottomBuffer = new Array<number>(n).fill(0);

  let search = SEARCH_EXTREMUM;
  let lastHigh = 0;
  let lastLow = 0;
  let lastHighPos = 0;
  let lastLowPos = 0;

  for (let i = depth - 1; i < n; i++) {
    const h = high[i] as number;
    const l = low[i] as number;
    // CalculateHighLowMaps()
    const highMap = h === highest(high, depth, i) ? h : 0;
    const lowMap = l === lowest(low, depth, i) ? l : 0;

    // FindExtremes()
    switch (search) {
      case SEARCH_EXTREMUM:
        if (lastLow === 0 && lastHigh === 0) {
          if (highMap !== 0) {
            lastHigh = h;
            lastHighPos = i;
            search = SEARCH_BOTTOM;
            peakBuffer[i] = lastHigh;
          } else if (lowMap !== 0) {
            lastLow = l;
            lastLowPos = i;
            search = SEARCH_PEAK;
            bottomBuffer[i] = lastLow;
          }
        }
        break;

      case SEARCH_PEAK:
        if (highMap !== 0) {
          lastHigh = h;
          lastHighPos = i;
          peakBuffer[i] = lastHigh;
          search = SEARCH_BOTTOM;
        } else if (lowMap !== 0 && l < lastLow) {
          bottomBuffer[lastLowPos] = 0;
          lastLow = l;
          lastLowPos = i;
          bottomBuffer[i] = lastLow;
        }
        break;

      case SEARCH_BOTTOM:
        if (lowMap !== 0) {
          lastLow = l;
          lastLowPos = i;
          bottomBuffer[i] = lastLow;
          search = SEARCH_PEAK;
        } else if (highMap !== 0 && h > lastHigh) {
          peakBuffer[lastHighPos] = 0;
          lastHigh = h;
          lastHighPos = i;
          peakBuffer[i] = lastHigh;
        }
        break;
    }
  }

  // CollectValidPoints()
  const pivots: ZigZagPivot[] = [];
  for (let i = 0; i < n; i++) {
    const peak = peakBuffer[i] as number;
    const bottom = bottomBuffer[i] as number;
    if (peak !== 0 || bottom !== 0) {
      pivots.push({
        index: i,
        time: (candles[i] as IndexCandle).time,
        price: peak !== 0 ? peak : bottom,
        isPeak: peak !== 0,
      });
    }
  }
  return pivots;
}

/**
 * GetPercentChangeClassification(), for the segment ending at pivot `k`
 * (oldest-first). Returns the MQL5 code: 0/1/2 bullish normal/large/extreme,
 * 3/4/5 bearish. The population walks back from that segment, itself
 * included, skipping a zero previous price without counting it, exactly as
 * the MQL5 loop (and zigzag_metrics.pct_change_class) does.
 */
export function zigzagPctChangeClass(
  pivots: readonly ZigZagPivot[],
  k: number,
  currentPctChange: number,
  zscoreLength: number = ZIGZAG_CLASS_ZSCORE_LENGTH,
  thresholdZ1: number = ZIGZAG_CLASS_THRESHOLD_Z1,
  thresholdZ2: number = ZIGZAG_CLASS_THRESHOLD_Z2
): number {
  let sum = 0;
  let sum2 = 0;
  let count = 0;
  for (let j = k; count < zscoreLength && j - 1 >= 0; j--) {
    const currP = (pivots[j] as ZigZagPivot).price;
    const prevP = (pivots[j - 1] as ZigZagPivot).price;
    if (prevP === 0) continue;
    const absPct = Math.abs(((currP - prevP) / prevP) * 100);
    sum += absPct;
    sum2 += absPct * absPct;
    count++;
  }

  let mean = 0;
  let stdDev = 0;
  if (count > 0) {
    mean = sum / count;
    if (count > 1) {
      const variance = (sum2 - sum * mean) / (count - 1);
      if (variance > 0) stdDev = Math.sqrt(variance);
    }
  }
  const zScore =
    stdDev !== 0 ? (Math.abs(currentPctChange) - mean) / stdDev : 0;

  const bullish = currentPctChange >= 0;
  if (zScore >= thresholdZ2) return bullish ? 2 : 5;
  if (zScore >= thresholdZ1) return bullish ? 1 : 4;
  return bullish ? 0 : 3;
}

/**
 * UpdateZigZagColors(): the class of the segment ENDING at each pivot. The
 * first pivot has no incoming segment (null). A zero previous price leaves the
 * MQL5 color index at its default 0, i.e. Normal.
 */
export function classifyZigZagSegments(
  pivots: readonly ZigZagPivot[]
): (ZigZagClass | null)[] {
  return pivots.map((pivot, k) => {
    if (k === 0) return null;
    const prevPrice = (pivots[k - 1] as ZigZagPivot).price;
    if (prevPrice === 0) return 'normal';
    const pct = ((pivot.price - prevPrice) / prevPrice) * 100;
    const code = zigzagPctChangeClass(pivots, k, pct);
    if (code === 2 || code === 5) return 'extreme';
    if (code === 1 || code === 4) return 'large';
    return 'normal';
  });
}

/**
 * Which pivots START a segment of class `target`: true at pivot k when the
 * segment k -> k + 1 has that class. The chart draws one line series per class
 * with every pivot in it and paints only these starts, because a
 * lightweight-charts line segment takes the color of its START point (the
 * renderer strokes the path up to a point with the previous point's style)
 * and whitespace does not break a line. The last pivot starts nothing.
 */
export function zigzagSegmentStarts(
  classes: readonly (ZigZagClass | null)[],
  target: ZigZagClass
): boolean[] {
  return classes.map((_, k) => classes[k + 1] === target);
}
