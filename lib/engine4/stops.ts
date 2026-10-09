/**
 * Structural stop options (architecture 6.5, ADR-062, plan decisions D6 and D7).
 *
 * The stop options are every structure level on the stop side of the entry
 * whose stop, $0.50 beyond the level, is at least the TRADER's Min SLD from the
 * entry: nearest first, each named, plus "custom". There are no fixed $13 to
 * $21 pills. The $0.50 is the buffer of the zone parameters (`zones-1`).
 *
 * D7 (c), the pre-selection: the zone's own stored invalidation when it is at
 * least Min SLD from the entry, otherwise the nearest option. An invalidation
 * that is the MINIMUM_STOP or NO_LEVEL kind has no structure behind it: it is
 * pre-selected as "minimum stop distance" but is never offered as a structural
 * level. D7 (b): the modal shows the nearest three and the rest under "more
 * levels" (`groupStopOptions`).
 *
 * Also here: `zoneInvalidation`, the twin of the zone builder's own invalidation
 * (zones.py, ADR-032, decision D7 (a)). Rebuilding a stored zone's invalidation
 * from the levels read back proves the levels are the zone's levels.
 *
 * Degradation is explicit. If the levels could not be read (a missing, expired
 * or tampered bundle or reading), `buildStopChoices` offers only the zone's own
 * stored invalidation and says why; it never guesses a level.
 *
 * @module lib/engine4/stops
 */

import {
  Rational,
  readNonNegative,
  readPositive,
  type DecimalLike,
} from './exact';
import {
  ZONES_1,
  compareLevels,
  nearestLevel,
  sameLevel,
  toStructure,
  type Level,
  type StructureProblem,
  type StructureRead,
} from './levels';
import { nextOpposingLevel } from './room';
import type { Side } from './types';
import type { InvalidationBasis, ZoneInput } from './zone';

export interface StopOption {
  /** the level the stop sits behind: the first by timeframe, name and origin at its price */
  level: Level;
  /** other levels at exactly the same price, to be named with it */
  alsoAt: Level[];
  /** the level plus or minus the buffer: below a BUY's level, above a SELL's */
  stopPrice: Rational;
  /** from the entry to the stop price */
  stopDistance: Rational;
}

export interface StopOptionsInput {
  side: Side;
  entry: DecimalLike;
  /** the trader's Min SLD (profile metric 7) */
  minSld: DecimalLike;
  /** the distance behind a level; the zone parameters' $0.50 unless told otherwise */
  buffer?: DecimalLike;
}

/**
 * Every structural stop option, nearest first. A level qualifies when it lies
 * strictly on the stop side of the entry and its stop is at least `minSld` away
 * (exactly `minSld` qualifies). Levels at one price give one option.
 */
export function stopOptions(
  levels: readonly Level[],
  input: StopOptionsInput
): StopOption[] {
  const entry = readPositive('entry', input.entry);
  const minSld = readPositive('minSld', input.minSld);
  const buffer =
    input.buffer === undefined
      ? ZONES_1.invalidationBuffer
      : readNonNegative('buffer', input.buffer);
  const buy = input.side === 'BUY';

  const byStop = new Map<string, { stopPrice: Rational; at: Level[] }>();
  for (const level of toStructure(levels)) {
    if (buy ? !level.price.lt(entry) : !level.price.gt(entry)) continue;
    const stopPrice = buy ? level.price.sub(buffer) : level.price.add(buffer);
    if (!stopPrice.isPositive()) continue;
    const distance = buy ? entry.sub(stopPrice) : stopPrice.sub(entry);
    if (distance.lt(minSld)) continue;
    const key = stopPrice.toString();
    const group = byStop.get(key);
    if (group === undefined) byStop.set(key, { stopPrice, at: [level] });
    else group.at.push(level);
  }

  const options: StopOption[] = [];
  for (const { stopPrice, at } of byStop.values()) {
    const ordered = [...at].sort(compareLevels);
    const [level, ...alsoAt] = ordered;
    if (level === undefined) continue;
    options.push({
      level,
      alsoAt,
      stopPrice,
      stopDistance: buy ? entry.sub(stopPrice) : stopPrice.sub(entry),
    });
  }
  return options.sort((a, b) => a.stopDistance.cmp(b.stopDistance));
}

/** D7 (b): the nearest `visible` options for the modal, the rest under "more levels". */
export function groupStopOptions(
  options: readonly StopOption[],
  visible = 3
): { primary: StopOption[]; more: StopOption[] } {
  return { primary: options.slice(0, visible), more: options.slice(visible) };
}

