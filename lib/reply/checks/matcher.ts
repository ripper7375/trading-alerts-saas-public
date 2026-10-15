/**
 * Judging one numeric literal against the value dictionary (build step 7 part 4; architecture 5.8).
 *
 * A literal matches when ANY of its readings equals ANY eligible entry of the dictionary within that
 * entry's tolerance. What is eligible depends on how the literal was written:
 *   a clock (`21:00`)                 the times
 *   a percentage (`82%`, `82 percent`) the percentages
 *   a ratio or a multiple (`1:2.5`, `2.5x`) the ratios
 *   money (`$0.50`, `50 USD`)          the prices and the dollar distances
 *   a bare number (`4350.72`)          prices, distances, ratios, percentages and counts
 * so a figure is never excused by a value of another kind with the same digits.
 *
 * "Within tolerance" is decided on integers (millionths), not on floating point, because the line
 * between 4350.27 (passes against 4350.22) and 4350.28 (fails) has to be exact. A time matches to
 * the minute, or to the second when the literal gives seconds.
 *
 * Pure.
 *
 * @module lib/reply/checks/matcher
 */

import type { NumberClass } from '../contracts/trace-fields';
import type { ExtractedNumber, LiteralSyntax } from './extract';
import type { ValueDictionary, ValueEntry } from './value-dictionary';

const MICRO = 1_000_000;
const micro = (value: number): number => Math.round(value * MICRO);

const SECONDS_PER_DAY = 86_400;

/** The kinds of entry a literal can be matched against, by how it was written. */
export const ELIGIBLE_KINDS: Readonly<
  Record<LiteralSyntax, readonly NumberClass[]>
> = {
  CLOCK: ['TIME'],
  PERCENT: ['PCT'],
  RATIO: ['RATIO'],
  MONEY: ['PRICE', 'DISTANCE'],
  BARE: ['PRICE', 'DISTANCE', 'RATIO', 'PCT', 'COUNT'],
};

export interface MatchResult {
  matched: boolean;
  /** the entry it matched; null when none */
  entry: ValueEntry | null;
}

/** Whether a literal equals one entry. */
export function entryMatches(
  entry: ValueEntry,
  literal: ExtractedNumber
): boolean {
  if (!ELIGIBLE_KINDS[literal.syntax].includes(entry.kind)) return false;
  if (literal.syntax === 'CLOCK') {
    if (literal.clock === null) return false;
    const secondOfDay =
      ((entry.value % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
    return literal.clock.second === null
      ? Math.floor(secondOfDay / 60) === literal.clock.minuteOfDay
      : secondOfDay === literal.clock.minuteOfDay * 60 + literal.clock.second;
  }
  const stored = micro(entry.value);
  const allowed = micro(entry.tolerance);
  return literal.readings.some(
    (reading) => Math.abs(micro(reading) - stored) <= allowed
  );
}

/** Judge a literal against the whole dictionary. */
export function matchLiteral(
  literal: ExtractedNumber,
  dictionary: ValueDictionary
): MatchResult {
  for (const entry of dictionary.entries) {
    if (entryMatches(entry, literal)) return { matched: true, entry };
  }
  return { matched: false, entry: null };
}

/**
 * What an unmatched literal was, for the dashboard (the class counts of the trace). Decided by how
 * it was written and its size, not by the dictionary, because nothing in the dictionary matched:
 * a clock is a time, a percentage a percentage, a ratio or a multiple a ratio, money a price from
 * $1,000 and a distance below; a bare whole number a price from 1,000 and a count below; a bare
 * number with decimals a price from 1,000, a dollar distance from 10 and a ratio below.
 */
export function classOf(literal: ExtractedNumber): NumberClass {
  switch (literal.syntax) {
    case 'CLOCK':
      return 'TIME';
    case 'PERCENT':
      return 'PCT';
    case 'RATIO':
      return 'RATIO';
    default:
      break;
  }
  if (literal.readings.length === 0) return 'PRICE';
  const size = Math.max(...literal.readings);
  if (literal.syntax === 'MONEY') return size >= 1000 ? 'PRICE' : 'DISTANCE';
  if (size >= 1000) return 'PRICE';
  if (literal.integer) return 'COUNT';
  return size >= 10 ? 'DISTANCE' : 'RATIO';
}
