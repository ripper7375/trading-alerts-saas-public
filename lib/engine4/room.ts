/**
 * Room to the next opposing level (architecture 6.5, ADR-063, plan decision D8).
 *
 * "A target past the next opposing level is never recommended; the level is
 * named." The next opposing level is the nearest structure level strictly
 * beyond the entry on the profit side: above a BUY's entry, below a SELL's. It
 * is the same rule the zone builder uses for a zone's `next_opposing_level`
 * (`zones.py`, decision D7 (e)), applied to the entry the trader actually
 * chose, which need not be a zone's reference price.
 *
 * D8: a target exactly AT the level is not before it. "Before the next level"
 * means strictly before, so such a target is not recommended either.
 *
 * Levels are prices on the bid chart, and so are the chart levels at which a
 * target triggers (`TargetPlan.targetChartLevel`), so the two compare directly.
 * With a spread of zero that is the same as comparing distances.
 *
 * @module lib/engine4/room
 */

import { Rational, readPositive, type DecimalLike } from './exact';
import { nearestLevel, toStructure, type Level } from './levels';
import type { Side } from './types';

export interface Room {
  /** the next opposing level, or null when nothing lies beyond the entry (unlimited room) */
  level: Level | null;
  /** the distance from the entry to it, or null when there is no level */
  room: Rational | null;
}

/**
 * The nearest structure level strictly beyond `entry` on the profit side.
 * `levels` may be raw (they are put in cents and de-duplicated first); among
 * levels at one price the first by timeframe, name and origin is named.
 */
export function nextOpposingLevel(
  levels: readonly Level[],
  side: Side,
  entry: DecimalLike
): Level | null {
  const price = readPositive('entry', entry);
  const buy = side === 'BUY';
  const beyond = toStructure(levels).filter((level) =>
    buy ? level.price.gt(price) : level.price.lt(price)
  );
  return nearestLevel(beyond, !buy);
}

/** The room ahead of an entry: the next opposing level and how far away it is. */
export function roomAhead(
  levels: readonly Level[],
  side: Side,
  entry: DecimalLike
): Room {
  const price = readPositive('entry', entry);
  const level = nextOpposingLevel(levels, side, price);
  return {
    level,
    room: level === null ? null : level.price.sub(price).abs(),
  };
}

/**
 * True when a target triggering at `targetChartLevel` sits strictly before
 * `level` (D8), or when there is no level at all. A BUY's target is before a
 * level above it when it is lower; a SELL's when it is higher.
 */
export function targetFitsBefore(
  side: Side,
  targetChartLevel: Rational,
  level: Level | null
): boolean {
  if (level === null) return true;
  return side === 'BUY'
    ? targetChartLevel.lt(level.price)
    : targetChartLevel.gt(level.price);
}
