/**
 * What the modal can tell the trader before it asks the server (build step 5, part 7).
 *
 * The modal calls `POST /api/engine4/size` for every set of fields that is worth
 * sizing. A field that is empty, not a number, outside the bound the modal
 * definition showed, or a custom entry outside the day's range is not worth a
 * call: the answer is known, and showing it at once is kinder than a round trip.
 * These functions are the browser's copy of checks 0 to 3 of `validateSetup` and
 * return THE SAME CODES, so one message table (`messages.ts`) serves both. They
 * are a convenience, never an authority: the server runs the real checks on every
 * size and on every consent, and a differential test holds these to the validator
 * across a sweep of inputs.
 *
 * Exact: every comparison is between `Rational`s read from decimal text.
 *
 * @module lib/engine4/templates/fields
 */

import { Rational } from '../exact';
import { Engine4InputError } from '../types';
import {
  readWire,
  type WireEntryBounds,
  type WireOfferedModal,
  type WireStopChoices,
} from './wire';
import type { MessageLimits } from './messages';

type Parsed =
  | { state: 'MISSING' }
  | { state: 'BAD' }
  | { state: 'OK'; value: Rational };

/** Read what the trader typed the way the validator reads a field. */
export function parseTyped(raw: string): Parsed {
  const text = raw.trim();
  if (text === '') return { state: 'MISSING' };
  try {
    return { state: 'OK', value: Rational.of(text) };
  } catch (error) {
    if (error instanceof Engine4InputError) return { state: 'BAD' };
    throw error;
  }
}

/** A failure code of check 1 for the equity, or null. */
export function precheckEquity(raw: string): string | null {
  const parsed = parseTyped(raw);
  if (parsed.state === 'MISSING') return 'EQUITY_MISSING';
  if (parsed.state === 'BAD') return 'EQUITY_NOT_A_NUMBER';
  return parsed.value.isPositive() ? null : 'EQUITY_NOT_POSITIVE';
}

/** A failure code of check 1 for the risk percentage, or null. `max` is Max RPT. */
export function precheckRisk(raw: string, max: string): string | null {
  const parsed = parseTyped(raw);
  if (parsed.state === 'MISSING') return 'RISK_MISSING';
  if (parsed.state === 'BAD') return 'RISK_NOT_A_NUMBER';
  if (!parsed.value.isPositive()) return 'RISK_NOT_POSITIVE';
  return parsed.value.gt(readWire(max)) ? 'RISK_ABOVE_MAX_RPT' : null;
}

/**
 * A failure code of check 2 for the stop distance, or null. A BUY's stop price
 * must stay above zero, so the entry and side are taken when they are known.
 */
export function precheckStop(
  raw: string,
  minDistance: string,
  context?: { side: 'BUY' | 'SELL'; entry: string | null }
): string | null {
  const parsed = parseTyped(raw);
  if (parsed.state === 'MISSING') return 'STOP_MISSING';
  if (parsed.state === 'BAD') return 'STOP_NOT_A_NUMBER';
  if (!parsed.value.isPositive()) return 'STOP_NOT_POSITIVE';
  if (parsed.value.lt(readWire(minDistance))) return 'STOP_BELOW_MIN_SLD';
  if (
    context !== undefined &&
    context.side === 'BUY' &&
    context.entry !== null
  ) {
    // an entry that is not a number gives no stop price to judge (check 0 says so)
    const entry = parseTyped(context.entry);
    if (entry.state === 'OK' && !entry.value.sub(parsed.value).isPositive()) {
      return 'STOP_PRICE_NOT_POSITIVE';
    }
  }
  return null;
}

/** A failure code of check 3 for the RRR, or null. */
export function precheckRrr(
  raw: string,
  bounds: { min: string; max: string; counterTrend: boolean }
): string | null {
  const parsed = parseTyped(raw);
  if (parsed.state === 'MISSING') return 'RRR_MISSING';
  if (parsed.state === 'BAD') return 'RRR_NOT_A_NUMBER';
  if (parsed.value.lt(readWire(bounds.min))) return 'RRR_BELOW_MIN';
  if (parsed.value.gt(readWire(bounds.max))) {
    return bounds.counterTrend
      ? 'RRR_ABOVE_COUNTER_TREND_CAP'
      : 'RRR_ABOVE_MAX';
  }
  return null;
}

/**
 * A failure code of check 0 for an entry of the trader's own, or null. A price
 * equal to one of the zones' reference prices is the zone and always legal; any
 * other must lie inside the typo filter and the widened one-day range, and an
 * unknown bound refuses (it is never a pass).
 */
