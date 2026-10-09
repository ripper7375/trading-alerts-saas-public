/**
 * Structure levels: the TypeScript twin of the level assembly in
 * `davintrade-stack-d-and-e/engine-1-5-new/mcd_worker/synthesis/zones.py`
 * (`levels_from_readings`, `sr_levels_from_context`, the builder's own
 * quantise-and-de-duplicate step and `_nearest`).
 *
 * Engine 4 needs the SAME levels the zone builder had, because a stop option
 * must sit behind a level the synthesis saw and the next opposing level must be
 * the one the zone was ranked on. The architecture hands step 5 one
 * invalidation and one opposing level per zone (3.9); every other level is
 * rebuilt here from what is stored: the channel levels of the sensors'
 * readings and the support and resistance levels of the cycle's bundle (the
 * plan's section 3, decision D6 (a)). A corpus of 31 stored golden zones and a
 * set of random worlds made by the real Python builder hold this file to the
 * Python.
 *
 * The rules, as the Python states them:
 *  - a sensor's channel levels count only if its reading is AVAILABLE: status
 *    VALID or CAUTIONARY, a state code, a known bias, a regime word that is
 *    text or absent. An INVALID or STALE sensor gives no level;
 *  - a level needs a name, a timeframe (M5 or M15) and a price above zero;
 *  - MCD3 repeats the levels of MCD1 and MCD2: each (timeframe, name, price)
 *    counts once, the first one seen keeping its origin;
 *  - `sr_1` to `sr_16` come from `context_levels`; a slot with no level is null
 *    and gives nothing; the same slot at the same price on both timeframes is
 *    one level (M5 first); `sr_1` to `sr_8` have the origin `sr_levels`, the
 *    rest `sr2_levels`;
 *  - the builder works in cents: every price is rounded half up to two places
 *    and the list is de-duplicated again (`toStructure`).
 *
 * @module lib/engine4/levels
 */

import { Rational } from './exact';

export type Timeframe = 'M5' | 'M15';
export const TIMEFRAMES: readonly Timeframe[] = ['M5', 'M15'];

/** The sensors synthesis reads, in the order the builder takes their levels. */
export const SENSORS = ['MCD1', 'MCD2', 'MCD3'] as const;
export type SensorId = (typeof SENSORS)[number];

export type LevelOrigin = SensorId | 'sr_levels' | 'sr2_levels';
const ORIGINS: readonly string[] = [...SENSORS, 'sr_levels', 'sr2_levels'];

export interface Level {
  readonly name: string;
  readonly tf: Timeframe;
  readonly price: Rational;
  readonly origin: LevelOrigin;
}

/**
 * The entry-zone parameters this file and its neighbours are the twin of
 * (`zone_params.yaml`, version `zones-1`). A test pins every figure to the YAML,
 * so a new zones version cannot slip past the twin.
 */
export const ZONES_1 = Object.freeze({
  version: 'zones-1',
  /** prices are in cents (decision D7 (c)) */
  priceDecimals: 2,
  /** the runway ratio is rounded to two places (decision D7 (f)) */
  ratioDecimals: 2,
  /** the invalidation lies this far beyond the structure level past the zone (ADR-032) */
  invalidationBuffer: Rational.of('0.5'),
  /** the zone builder's floor for a stop distance; the TRADER's Min SLD is separate */
  minStopDistance: Rational.of('13'),
});

/** `sr_1` to `sr_16` in the order the builder reads them. */
export const SR_NAMES: readonly string[] = [
  'sr_1',
  'sr_2',
  'sr_3',
  'sr_4',
  'sr_5',
  'sr_6',
  'sr_7',
  'sr_8',
  'sr_9',
  'sr_10',
  'sr_11',
  'sr_12',
  'sr_13',
  'sr_14',
  'sr_15',
  'sr_16',
];
const SR_FIRST_EIGHT: readonly string[] = SR_NAMES.slice(0, 8);

/** A sensor gives levels only in these two statuses; INVALID, STALE or anything else gives none. */
const AVAILABLE_STATUSES: readonly string[] = ['VALID', 'CAUTIONARY'];
const KNOWN_BIASES: readonly string[] = [
  'LONG',
  'SHORT',
  'NEUTRAL',
  'STAND_ASIDE',
];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * An exact value from a JSON number (read by its shortest decimal text) or an
 * integer, or null for anything else: a string, a boolean, NaN, Infinity.
 * The twin of `to_decimal`.
 */
export function decimalOrNull(value: unknown): Rational | null {
  if (typeof value === 'bigint') return Rational.int(value);
  if (typeof value !== 'number') return null;
  try {
    return Rational.of(value);
  } catch {
    return null;
  }
}

/**
 * True when a sensor's reading may give levels: the twin of
 * `view_of(...).available`. Anything that is not a well-formed envelope is
 * unavailable, never an error.
 */
export function isAvailableReading(reading: unknown): boolean {
  if (!isRecord(reading)) return false;
  const status = reading['status'];
  if (typeof status !== 'string' || !AVAILABLE_STATUSES.includes(status)) {
    return false;
  }
  const bias = reading['bias'];
  const regime = reading['regime_status'];
  return (
    typeof reading['state_code'] === 'string' &&
    typeof bias === 'string' &&
    KNOWN_BIASES.includes(bias) &&
    (regime === undefined || regime === null || typeof regime === 'string')
  );
}

function levelFromRaw(raw: unknown, origin: LevelOrigin): Level | null {
  if (!isRecord(raw)) return null;
  const name = raw['name'];
  const tf = raw['tf'];
  const price = decimalOrNull(raw['price']);
  if (
    typeof name !== 'string' ||
    name === '' ||
    (tf !== 'M5' && tf !== 'M15') ||
    price === null ||
    !price.isPositive()
  ) {
    return null;
  }
  return { name, tf, price, origin };
}