// ---------------------------------------------------------------------------
// The zone builder's invalidation, rebuilt
// ---------------------------------------------------------------------------

export interface ZoneInvalidation {
  price: Rational;
  basis: InvalidationBasis;
  /** the structure level past the zone that was looked at; null only when there is none */
  level: Level | null;
  stopDistance: Rational;
}

/**
 * The twin of the builder's invalidation for a zone: $0.50 beyond the nearest
 * structure level strictly past the zone (below its low for a LONG, above its
 * high for a SHORT), raised to exactly the builder's $13 from the reference
 * price when the level gives less, or when there is none.
 */
export function zoneInvalidation(
  levels: readonly Level[],
  zone: Pick<ZoneInput, 'bias' | 'low' | 'high' | 'referencePrice'>,
  params: Pick<
    typeof ZONES_1,
    'invalidationBuffer' | 'minStopDistance' | 'priceDecimals'
  > = ZONES_1
): ZoneInvalidation {
  const long = zone.bias === 'LONG';
  const reference = zone.referencePrice;
  const structure = toStructure(levels, params.priceDecimals);
  const past = nearestLevel(
    structure.filter((level) =>
      long ? level.price.lt(zone.low) : level.price.gt(zone.high)
    ),
    long
  );

  let basis: InvalidationBasis = 'NO_LEVEL';
  let invalidation = long
    ? reference.sub(params.minStopDistance)
    : reference.add(params.minStopDistance);
  if (past !== null) {
    const fromLevel = long
      ? past.price.sub(params.invalidationBuffer)
      : past.price.add(params.invalidationBuffer);
    const distance = long ? reference.sub(fromLevel) : fromLevel.sub(reference);
    if (distance.gte(params.minStopDistance)) {
      basis = 'LEVEL';
      invalidation = fromLevel;
    } else {
      basis = 'MINIMUM_STOP';
    }
  }
  const price = invalidation.roundTo(params.priceDecimals, 'HALF_UP');
  return {
    price,
    basis,
    level: past,
    stopDistance: reference.sub(price).abs(),
  };
}

// ---------------------------------------------------------------------------
// What the modal is handed
// ---------------------------------------------------------------------------

/** What is pre-selected (D7 (c)). */
export type PreselectedStop =
  | {
      kind: 'ZONE_INVALIDATION';
      stopPrice: Rational;
      stopDistance: Rational;
      /** the structural option at that price, when the list has one */
      option: StopOption | null;
    }
  | { kind: 'MINIMUM_STOP'; stopPrice: Rational; stopDistance: Rational }
  | { kind: 'NEAREST_OPTION'; option: StopOption }
  | { kind: 'CUSTOM_REQUIRED' };

export interface StopChoices {
  /** STRUCTURE: from the levels read back. DEGRADED: only the zone's own invalidation */
  mode: 'STRUCTURE' | 'DEGRADED';
  /** why it is degraded; empty in STRUCTURE mode */
  degradedBy: StructureProblem[];
  /** the structural options, nearest first */
  structural: StopOption[];
  /**
   * The zone's invalidation when it has no structure behind it (the MINIMUM_STOP
   * or NO_LEVEL kind) and is at least Min SLD from the entry: shown as "minimum
   * stop distance, no structure behind it", never as a structural level.
   */
  minimumStop: { stopPrice: Rational; stopDistance: Rational } | null;
  /** a custom stop is always possible, at least this far from the entry */
  custom: { minDistance: Rational };
  preselected: PreselectedStop;
}

export interface StopChoicesInput {
  zone: ZoneInput;
  /** the entry the trader chose: the zone's reference price, another pill, or a custom entry */
  entry: DecimalLike;
  minSld: DecimalLike;
  /** the levels read back for the zone's cycle (`readStructureLevels`) */
  structure: StructureRead;
}

function sameStop(a: Rational, b: Rational): boolean {
  return a.eq(b);
}

/**
 * The stop choices for a zone. With the levels in hand, every structural option
 * plus the pre-selection; without them, only the zone's own invalidation and the
 * reason the rest is missing. A stored zone that disagrees with the levels read
 * back (a different invalidation or opposing level) also degrades: those are not
 * the levels the zone was made from.
 */
