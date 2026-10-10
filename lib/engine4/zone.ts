/**
 * A stored entry zone as Engine 4 reads it (architecture 3.6 and 3.9).
 *
 * The zone builder stores one invalidation and one next opposing level per
 * zone; everything else Engine 4 needs it rebuilds from the stored levels. This
 * file is only the shape of a zone and a strict reader of the JSON the worker
 * writes for it (`zones_json` of a synthesis reading, the rows of
 * `entry_zones`). A zone that is not well formed reads as null: nothing is
 * guessed.
 *
 * @module lib/engine4/zone
 */

import type { Rational } from './exact';
import { decimalOrNull, isRecord, levelFromStored, type Level } from './levels';

export type ZoneBias = 'LONG' | 'SHORT';

/** What the invalidation sits on (ADR-032, ADR-089). */
export type InvalidationBasis = 'LEVEL' | 'MINIMUM_STOP' | 'NO_LEVEL';
const BASES: readonly string[] = ['LEVEL', 'MINIMUM_STOP', 'NO_LEVEL'];

export interface ZoneInput {
  /** Z1 to Z5: always `Z<rank>`, rank 1 is the best zone */
  zoneId: string;
  bias: ZoneBias;
  low: Rational;
  high: Rational;
  /** the zone's entry price: its pill in the modal */
  referencePrice: Rational;
  invalidationPrice: Rational;
  invalidationBasis: InvalidationBasis;
  /** the structure level past the zone that was looked at; null exactly when the basis is NO_LEVEL */
  invalidationLevel: Level | null;
  /** from the reference price to the invalidation, at least $13 */
  stopDistance: Rational;
  /** the nearest structure level beyond the reference price; null when nothing lies beyond it */
  nextOpposingLevel: Level | null;
  runway: Rational | null;
  runwayRatio: Rational | null;
}

function positive(value: unknown): Rational | null {
  const parsed = decimalOrNull(value);
  return parsed !== null && parsed.isPositive() ? parsed : null;
}

function levelOrNull(
  value: unknown
): { ok: true; level: Level | null } | { ok: false } {
  if (value === null) return { ok: true, level: null };
  const level = levelFromStored(value);
  return level === null ? { ok: false } : { ok: true, level };
}

/**
 * Read one zone as the worker stores it: `{ zone_id, rank, bias, low, high,
 * reference_price, invalidation_price, invalidation_basis, invalidation_level,
 * stop_distance, next_opposing_level, runway, runway_ratio, ... }`. Returns
 * null when anything is missing or of the wrong kind.
 */
export function zoneFromStored(raw: unknown): ZoneInput | null {
  if (!isRecord(raw)) return null;
  const zoneId = raw['zone_id'];
  const bias = raw['bias'];
  const basis = raw['invalidation_basis'];
  const rank = decimalOrNull(raw['rank']);
  const low = positive(raw['low']);
  const high = positive(raw['high']);
  const reference = positive(raw['reference_price']);
  const invalidation = positive(raw['invalidation_price']);
  const stop = positive(raw['stop_distance']);
  const invalidationLevel = levelOrNull(raw['invalidation_level']);
  const opposing = levelOrNull(raw['next_opposing_level']);
  const runway = raw['runway'] === null ? null : positive(raw['runway']);
  const ratio =
    raw['runway_ratio'] === null ? null : decimalOrNull(raw['runway_ratio']);
  if (
    typeof zoneId !== 'string' ||
    !/^Z[1-5]$/.test(zoneId) ||
    (bias !== 'LONG' && bias !== 'SHORT') ||
    typeof basis !== 'string' ||
    !BASES.includes(basis) ||
    rank === null ||
    `Z${rank.toString()}` !== zoneId ||
    low === null ||
    high === null ||
    reference === null ||
    invalidation === null ||
    stop === null ||
    !invalidationLevel.ok ||
    !opposing.ok ||
    (raw['runway'] !== null && runway === null) ||
    (raw['runway_ratio'] !== null && ratio === null)
  ) {
    return null;
  }
  return {
    zoneId,
    bias,
    low,
    high,
    referencePrice: reference,
    invalidationPrice: invalidation,
    invalidationBasis: basis as InvalidationBasis,
    invalidationLevel: invalidationLevel.level,
    stopDistance: stop,
    nextOpposingLevel: opposing.level,
    runway,
    runwayRatio: ratio,
  };
}

/**
 * Read one row of `entry_zones` (the table the gateway fills from a synthesis
 * reading's `zones_json`): flat columns for the prices and a `levels` JSON for
 * the levels behind them (`source_levels`, `confluence_levels`,
 * `invalidation_level`, `next_opposing_level`). It is the same zone as
 * `zoneFromStored` reads from `zones_json`, and null on the same grounds, plus
 * one: the flat `next_opposing_price` column must say what the level in
 * `levels` says, so a row whose two halves disagree is not used.
 */
export function zoneFromEntryRow(row: unknown): ZoneInput | null {
  if (!isRecord(row)) return null;
  const levels = row['levels'];
  if (!isRecord(levels)) return null;
  const zone = zoneFromStored({
    zone_id: row['zone_id'],
    rank: row['rank'],
    bias: row['bias'],
    low: row['low'],
    high: row['high'],
    reference_price: row['reference_price'],
    invalidation_price: row['invalidation_price'],
    invalidation_basis: row['invalidation_basis'],
    invalidation_level: levels['invalidation_level'],
    stop_distance: row['stop_distance'],
    next_opposing_level: levels['next_opposing_level'],
    runway: row['runway'],
    runway_ratio: row['runway_ratio'],
  });
  if (zone === null) return null;
  const column = row['next_opposing_price'];
  if (zone.nextOpposingLevel === null) return column === null ? zone : null;
  const price = decimalOrNull(column);
  return price !== null && price.eq(zone.nextOpposingLevel.price) ? zone : null;
}

/**
 * Rank order: Z1 before Z2 and so on (the id is always `Z<rank>`, so the order of
 * the text is the order of the rank). For `Array.prototype.sort`.
 */
export function byRank(
  a: Pick<ZoneInput, 'zoneId'>,
  b: Pick<ZoneInput, 'zoneId'>
): number {
  return a.zoneId < b.zoneId ? -1 : a.zoneId > b.zoneId ? 1 : 0;
}
