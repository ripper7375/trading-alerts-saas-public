/**
 * The modal definition (architecture 6.13, "UI: Modal definition"; ADR-033,
 * ADR-061, ADR-062, ADR-064, ADR-067).
 *
 * What the "Trade setup" modal is handed: the direction from the synthesis, one
 * price pill per zone (the zone's reference price, in rank order, none when the
 * synthesis stands aside), the stop options behind each pill, a custom entry and
 * a custom stop with their bounds, the risk pre-set (the trader's Max RPT, or
 * HALF of it when the sensors are CAUTIONARY or the cycle is RETUNING, with the
 * reason), the equity from the profile, and the RRR with the counter-trend cap.
 *
 * It is data only: the modal draws it, the chat reads it back, and
 * `validateSetup` (validate.ts) checks what the trader enters against the same
 * bounds, so a bound shown here is the bound enforced there.
 *
 * A zone past its invalidation is still a pill, flagged `invalidated`, so the
 * rank order never shifts under the trader's finger; it is not selectable.
 *
 * @module lib/engine4/modal-definition
 */

import { entryBounds, type DayRange, type EntryBounds } from './entry-bound';
import { Rational, type DecimalLike } from './exact';
import type { StructureRead } from './levels';
import type {
  OfferNotice,
  OfferReason,
  OfferResult,
  OfferVerdict,
  SynthesisChange,
} from './offer';
import { PROFILE_BOUNDS } from './profile';
import { buildStopChoices, stopOptions, type StopChoices } from './stops';
import type { Side, TraderProfile } from './types';
import { byRank, type ZoneInput } from './zone';

const HALF = Rational.fromFraction(1n, 2n);

// ---------------------------------------------------------------------------
// Risk
// ---------------------------------------------------------------------------

export interface RiskPreset {
  /** the risk the modal opens on, percent of equity: Max RPT, or half of it */
  preset: Rational;
  /** the most the trader may enter: Max RPT (the trader may override the half up to this) */
  max: Rational;
  /** the preset is halved (CAUTIONARY sensors or a RETUNING cycle, ADR-061) */
  halfRisk: boolean;
  /** why: the sensors' caution reasons, and RETUNING */
  reasons: string[];
}

/** The pre-set risk of 6.4 row 3 and 6.6: half of Max RPT when the offer says so. */
export function riskPreset(
  profile: Pick<TraderProfile, 'maxRiskPct'>,
  offer: Pick<OfferResult, 'halfRiskPreset' | 'halfRiskReasons'>
): RiskPreset {
  const max = Rational.of(profile.maxRiskPct);
  return {
    preset: offer.halfRiskPreset ? max.mul(HALF) : max,
    max,
    halfRisk: offer.halfRiskPreset,
    reasons: [...offer.halfRiskReasons],
  };
}

// ---------------------------------------------------------------------------
// RRR
// ---------------------------------------------------------------------------

export interface RrrBounds {
  min: Rational;
  /** 3.50, or 2.50 for a counter-trend SETUP (ADR-064) */
  max: Rational;
  /** the profile's target RRR, lowered to `max` when it is above it */
  preset: Rational;
  /** the profile's target was above `max` and the preset was lowered to it */
  capped: boolean;
  counterTrend: boolean;
}

export function rrrBounds(
  profile: Pick<TraderProfile, 'targetRrr'>,
  counterTrend: boolean
): RrrBounds {
  const min = Rational.of(PROFILE_BOUNDS.targetRrr.min);
  const ceiling = Rational.of(PROFILE_BOUNDS.targetRrr.max);
  const cap = Rational.of(PROFILE_BOUNDS.counterTrendRrrCap);
  const max = counterTrend ? cap : ceiling;
  const target = Rational.of(profile.targetRrr);
  const capped = target.gt(max);
  return { min, max, preset: capped ? max : target, capped, counterTrend };
}

// ---------------------------------------------------------------------------
// Stops for an entry that is not a pill
// ---------------------------------------------------------------------------

export interface CustomEntryStopInput {
  side: Side;
  entry: DecimalLike;
  minSld: DecimalLike;
  structure: StructureRead;
}

/**
 * The stop choices for a custom entry: every structural level on the stop side
 * of THAT entry at least Min SLD away (nearest first), the nearest pre-selected,
 * or only "custom" when the levels could not be read (explicit degradation, as
 * for a pill). There is no zone, so no zone invalidation to pre-select.
 */