export function buildStopChoices(input: StopChoicesInput): StopChoices {
  const entry = readPositive('entry', input.entry);
  const minSld = readPositive('minSld', input.minSld);
  const { zone, structure } = input;
  const side: Side = zone.bias === 'LONG' ? 'BUY' : 'SELL';
  const buy = side === 'BUY';

  const stored = zone.invalidationPrice;
  const storedDistance = buy ? entry.sub(stored) : stored.sub(entry);
  const storedUsable = storedDistance.gte(minSld);

  let degradedBy: StructureProblem[] = structure.complete
    ? []
    : [...structure.problems];
  let structural: StopOption[] = [];
  if (structure.complete) {
    const mismatch = zoneDisagreement(structure.levels, zone);
    if (mismatch.length > 0) {
      degradedBy = [
        {
          code: 'ZONE_DISAGREES_WITH_LEVELS',
          detail: mismatch.join('; '),
        },
      ];
    } else {
      structural = stopOptions(structure.levels, { side, entry, minSld });
    }
  }
  const mode = degradedBy.length === 0 ? 'STRUCTURE' : 'DEGRADED';

  if (mode === 'DEGRADED') {
    // the zone's own invalidation, and nothing else: a level of its own only if it names one
    if (
      zone.invalidationBasis === 'LEVEL' &&
      zone.invalidationLevel !== null &&
      storedUsable
    ) {
      structural = [
        {
          level: zone.invalidationLevel,
          alsoAt: [],
          stopPrice: stored,
          stopDistance: storedDistance,
        },
      ];
    }
  }

  const minimumStop =
    zone.invalidationBasis !== 'LEVEL' && storedUsable
      ? { stopPrice: stored, stopDistance: storedDistance }
      : null;

  let preselected: PreselectedStop;
  if (zone.invalidationBasis === 'LEVEL' && storedUsable) {
    preselected = {
      kind: 'ZONE_INVALIDATION',
      stopPrice: stored,
      stopDistance: storedDistance,
      option:
        structural.find((option) => sameStop(option.stopPrice, stored)) ?? null,
    };
  } else if (minimumStop !== null) {
    preselected = { kind: 'MINIMUM_STOP', ...minimumStop };
  } else if (structural[0] !== undefined) {
    preselected = { kind: 'NEAREST_OPTION', option: structural[0] };
  } else {
    preselected = { kind: 'CUSTOM_REQUIRED' };
  }

  return {
    mode,
    degradedBy,
    structural,
    minimumStop,
    custom: { minDistance: minSld },
    preselected,
  };
}

/**
 * Every way a stored zone differs from what the levels give for it: its
 * invalidation (price, basis, the level behind it, the stop distance) and its
 * next opposing level with the runway and the runway ratio. Empty when they
 * agree, which is the proof that the levels are the ones the zone was made from.
 */
export function zoneDisagreement(
  levels: readonly Level[],
  zone: ZoneInput,
  params = ZONES_1
): string[] {
  const problems: string[] = [];
  const got = zoneInvalidation(levels, zone, params);
  if (!got.price.eq(zone.invalidationPrice)) {
    problems.push(
      `invalidation ${zone.invalidationPrice.toString()} but the levels give ${got.price.toString()}`
    );
  }
  if (got.basis !== zone.invalidationBasis) {
    problems.push(
      `invalidation basis ${zone.invalidationBasis} but the levels give ${got.basis}`
    );
  }
  if (!sameLevel(got.level, zone.invalidationLevel)) {
    problems.push('the level behind the invalidation differs');
  }
  if (!got.stopDistance.eq(zone.stopDistance)) {
    problems.push('the stop distance differs');
  }

  const side: Side = zone.bias === 'LONG' ? 'BUY' : 'SELL';
  const opposing = nextOpposingLevel(levels, side, zone.referencePrice);
  if (!sameLevel(opposing, zone.nextOpposingLevel)) {
    problems.push('the next opposing level differs');
  } else if (opposing !== null) {
    const runway = opposing.price.sub(zone.referencePrice).abs();
    if (zone.runway === null || !zone.runway.eq(runway)) {
      problems.push('the runway differs');
    }
    const ratio = runway
      .div(zone.stopDistance)
      .roundTo(params.ratioDecimals, 'HALF_UP');
    if (zone.runwayRatio === null || !zone.runwayRatio.eq(ratio)) {
      problems.push('the runway ratio differs');
    }
  } else if (zone.runway !== null || zone.runwayRatio !== null) {
    problems.push(
      'the zone has a runway but the levels give no opposing level'
    );
  }
  return problems;
}
