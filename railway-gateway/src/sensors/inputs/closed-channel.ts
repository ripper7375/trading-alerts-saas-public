import { MAX_CLOSED_BARS_PER_READ } from '../../cycle/read/read-types';
import { TIMEFRAMES, Timeframe, TIMEFRAME_SECONDS } from '../../cycle/slot';
import { ONE_DAY_CLOSED_BARS } from '../../cycle/windows';
import type { StatisticsRecord } from './bundle-types';

/**
 * How many closed bars the loader hands over per timeframe (ADR-083).
 *
 * The loader supplies the WHOLE closed channel and does no window arithmetic. The
 * windows (MCD2: `min(T_EDT - 1, 288)`, MCD1: `N_micro`, MCD3: `T_EDT - 1`) are in
 * the evaluators at 2.0.1, so there is exactly one implementation of them. The
 * channel's last row is the still-open bar, so on closed bars it holds
 * `T_EDT - 1` rows; the loader asks for `T_EDT` (the oldest of them may carry no
 * band, which no evaluator reads) and never subtracts anything itself.
 *
 *   - `T_EDT` of a timeframe is the largest of `containment_n`,
 *     `visual_window_bars` and `window_bars` of the ACTIVE indicator's statistics
 *     row. The evaluators take the first of them that is a number, so the largest
 *     is always enough; capped at what one read can ask for (3,000 bars, the length
 *     of the export window).
 *   - With no `T_EDT` (no row at the slot, or none of the three is a number) the
 *     loader sends one day (288 M5, 96 M15), which is what the evaluators fall
 *     back to; the readings there are STALE or INVALID by their own checks anyway.
 *   - One cross-timeframe rule: MCD3 reads the M5 channel's window and needs a
 *     closed M15 bar at or before its first bar (INSUFFICIENT_BARS otherwise). So
 *     the M15 supply also covers the M5 channel in time, `ceil(T_M5 / 3)` plus a
 *     margin. Without it a short M15 channel next to a long M5 one would make the
 *     LOADER the reason for an INVALID reading although the bars are in the table.
 *
 * Fewer bars in the table than asked for are handed over as they are: never padded,
 * never shortened silently (the evaluator answers INSUFFICIENT_BARS).
 */

/** Statistics fields that hold a channel's length, in the order the evaluators try them (`T_EDT_FIELDS`). */
export const CHANNEL_LENGTH_FIELDS = [
  'containment_n',
  'visual_window_bars',
  'window_bars',
] as const;

/** Closed M15 bars asked for beyond the ones that cover the M5 channel, for the bar a window boundary falls inside. */
export const M15_COVER_MARGIN_BARS = 2;

/** The largest channel length in a statistics row, or null when it holds none. */
export function channelLength(
  row: StatisticsRecord | undefined | null
): number | null {
  let best: number | null = null;
  for (const field of CHANNEL_LENGTH_FIELDS) {
    const value = row?.[field];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 1) {
      const whole = Math.floor(value);
      if (best === null || whole > best) best = whole;
    }
  }
  return best;
}

function capped(count: number): number {
  return Math.min(count, MAX_CLOSED_BARS_PER_READ);
}

/** Closed bars to ask for, per timeframe, given the active indicator's statistics row of each (undefined: none at the slot). */
export function closedBarsToSupply(
  activeRows: Partial<Record<Timeframe, StatisticsRecord | undefined>>
): Record<Timeframe, number> {
  const out = {} as Record<Timeframe, number>;
  for (const timeframe of TIMEFRAMES) {
    out[timeframe] = capped(
      channelLength(activeRows[timeframe]) ?? ONE_DAY_CLOSED_BARS[timeframe]
    );
  }
  const m5Channel = channelLength(activeRows.M5);
  if (m5Channel !== null) {
    const cover = Math.ceil(
      (m5Channel * TIMEFRAME_SECONDS.M5) / TIMEFRAME_SECONDS.M15
    );
    out.M15 = Math.max(out.M15, capped(cover + M15_COVER_MARGIN_BARS));
  }
  return out;
}
