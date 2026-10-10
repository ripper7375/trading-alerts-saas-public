/**
 * The bound on a custom entry price (architecture 3.6 and 6.10 check 0,
 * ADR-034, plan assumption A3).
 *
 * A zone's own reference price is always a legal entry (the zone builder made
 * it). A CUSTOM entry, one the trader types in the modal or in chat, must lie
 * inside the one-day range widened by half its height, and inside 5% of the live
 * price, which stays only as a typo filter (at gold near 4,400 five percent is
 * about 220 dollars, far more than a day's range).
 *
 * The one-day range is the highest high and the lowest low of the CLOSED M5
 * bars of the last 24 hours (A3): a bar is closed when its open time plus five
 * minutes is not after `now`, and it is inside the day when it opened no earlier
 * than `now` minus 24 hours. If no such bar exists, or one of them is not
 * well formed, the range is UNKNOWN and a custom entry is refused: nothing is
 * guessed. The live price is the newest cycle's reference price (the last closed
 * M5 close, ADR-086), which can be five minutes old.
 *
 * Both edges are inclusive: an entry exactly on a bound is accepted. All
 * figures are exact (`Rational`); the clock is passed in.
 *
 * @module lib/engine4/entry-bound
 */

import { Rational, readPositive, type DecimalLike } from './exact';
import { DAY_SECONDS, readSeconds } from './time';
import { Engine4InputError } from './types';

/** An M5 bar lasts five minutes. */
export const M5_SECONDS = 300n;
/** The typo filter: the entry must be within this fraction of the live price. */
export const ENTRY_TYPO_FRACTION = '0.05';

/** What the range needs of an M5 bar (`market_data_v6`: `timestamp`, `high`, `low`). */
export interface DayBar {
  /** unix UTC seconds when the bar opened */
  openTime: DecimalLike;
  high: DecimalLike;
  low: DecimalLike;
}

export type DayRangeProblemCode = 'NO_CLOSED_BARS' | 'BAD_BAR';

export type DayRange =
  | {
      ok: true;
      high: Rational;
      low: Rational;
      /** high minus low */
      height: Rational;
      /** the low less half the height */
      lower: Rational;
      /** the high plus half the height */
      upper: Rational;
      /** how many closed bars the range is made of */
      barCount: number;
      /** the open time of the oldest of them */
      firstOpen: bigint;
      /** the close time of the newest of them */
      lastClose: bigint;
    }
  | { ok: false; code: DayRangeProblemCode; detail: string };

const HALF = Rational.fromFraction(1n, 2n);

/**
 * The one-day range as of `nowSeconds`, from the bars handed in (any order; bars
 * outside the last 24 hours and bars still forming are ignored). A bar that is
 * not readable, or whose high is below its low, makes the whole range unknown.
 */
export function dayRange(
  bars: readonly DayBar[],
  nowSeconds: DecimalLike
): DayRange {
  const now = readSeconds('nowSeconds', nowSeconds);
  const windowStart = now - DAY_SECONDS;

  const closed: {
    open: bigint;
    close: bigint;
    high: Rational;
    low: Rational;
  }[] = [];
  for (const bar of bars) {
    let open: bigint;
    let barHigh: Rational;
    let barLow: Rational;
    try {
      open = readSeconds('openTime', bar.openTime);
      barHigh = readPositive('high', bar.high);
      barLow = readPositive('low', bar.low);
    } catch (error) {
      if (!(error instanceof Engine4InputError)) throw error;
      return { ok: false, code: 'BAD_BAR', detail: error.message };
    }
    if (barHigh.lt(barLow)) {
      return {
        ok: false,
        code: 'BAD_BAR',
        detail: `a bar opened at ${open.toString()} has a high below its low`,
      };
    }
    const close = open + M5_SECONDS;
    if (open < windowStart || close > now) continue;
    closed.push({ open, close, high: barHigh, low: barLow });
  }

  const [first, ...rest] = closed;
  if (first === undefined) {
    return {
      ok: false,
      code: 'NO_CLOSED_BARS',
      detail: 'there is no closed M5 bar in the last 24 hours',
    };
  }
  let high = first.high;
  let low = first.low;
  let firstOpen = first.open;
  let lastClose = first.close;
  for (const bar of rest) {
    if (bar.high.gt(high)) high = bar.high;
    if (bar.low.lt(low)) low = bar.low;
    if (bar.open < firstOpen) firstOpen = bar.open;
    if (bar.close > lastClose) lastClose = bar.close;
  }
  const height = high.sub(low);
  const half = height.mul(HALF);
  return {
    ok: true,
    high,
    low,
    height,
    lower: low.sub(half),
    upper: high.add(half),
    barCount: closed.length,
    firstOpen,
    lastClose,
  };
}

/** A lower and an upper bound, both inclusive. */
export interface Bound {
  lower: Rational;
  upper: Rational;
}

/** The two bounds, each null when it cannot be worked out. */
export interface EntryBounds {
  /** the one-day range widened by half its height */
  day: Bound | null;
  /** 95% and 105% of the live price */
  typo: Bound | null;
}

function readLive(livePrice: DecimalLike | null): Rational | null {
  try {
    return readPositive('livePrice', livePrice);
  } catch (error) {
    if (error instanceof Engine4InputError) return null;
    throw error;
  }
}

export function entryBounds(
  range: DayRange,
  livePrice: DecimalLike | null
): EntryBounds {
  const live = readLive(livePrice);
  const fraction = Rational.of(ENTRY_TYPO_FRACTION);
  return {
    day: range.ok ? { lower: range.lower, upper: range.upper } : null,
    typo:
      live === null
        ? null
        : {
            lower: live.sub(live.mul(fraction)),
            upper: live.add(live.mul(fraction)),
          },
  };
}

export type EntryBoundCode =
  | 'LIVE_PRICE_UNKNOWN'
  | 'DAY_RANGE_UNKNOWN'
  | 'ENTRY_TYPO'
  | 'ENTRY_OUTSIDE_DAY_RANGE';

export type EntryBoundResult =
  | { ok: true; bounds: EntryBounds }
  | { ok: false; code: EntryBoundCode; detail: string; bounds: EntryBounds };

/**
 * Check 0 for a custom entry. The typo filter is looked at first (it is the
 * more telling message), then the day range; an unknown live price or range is
 * a refusal, never a pass.
 */
export function checkEntryBound(
  entry: DecimalLike,
  range: DayRange,
  livePrice: DecimalLike | null
): EntryBoundResult {
  const price = readPositive('entry', entry);
  const bounds = entryBounds(range, livePrice);
  const refuse = (code: EntryBoundCode, detail: string): EntryBoundResult => ({
    ok: false,
    code,
    detail,
    bounds,
  });

  const { typo, day } = bounds;
  if (typo === null) {
    return refuse('LIVE_PRICE_UNKNOWN', 'the live price is not known');
  }
  if (day === null) {
    return refuse(
      'DAY_RANGE_UNKNOWN',
      range.ok ? 'the one-day range is not known' : range.detail
    );
  }
  if (price.lt(typo.lower) || price.gt(typo.upper)) {
    return refuse(
      'ENTRY_TYPO',
      `the entry is more than 5% from the live price (${typo.lower.toString()} to ${typo.upper.toString()})`
    );
  }
  if (price.lt(day.lower) || price.gt(day.upper)) {
    return refuse(
      'ENTRY_OUTSIDE_DAY_RANGE',
      `the entry is outside the one-day range widened by half its height (${day.lower.toString()} to ${day.upper.toString()})`
    );
  }
  return { ok: true, bounds };
}