export function precheckCustomEntry(
  raw: string,
  bounds: WireEntryBounds,
  zonePrices: readonly string[]
): string | null {
  const parsed = parseTyped(raw);
  if (parsed.state === 'MISSING') return 'ENTRY_MISSING';
  if (parsed.state === 'BAD') return 'ENTRY_NOT_A_NUMBER';
  const price = parsed.value;
  if (!price.isPositive()) return 'ENTRY_NOT_POSITIVE';
  if (zonePrices.some((zone) => readWire(zone).eq(price))) return null;
  const { typo, day } = bounds;
  if (typo === null) return 'LIVE_PRICE_UNKNOWN';
  if (day === null) return 'DAY_RANGE_UNKNOWN';
  if (price.lt(readWire(typo.lower)) || price.gt(readWire(typo.upper))) {
    return 'ENTRY_TYPO';
  }
  if (price.lt(readWire(day.lower)) || price.gt(readWire(day.upper))) {
    return 'ENTRY_OUTSIDE_DAY_RANGE';
  }
  return null;
}

/**
 * The range as it is SHOWN to the trader, to two places, rounded INWARD: the low end
 * up and the high end down. The exact bounds are rarely whole cents (a widened day
 * range ends at 4,427.425), and rounding to the nearest would print an edge, 4,427.43,
 * that the check then refuses. Every edge shown here is itself a valid entry.
 */
export function shownEntryRange(
  bounds: WireEntryBounds
): { low: string; high: string } | null {
  const range = allowedEntryRange(bounds);
  if (range === null) return null;
  const low = readWire(range.low).toDecimal(2, 'CEIL');
  const high = readWire(range.high).toDecimal(2, 'FLOOR');
  return readWire(low).gt(readWire(high)) ? null : { low, high };
}

/** The limits the messages quote, taken from the modal's definition. */
export function limitsOf(modal: WireOfferedModal): MessageLimits {
  return {
    riskMax: modal.risk.max,
    stopMin: modal.custom.stopMinDistance,
    rrrMin: modal.rrr.min,
    rrrMax: modal.rrr.max,
  };
}

/** The range a custom entry may take, as text: the stricter of the two bounds, or null when either is unknown. */
export function allowedEntryRange(
  bounds: WireEntryBounds
): { low: string; high: string } | null {
  const { typo, day } = bounds;
  if (typo === null || day === null) return null;
  const low = Rational.max(readWire(typo.lower), readWire(day.lower));
  const high = Rational.min(readWire(typo.upper), readWire(day.upper));
  return low.gt(high) ? null : { low: low.toString(), high: high.toString() };
}

// ---------------------------------------------------------------------------
// The stop the modal opens on, and the distance a choice stands for
// ---------------------------------------------------------------------------

/** What the trader picked for the stop: a structural option (by its stop price), the minimum stop, or their own. */
export type StopSelection =
  | { kind: 'OPTION'; stopPrice: string }
  | { kind: 'MINIMUM' }
  | { kind: 'CUSTOM' };

/**
 * The selection a pill opens on (plan decision D7 (c)): the zone's own stored
 * invalidation when it is a structural option, the minimum stop when the zone's
 * invalidation has no structure behind it, otherwise the nearest option, otherwise
 * a custom stop to be typed. `custom` is the text to put in the custom field.
 */
export function initialStop(choices: WireStopChoices): {
  selection: StopSelection;
  custom: string;
} {
  const pre = choices.preselected;
  if (pre.kind === 'ZONE_INVALIDATION') {
    return pre.option === null
      ? { selection: { kind: 'CUSTOM' }, custom: pre.stopDistance }
      : {
          selection: { kind: 'OPTION', stopPrice: pre.option.stopPrice },
          custom: '',
        };
  }
  if (pre.kind === 'MINIMUM_STOP') {
    return { selection: { kind: 'MINIMUM' }, custom: '' };
  }
  if (pre.kind === 'NEAREST_OPTION') {
    return {
      selection: { kind: 'OPTION', stopPrice: pre.option.stopPrice },
      custom: '',
    };
  }
  return { selection: { kind: 'CUSTOM' }, custom: '' };
}

/** The stop distance (exact text) a selection stands for; a custom stop is what was typed. */
export function stopDistanceFor(
  selection: StopSelection,
  choices: WireStopChoices | null,
  custom: string
): string {
  if (choices === null) return custom;
  if (selection.kind === 'OPTION') {
    const found = choices.structural.find(
      (option) => option.stopPrice === selection.stopPrice
    );
    return found === undefined ? custom : found.stopDistance;
  }
  if (selection.kind === 'MINIMUM') {
    return choices.minimumStop === null
      ? custom
      : choices.minimumStop.stopDistance;
  }
  return custom;
}

/** The same choice? */
export function sameStopSelection(a: StopSelection, b: StopSelection): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind === 'OPTION' && b.kind === 'OPTION'
    ? a.stopPrice === b.stopPrice
    : true;
}
