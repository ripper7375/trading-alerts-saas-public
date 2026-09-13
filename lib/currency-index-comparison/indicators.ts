/**
 * Currency Index Comparison (PRO) -- chart-side indicators on index candles.
 *
 * Pure and client-safe, so the page recomputes instantly when a period slider
 * moves, with no request (the same reason the Currency Index PRO Plan's
 * HRMA/SMMA detail modal computes client-side).
 *
 * Ground truth is the MQL5 files in davintrade-currency-index-comparison-pro-
 * stack/, read directly:
 *
 * - HRMA / SMMA reuse computeHrma()/computeSmma() from
 *   lib/currency-index-pro/math.ts, already verified line-for-line against
 *   these same two .mq5 files (Currency Index PRO Plan, Phase 5). This module
 *   only adds the APPLIED PRICE each file defaults to, which that module never
 *   needed (it only ever had a close): HRMA_Modified Buffers.mq5
 *   `InpAppliedPrice = PRICE_TYPICAL` -> (high + low + close) / 3;
 *   SMMA_Modified Buffers.mq5 `InpAppliedPrice = PRICE_CLOSE`.
 * - Heiken Ashi ports *_H1_HA Candles.mq5's OnCalculate() exactly, including
 *   its seed (the first HA open is the first real open).
 *
 * Both indicators are computed from the REAL candles, never from the Heiken
 * Ashi ones, so switching the plot type never moves an indicator line --
 * matching MT5, where an indicator reads the chart's own prices regardless of
 * which candle overlay is drawn on top.
 *
 * @module lib/currency-index-comparison/indicators
 */

import { computeHrma, computeSmma } from '@/lib/currency-index-pro/math';

import type { IndexCandle } from './series';

/** HRMA_Modified Buffers.mq5 default `len_hrma`. */
export const DEFAULT_HRMA_PERIOD = 36;
/** SMMA_Modified Buffers.mq5 default `InpMAPeriod`. */
export const DEFAULT_SMMA_PERIOD = 13;

export const HRMA_PERIOD_MIN = 2;
export const HRMA_PERIOD_MAX = 200;
export const SMMA_PERIOD_MIN = 2;
export const SMMA_PERIOD_MAX = 200;

export interface IndicatorPoint {
  time: number;
  value: number;
}

/** PRICE_TYPICAL, per GetAppliedPrice() in both .mq5 files. */
export function typicalPrice(candle: IndexCandle): number {
  return (candle.high + candle.low + candle.close) / 3;
}

/**
 * HRMA on typical price. Empty when there are fewer candles than the period,
 * mirroring `if(rates_total < len_hrma) return 0;` -- the MQL5 indicator draws
 * nothing at all in that case rather than a half-converged line.
 */
export function hrmaSeries(
  candles: readonly IndexCandle[],
  period: number
): IndicatorPoint[] {
  if (candles.length < period) return [];
  const values = computeHrma(candles.map(typicalPrice), period);
  return candles.map((c, i) => ({ time: c.time, value: values[i] as number }));
}

/** SMMA on close. Points before the seed (index period - 1) are omitted. */
export function smmaSeries(
  candles: readonly IndexCandle[],
  period: number
): IndicatorPoint[] {
  const values = computeSmma(
    candles.map((c) => c.close),
    period
  );
  const points: IndicatorPoint[] = [];
  candles.forEach((c, i) => {
    const v = values[i];
    if (v !== null && v !== undefined) points.push({ time: c.time, value: v });
  });
  return points;
}

/** *_H1_HA Candles.mq5 OnCalculate(), line for line. */
export function heikinAshi(candles: readonly IndexCandle[]): IndexCandle[] {
  const result: IndexCandle[] = [];
  let prevOpen = 0;
  let prevClose = 0;

  candles.forEach((c, i) => {
    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen = i === 0 ? c.open : (prevOpen + prevClose) / 2;
    const haHigh = Math.max(c.high, Math.max(haOpen, haClose));
    const haLow = Math.min(c.low, Math.min(haOpen, haClose));
    result.push({
      time: c.time,
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
    });
    prevOpen = haOpen;
    prevClose = haClose;
  });

  return result;
}

/**
 * The display-only rebase shift (the Free page's own additive transform,
 * `value + (base - 100)`), applied to a candle. HRMA, SMMA and Heiken Ashi are
 * all affine-equivariant (their weights sum to 1), so shifting their output is
 * identical to computing them on shifted input -- the page shifts at the last
 * step and never recomputes an indicator for a rebase change.
 */
export function shiftCandle(candle: IndexCandle, offset: number): IndexCandle {
  if (offset === 0) return candle;
  return {
    time: candle.time,
    open: candle.open + offset,
    high: candle.high + offset,
    low: candle.low + offset,
    close: candle.close + offset,
  };
}
