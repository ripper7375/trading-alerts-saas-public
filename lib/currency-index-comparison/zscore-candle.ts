/**
 * Currency Index Comparison (PRO) -- Z-score candles ("MC") on index candles.
 *
 * Pure and client-safe, so the page recomputes instantly when a slider moves.
 *
 * Ground truth is zscoreohlccandleexport_v2_29.mq5 (backend-stack-c/.../mq5/),
 * the indicator zscore_candle.py ports and golden_certification.py certified
 * (M5 and M15 PASS). Ported from the MQL5 rather than the Python, which differ
 * in one place: OnCalculate() starts at bar `InpZScoreLength`, so the first
 * classified bar is index `length` and bar 0 never enters a window, while
 * zscore_candle.py classifies from index `length - 1`. The certification
 * compared the last 500 bars only, so it never reached that edge.
 *
 * - Body size = |close - open| (CalculateBodySizeStats).
 * - Z-score = (body - mean) / sample stddev over the `length` bars ending at
 *   the bar, itself included (CalculateZScore). A zero stddev gives 0. A
 *   slightly negative float variance gives NaN in MQL5's MathSqrt() and in
 *   Math.sqrt() alike, and a NaN z-score classifies as Normal in both.
 * - Class: bullish when close >= open; Large at z >= threshold 1, Extreme at
 *   z >= threshold 2 (ClassifyCandle). Extreme is tested first, so a second
 *   threshold below the first simply leaves Large empty, as in MQL5.
 *
 * The MQL5 draws Normal candles in clrNONE; this page draws only Large and
 * Extreme candles, per Davin's spec.
 *
 * @module lib/currency-index-comparison/zscore-candle
 */

import type { IndexCandle } from './series';

/** The page's default `InpZScoreLength` (Davin's spec; the .mq5 input is 432). */
export const DEFAULT_ZSCORE_LENGTH = 54;
/** `InpThresholdZ1`. */
export const DEFAULT_ZSCORE_THRESHOLD_1 = 1.5;
/** `InpThresholdZ2`. */
export const DEFAULT_ZSCORE_THRESHOLD_2 = 2.5;

/** The sample-variance divisor is `length - 1`, so 2 is the smallest usable. */
export const ZSCORE_LENGTH_MIN = 2;
export const ZSCORE_LENGTH_MAX = 500;
export const ZSCORE_THRESHOLD_MIN = 0.1;
export const ZSCORE_THRESHOLD_MAX = 5;

/** The .mq5's CANDLE_TYPE enum, in its order. */
export const ZSCORE_CANDLE_CLASSES = [
  'up-normal',
  'up-large',
  'up-extreme',
  'down-normal',
  'down-large',
  'down-extreme',
] as const;

export type ZScoreCandleClass = (typeof ZSCORE_CANDLE_CLASSES)[number];

/** The four classes the page draws; Normal candles stay invisible. */
export type HighlightedZScoreClass = Exclude<
  ZScoreCandleClass,
  'up-normal' | 'down-normal'
>;

export interface ZScoreCandleParams {
  length: number;
  thresholdZ1: number;
  thresholdZ2: number;
}

export const DEFAULT_ZSCORE_PARAMS: ZScoreCandleParams = {
  length: DEFAULT_ZSCORE_LENGTH,
  thresholdZ1: DEFAULT_ZSCORE_THRESHOLD_1,
  thresholdZ2: DEFAULT_ZSCORE_THRESHOLD_2,
};

/** Candles needed before the first bar is classified: `length + 1`. */
export function zscoreBarsNeeded(length: number): number {
  return length + 1;
}

/**
 * One class per candle, null during warm-up. All null when there are fewer
 * than `length` candles (`if(rates_total < InpZScoreLength) return 0;`).
 */
export function zscoreCandleClasses(
  candles: readonly IndexCandle[],
  params: ZScoreCandleParams = DEFAULT_ZSCORE_PARAMS
): (ZScoreCandleClass | null)[] {
  const { length, thresholdZ1, thresholdZ2 } = params;
  const n = candles.length;
  const result = new Array<ZScoreCandleClass | null>(n).fill(null);
  if (length < ZSCORE_LENGTH_MIN || n < length) return result;

  const body = candles.map((c) => Math.abs(c.close - c.open));

  for (let i = length; i < n; i++) {
    let sum = 0;
    let sum2 = 0;
    for (let j = 0; j < length; j++) {
      const v = body[i - j] as number;
      sum += v;
      sum2 += v * v;
    }
    const mean = sum / length;
    const variance = (sum2 - sum * mean) / (length - 1);
    const stdDev = Math.sqrt(variance);
    const zScore = stdDev !== 0 ? ((body[i] as number) - mean) / stdDev : 0;

    const candle = candles[i] as IndexCandle;
    const bullish = candle.close >= candle.open;
    let code: number;
    if (zScore >= thresholdZ2) code = bullish ? 2 : 5;
    else if (zScore >= thresholdZ1) code = bullish ? 1 : 4;
    else code = bullish ? 0 : 3;
    result[i] = ZSCORE_CANDLE_CLASSES[code] as ZScoreCandleClass;
  }
  return result;
}

export function isHighlightedZScoreClass(
  cls: ZScoreCandleClass | null
): cls is HighlightedZScoreClass {
  return cls !== null && cls !== 'up-normal' && cls !== 'down-normal';
}