export function customEntryStopChoices(
  input: CustomEntryStopInput
): StopChoices {
  const { side, entry, minSld, structure } = input;
  const structural = structure.complete
    ? stopOptions(structure.levels, { side, entry, minSld })
    : [];
  const [nearest] = structural;
  return {
    mode: structure.complete ? 'STRUCTURE' : 'DEGRADED',
    degradedBy: structure.complete ? [] : [...structure.problems],
    structural,
    minimumStop: null,
    custom: { minDistance: Rational.of(minSld) },
    preselected:
      nearest === undefined
        ? { kind: 'CUSTOM_REQUIRED' }
        : { kind: 'NEAREST_OPTION', option: nearest },
  };
}

// ---------------------------------------------------------------------------
// The definition
// ---------------------------------------------------------------------------

export interface ModalPill {
  zoneId: string;
  /** the zone's reference price: the entry this pill stands for */
  price: Rational;
  low: Rational;
  high: Rational;
  /** the newest price is at or past this zone's invalidation: shown, not selectable */
  invalidated: boolean;
  /** the stop options behind this entry */
  stop: StopChoices;
}

export interface NotOfferedModal {
  status: 'NOT_OFFERED';
  /** the reason shown (the first in table order); null only if there was none to give */
  reason: OfferReason | null;
  reasons: OfferReason[];
}

export interface OfferedModal {
  status: Exclude<OfferVerdict, 'NOT_OFFERED'>;
  /** set when a newer cycle changed the synthesis: the trader is offered a refresh (the slot as unix seconds in text) */
  refresh: { newSlot: string; changes: SynthesisChange[] } | null;
  notices: OfferNotice[];
  direction: 'LONG' | 'SHORT';
  side: Side;
  counterTrend: boolean;
  /** one per zone on the direction's side, in rank order (Z1 first) */
  pills: ModalPill[];
  custom: {
    /** the bounds of a custom entry (null where they cannot be worked out: then none is accepted) */
    entry: EntryBounds;
    /** a custom stop is at least this far from the entry */
    stopMinDistance: Rational;
  };
  risk: RiskPreset;
  /** pre-filled from the profile */
  equity: Rational;
  rrr: RrrBounds;
  /** the profile figures the modal shows beside its fields */
  profile: { minSld: Rational; maxLeverage: Rational; commission: Rational };
}

export type ModalDefinition = NotOfferedModal | OfferedModal;

export interface ModalDefinitionInput {
  profile: TraderProfile;
  offer: OfferResult;
  /** the pinned reading's zones, any order */
  zones: readonly ZoneInput[];
  /** the levels of the pinned cycle (`readStructureLevels`) */
  structure: StructureRead;
  /** the one-day range (`dayRange`) for the bound of a custom entry */
  range: DayRange;
  /** the newest cycle's reference price: the centre of the typo filter */
  livePrice: DecimalLike | null;
}

export function buildModalDefinition(
  input: ModalDefinitionInput
): ModalDefinition {
  const { profile, offer } = input;
  if (offer.verdict === 'NOT_OFFERED' || offer.direction === null) {
    return {
      status: 'NOT_OFFERED',
      reason: offer.reason,
      reasons: offer.reasons,
    };
  }
  const direction = offer.direction;
  const side: Side = direction === 'LONG' ? 'BUY' : 'SELL';
  const counterTrend = offer.trendRelation === 'COUNTER_TREND';

  const pills: ModalPill[] = input.zones
    .filter((zone) => zone.bias === direction)
    .sort(byRank)
    .map((zone) => {
      const check = offer.zones.find((c) => c.zoneId === zone.zoneId);
      return {
        zoneId: zone.zoneId,
        price: zone.referencePrice,
        low: zone.low,
        high: zone.high,
        // a zone the offer did not check is not selectable either
        invalidated: check === undefined || check.invalidated,
        stop: buildStopChoices({
          zone,
          entry: zone.referencePrice,
          minSld: profile.minSld,
          structure: input.structure,
        }),
      };
    });

  const minSld = Rational.of(profile.minSld);
  return {
    status: offer.verdict,
    refresh:
      offer.refresh === null
        ? null
        : {
            newSlot: offer.refresh.newSlot.toString(),
            changes: offer.refresh.changes,
          },
    notices: offer.notices,
    direction,
    side,
    counterTrend,
    pills,
    custom: {
      entry: entryBounds(input.range, input.livePrice),
      stopMinDistance: minSld,
    },
    risk: riskPreset(profile, offer),
    equity: Rational.of(profile.equity),
    rrr: rrrBounds(profile, counterTrend),
    profile: {
      minSld,
      maxLeverage: Rational.of(profile.maxLeverage),
      commission: Rational.of(profile.commission),
    },
  };
}
