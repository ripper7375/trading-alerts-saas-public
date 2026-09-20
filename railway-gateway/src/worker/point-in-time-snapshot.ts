import { MarketDataDto } from '../gateway/dto/market-data.dto';

/**
 * Point-in-time snapshot construction for `market_data_point_in_time`.
 *
 * WHY THIS EXISTS
 *
 * `market_data_v6` is upserted on `(symbol, timeframe, timestamp)`, and the
 * collector re-queues every in-window bar on every cycle, so a bar's row is
 * rewritten for ~3000 bars before MT5 stops exporting it and the row freezes.
 * The indicators' fitting window re-anchors to the live bar each pass, so the
 * stored value for bar T ends up computed with price action from well after T.
 * Correct for live alerting and charts; textbook look-ahead bias for anything
 * reading stored history.
 *
 * Measured on two real MT5 captures 12 days apart (2114 overlapping M15 bars):
 * `*_uoedt` moved on 100% of comparable bars by a mean of 19.26 USD — 14% of
 * the median EDT channel width — and `*_crossing`, a boolean signal flag,
 * flipped on 0.71%. See HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md.
 *
 * This module answers one question per incoming row: is this the first sighting
 * of a bar that has already closed, and if so what should be frozen?
 *
 * Pure and I/O-free on purpose. The decision (eligibility, age, which columns)
 * is the part worth testing exhaustively; the insert is one Prisma call.
 */

/** Bar length in seconds for every timeframe this pipeline carries. */
export const TIMEFRAME_SECONDS: Readonly<Record<string, number>> = {
  M5: 300,
  M15: 900,
};

/**
 * The 69 columns whose historical values are rewritten and therefore need
 * freezing. Ordered by source, matching the generated Prisma model.
 *
 * NOT a copy of the 95-field contract, deliberately: the OHLCV spine, the
 * causal z-score triple (`InpZScoreLength` is a trailing window) and the
 * ZigZag metrics (confirmed pivots measured at 0.0% drift) are stable, so
 * duplicating them would cost storage and buy nothing. A consumer needing them
 * joins `market_data_v6` on the same key — safe precisely because those are
 * the columns that do not move.
 *
 * Kept in sync with the Prisma model by test/point-in-time-snapshot.spec.ts,
 * which reads the model back out of schema.prisma rather than trusting this
 * list. The generator that produced the model derives the same set from the
 * collector's SOURCES registry, so all three agree or a test fails.
 */
export const SNAPSHOT_COLUMNS = [
  'best_fit_a_horiz_high_map',
  'best_fit_a_horiz_low_map',
  'best_fit_a_ssa',
  'best_fit_a_ema_ssa',
  'best_fit_a_crossing',
  'best_fit_a_base_fl',
  'best_fit_a_uoedt',
  'best_fit_a_loedt',
  'best_fit_b_horiz_high_map',
  'best_fit_b_horiz_low_map',
  'best_fit_b_ssa',
  'best_fit_b_ema_ssa',
  'best_fit_b_crossing',
  'best_fit_b_base_fl',
  'best_fit_b_uoedt',
  'best_fit_b_loedt',
  'cherry_a_horiz_high_map',
  'cherry_a_horiz_low_map',
  'cherry_a_ssa',
  'cherry_a_ema_ssa',
  'cherry_a_crossing',
  'cherry_a_base_fl',
  'cherry_a_uoedt',
  'cherry_a_loedt',
  'cherry_b_horiz_high_map',
  'cherry_b_horiz_low_map',
  'cherry_b_ssa',
  'cherry_b_ema_ssa',
  'cherry_b_crossing',
  'cherry_b_base_fl',
  'cherry_b_uoedt',
  'cherry_b_loedt',
  'most_recent_horiz_high_map',
  'most_recent_horiz_low_map',
  'most_recent_ssa',
  'most_recent_ema_ssa',
  'most_recent_crossing',
  'most_recent_base_fl',
  'most_recent_uoedt',
  'most_recent_loedt',
  'non_a_horiz_high_map',
  'non_a_horiz_low_map',
  'non_a_ssa',
  'non_a_ema_ssa',
  'non_a_crossing',
  'non_a_base_fl',
  'non_a_uoedt',
  'non_a_loedt',
  'non_b_horiz_high_map',
  'non_b_horiz_low_map',
  'non_b_ssa',
  'non_b_ema_ssa',
  'non_b_crossing',
  'non_b_base_fl',
  'non_b_uoedt',
  'non_b_loedt',
  'fractal_best_fl',
  'fractal_uoedt',
  'fractal_loedt',
  'best_resistance',
  'best_support',
  'sr_1',
  'sr_2',
  'sr_3',
  'sr_4',
  'sr_5',
  'sr_6',
  'sr_7',
  'sr_8',
] as const;

export interface PointInTimeSnapshot {
  timestamp: number;
  symbol: string;
  timeframe: string;
  first_seen_at: number;
  snapshot_age_bars: number;
  cycle_id: number | null;
  collected_at: number | null;
  [column: string]: number | string | null;
}

/**
 * How many whole bar periods had elapsed between the bar closing and `nowSec`.
 *
 * 0 means the bar is STILL FORMING. The newest row in every export is the
 * currently-forming bar (the exporters loop down to shift 0, and the completeness
 * check requires it), so this is the common case and it must not be snapshotted —
 * its OHLC is partial and its indicator values are provisional.
 *
 * 1 is the honest value: the bar has closed and this is the first cycle after.
 * Anything larger means the push worker was behind, and the snapshot carries
 * that many bars of hindsight. Recorded rather than rejected, because rejecting
 * would silently leave gaps while recording lets a consumer decide.
 */
export function barAgeInPeriods(
  barTimestamp: number,
  timeframe: string,
  nowSec: number
): number | null {
  const period = TIMEFRAME_SECONDS[timeframe];
  if (!period) return null;
  const elapsed = nowSec - barTimestamp;
  if (elapsed < 0) return 0; // clock skew: treat as still forming, never snapshot
  return Math.floor(elapsed / period);
}

/**
 * Build the row to freeze, or null if this payload must not be snapshotted.
 *
 * Returns null when the bar is still forming, or the timeframe is unknown.
 * Deliberately NOT null for a late row: a late snapshot with an honest
 * `snapshot_age_bars` is more useful than no row, and the alternative — a gap —
 * is indistinguishable from "the indicator had nothing to say".
 */
export function buildSnapshot(
  data: MarketDataDto,
  nowSec: number
): PointInTimeSnapshot | null {
  const age = barAgeInPeriods(data.timestamp, data.timeframe, nowSec);
  if (age === null || age < 1) return null;

  const row: PointInTimeSnapshot = {
    timestamp: data.timestamp,
    symbol: data.symbol,
    timeframe: data.timeframe,
    first_seen_at: nowSec,
    snapshot_age_bars: age,
    cycle_id: data.cycle_id ?? null,
    collected_at: data.collected_at ?? null,
  };

  const source = data as unknown as Record<string, unknown>;
  for (const column of SNAPSHOT_COLUMNS) {
    const value = source[column];
    // `undefined` and `null` both mean "the indicator had no value for this
    // bar" and must both land as SQL NULL. Coercing either to 0 would invent a
    // $0.00 price level — the exact defect the collector's own ingestion guard
    // exists to prevent.
    row[column] =
      value === undefined || value === null ? null : (value as number);
  }
  return row;
}
