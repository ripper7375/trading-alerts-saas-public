/**
 * Currency Index PRO Plan — Phase 1 corridor math.
 *
 * Pure functions only (no Prisma, no I/O) so the spec's Section 3.2 formulas
 * can be unit-tested directly against hand-computed examples, independent of
 * the aggregator service's own orchestration/idempotency logic.
 *
 * @module worker/currency-index-corridor-math
 */

/** The 8 G8 currency indices the PRO screener covers. Never XAUX — it has
 * its own unrelated 01:01 server-time rollover and isn't part of this plan. */
export const FX_INDEX_NAMES = [
  'USDX',
  'EURX',
  'GBPX',
  'JPYX',
  'AUDX',
  'CADX',
  'CHFX',
  'NZDX',
] as const;

export interface CurrencyIndexBar {
  bar_time: number;
  value: number;
  change_pct: number;
}

export interface DailyMetricsSummary {
  open_value: number;
  peak_high_pct: number;
  peak_low_pct: number;
  close_pct: number;
}

/**
 * Summarizes one index's bars for one closed trading day into the 4 fields
 * DailyCurrencyIndexMetrics stores. `bars` must already be filtered to the
 * single day's [session_open_bar_time, nextSessionOpen) window and sorted
 * ascending by bar_time — this function trusts that ordering rather than
 * re-sorting, since the caller already queries in that order.
 *
 * Returns null for an empty day (this index had no data at all that day) —
 * the caller skips rather than fabricates a row.
 */
export function summarizeDayMetrics(
  bars: CurrencyIndexBar[]
): DailyMetricsSummary | null {
  if (bars.length === 0) return null;

  // Seeded from the first real bar, not a hardcoded 0 -- a day's window is
  // expected to start at its own session-open bar (change_pct === 0 there
  // by construction), but seeding from an assumed value rather than an
  // actually observed one would fabricate a reference point if that bar
  // were ever missing from the query result.
  let peakHigh = bars[0].change_pct;
  let peakLow = bars[0].change_pct;
  for (const bar of bars) {
    if (bar.change_pct > peakHigh) peakHigh = bar.change_pct;
    if (bar.change_pct < peakLow) peakLow = bar.change_pct;
  }

  return {
    open_value: bars[0].value,
    peak_high_pct: peakHigh,
    peak_low_pct: Math.abs(peakLow),
    close_pct: bars[bars.length - 1].change_pct,
  };
}

export interface VolatilityCorridor {
  mean_excursion: number;
  std_dev: number;
  strike_zone_pct: number;
  extreme_zone_pct: number;
}

/**
 * Spec Section 3.2's Dynamic Volatility Corridor formula, applied to a flat
 * pool of E_(c,d) = (peak_high_pct + peak_low_pct) / 2 excursion values
 * across every (currency, day) pair in the lookback window — a POOLED
 * mean/std across all 8*N points, not an average of 8 per-currency
 * means, per the spec's own mu_basket/sigma_basket definition
 * (sum over c AND d, divided by 8N).
 *
 * Returns null for an empty pool (Lane 4 bootstrap: no prior closed days
 * exist yet) — the caller skips corridor computation entirely rather than
 * divide by zero.
 */
export function computeVolatilityCorridor(
  excursions: number[]
): VolatilityCorridor | null {
  const n = excursions.length;
  if (n === 0) return null;

  const mean = excursions.reduce((sum, e) => sum + e, 0) / n;
  // Sample variance (n-1 denominator, matching the spec's "8N - 1"); a
  // single-point pool has no spread to measure, so std_dev is 0 rather than
  // NaN or Infinity.
  const variance =
    n > 1
      ? excursions.reduce((sum, e) => sum + (e - mean) ** 2, 0) / (n - 1)
      : 0;
  const stdDev = Math.sqrt(variance);

  return {
    mean_excursion: mean,
    std_dev: stdDev,
    strike_zone_pct: mean,
    extreme_zone_pct: mean + stdDev,
  };
}