/** Parse a level as a stored zone writes it (`{name, tf, price, origin}`), or null. */
export function levelFromStored(raw: unknown): Level | null {
  if (!isRecord(raw)) return null;
  const origin = raw['origin'];
  if (typeof origin !== 'string' || !ORIGINS.includes(origin)) return null;
  return levelFromRaw(raw, origin as LevelOrigin);
}

/** The first of every level that appears twice, by (timeframe, name, price). Order kept. */
export function dedupeLevels(levels: Iterable<Level>): Level[] {
  const seen = new Set<string>();
  const out: Level[] = [];
  for (const level of levels) {
    const key = JSON.stringify([level.tf, level.name, level.price.toString()]);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(level);
    }
  }
  return out;
}

/**
 * The channel levels of every available sensor (VALID or CAUTIONARY), in sensor
 * order, each level once. `readings` maps an MCD id to its parsed envelope.
 */
export function levelsFromReadings(
  readings: Readonly<Record<string, unknown>>
): Level[] {
  const out: Level[] = [];
  for (const sensor of SENSORS) {
    const reading = readings[sensor];
    if (!isAvailableReading(reading) || !isRecord(reading)) continue;
    const raw = reading['levels'];
    if (!Array.isArray(raw)) continue;
    for (const item of raw) {
      const level = levelFromRaw(item, sensor);
      if (level !== null) out.push(level);
    }
  }
  return dedupeLevels(out);
}

/**
 * The support and resistance levels of a bundle's `context_levels`:
 * `{ M5: { sr_1: 4369.57, sr_2: null, ... }, M15: { ... } }`. A slot that
 * resolved no level is null and gives nothing; the same slot at the same price
 * on both timeframes is one level.
 */
export function srLevelsFromContext(context: unknown): Level[] {
  if (!isRecord(context)) return [];
  const out: Level[] = [];
  const seen = new Set<string>();
  for (const tf of TIMEFRAMES) {
    const row = context[tf];
    if (!isRecord(row)) continue;
    for (const name of SR_NAMES) {
      const price = decimalOrNull(row[name]);
      if (price === null || !price.isPositive()) continue;
      const key = JSON.stringify([name, price.toString()]);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        name,
        tf,
        price,
        origin: SR_FIRST_EIGHT.includes(name) ? 'sr_levels' : 'sr2_levels',
      });
    }
  }
  return out;
}

/**
 * The levels as the zone builder sees them: every price rounded half up to
 * cents, then each (timeframe, name, price) once. Applying it twice changes
 * nothing.
 */
export function toStructure(
  levels: Iterable<Level>,
  places: number = ZONES_1.priceDecimals
): Level[] {
  const rounded: Level[] = [];
  for (const level of levels) {
    rounded.push({ ...level, price: level.price.roundTo(places, 'HALF_UP') });
  }
  return dedupeLevels(rounded);
}

/** Two levels are the same level: name, timeframe, origin and price (or both absent). */
export function sameLevel(a: Level | null, b: Level | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.name === b.name &&
    a.tf === b.tf &&
    a.origin === b.origin &&
    a.price.eq(b.price)
  );
}

function compareText(a: string, b: string): -1 | 0 | 1 {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** Equal prices are told apart by timeframe, then name, then origin, so a choice among them is fixed. */
export function compareLevels(a: Level, b: Level): -1 | 0 | 1 {
  return (
    compareText(a.tf, b.tf) ||
    compareText(a.name, b.name) ||
    compareText(a.origin, b.origin)
  );
}

/**
 * The candidate with the highest (or lowest) price; among equal prices the
 * first by timeframe, name and origin. The twin of `_nearest`.
 */
export function nearestLevel(
  candidates: readonly Level[],
  highest: boolean
): Level | null {
  let best: Rational | null = null;
  for (const candidate of candidates) {
    if (
      best === null ||
      (highest ? candidate.price.gt(best) : candidate.price.lt(best))
    ) {
      best = candidate.price;
    }
  }
  if (best === null) return null;
  const target = best;
  const atBest = candidates
    .filter((candidate) => candidate.price.eq(target))
    .sort(compareLevels);
  return atBest[0] ?? null;
}

// ---------------------------------------------------------------------------
// What a read of the stored levels can say (see read/structure-levels.ts)
// ---------------------------------------------------------------------------

export type StructureProblemCode =
  | 'DATABASE_ERROR'
  | 'NO_SENSOR_READINGS'
  | 'SENSOR_READING_MISSING'
  | 'SENSOR_READING_UNREADABLE'
  | 'SENSOR_READING_TAMPERED'
  | 'SENSOR_READING_MISMATCH'
  | 'BUNDLE_EXPIRED'
  | 'BUNDLE_MISSING'
  | 'BUNDLE_ENCODING'
  | 'BUNDLE_UNREADABLE'
  | 'BUNDLE_TAMPERED'
  | 'BUNDLE_SIZE_MISMATCH'
  | 'INPUTS_MISMATCH'
  | 'ZONE_DISAGREES_WITH_LEVELS';

export interface StructureProblem {
  code: StructureProblemCode;
  detail: string;
  /** the sensor concerned, when one is */
  mcdId?: string;
}

/** The levels of a cycle, or the reasons they could not be read. Never partial: a problem leaves `levels` empty. */
export interface StructureRead {
  complete: boolean;
  /** the channel levels then the support and resistance levels, as the builder was handed them */
  levels: Level[];
  problems: StructureProblem[];
}
