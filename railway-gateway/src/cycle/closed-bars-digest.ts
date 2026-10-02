import { createHash } from 'crypto';
import { TIMEFRAMES, Timeframe, lastClosedBarOpen } from './slot';
import { ONE_DAY_CLOSED_BARS } from './windows';

/**
 * The closed-bar digest stored on market_cycles when a cycle is declared ready
 * (STACK-D-ARCHITECTURE.md section 1.8: "replaying a slot returns the same
 * closed bars"; replay scope decided 2026-10-01).
 *
 * WHAT IT COVERS. The OHLC spine only: for each timeframe, the newest 288 (M5) /
 * 96 (M15) bars that are closed at the slot, as [open time, open, high, low,
 * close, volume]. Indicator columns are left out on purpose: they are refit by
 * every later cycle (the look-ahead bias this pipeline measured), so including
 * them would make every replay differ. Whether to freeze them per cycle is
 * build step 3's call.
 *
 * WHAT IT IS FOR. A later reader recomputes the digest for the same slot from
 * market_data_v6 and compares. A difference means a closed bar's OHLC changed
 * after the cycle was declared ready, which is exactly the case section 1's
 * open question about the newest row raises: if the newest "closed" bar was
 * exported a second before it closed, a later cycle upserts its final values.
 * The digest makes that visible instead of silent.
 *
 * Pure: bars in, hex string out. The database read is the caller's.
 */

/** Bumped whenever the canonical form changes, so two digests are comparable only under one definition. */
export const SPINE_DIGEST_VERSION = 'spine/1';

export interface SpineBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type ClosedSpine = Record<Timeframe, SpineBar[]>;

const FIELDS: ReadonlyArray<keyof SpineBar> = [
  'timestamp',
  'open',
  'high',
  'low',
  'close',
  'volume',
];

function row(bar: SpineBar): number[] {
  return FIELDS.map((field) => {
    const value = bar[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      // A NaN or a missing value would serialise as null and hash happily.
      throw new RangeError(
        `bar at ${String(bar.timestamp)} has no usable ${field}: ${String(value)}`
      );
    }
    return value;
  });
}

/** The exact text that is hashed: stable key order, bars oldest to newest. */
export function canonicalSpine(spine: ClosedSpine): string {
  const body: Record<string, number[][]> = {};
  for (const timeframe of TIMEFRAMES) {
    const sorted = [...spine[timeframe]].sort(
      (a, b) => a.timestamp - b.timestamp
    );
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].timestamp === sorted[i - 1].timestamp) {
        throw new RangeError(
          `${timeframe} has two bars at ${sorted[i].timestamp}`
        );
      }
    }
    body[timeframe] = sorted.map(row);
  }
  return `${SPINE_DIGEST_VERSION}\n${JSON.stringify(body)}`;
}

/** SHA-256, lower-case hex, of the canonical spine. */
export function digestClosedSpine(spine: ClosedSpine): string {
  return createHash('sha256').update(canonicalSpine(spine)).digest('hex');
}

/**
 * How the caller fetches bars: the newest `take` rows of a timeframe whose open
 * time is at or before `maxOpenTime`, any order.
 */
export type FetchBars = (
  timeframe: Timeframe,
  maxOpenTime: number,
  take: number
) => Promise<SpineBar[]>;

/**
 * Load the one-day closed spine as of a slot. "Closed at the slot" is rule 2
 * (open time + period at or before the slot), which for grid-aligned bars is
 * "open time at or before lastClosedBarOpen": the newest closed bar and
 * everything older. A bar still forming at the slot is never read.
 */
export async function loadClosedSpine(
  fetchBars: FetchBars,
  slot: number
): Promise<ClosedSpine> {
  const spine = {} as ClosedSpine;
  for (const timeframe of TIMEFRAMES) {
    const bars = await fetchBars(
      timeframe,
      lastClosedBarOpen(timeframe, slot),
      ONE_DAY_CLOSED_BARS[timeframe]
    );
    spine[timeframe] = [...bars].sort((a, b) => a.timestamp - b.timestamp);
  }
  return spine;
}
