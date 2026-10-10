/**
 * The single validator (architecture 6.10, ADR-067, plan part 4).
 *
 * Values typed in chat ("risk 1.2%, stop $18.50, RRR 2.85") are extracted by
 * section 4 and only pre-fill the modal; the trader confirms each input; nothing
 * is computed from free text alone. Both paths hand the SAME fields to
 * `validateSetup`, which runs the eight checks of 6.10 and returns the one
 * object, `ValidatedSetup`, that everything after it (Report 2, the consent
 * record, the trace) reads. Numbers come in as decimal text or JavaScript
 * numbers (a number is read by its shortest decimal text) and leave as canonical
 * decimal text, so the same setup typed as `"1.20"` in a field and as `1.2` from
 * chat gives byte-identical JSON.
 *
 * The checks (0 to 7):
 *   0 ENTRY     a zone's price is always legal; a custom entry must lie in the
 *               one-day range widened by half its height and within 5% of the
 *               live price (entry-bound.ts)
 *   1 RISK      risk % above zero and at most Max RPT (equity is read here too)
 *   2 STOP      stop distance at least Min SLD; named as a structural option, the
 *               zone's minimum stop, or custom
 *   3 RRR       from 1.50 to 3.50, at most 2.50 when the SETUP is counter-trend
 *   4 LEVERAGE  the lot's leverage does not exceed Max leverage (the lot is clamped)
 *   5 BLACKOUT  no Tier-1 release within its window; an unreadable list or
 *               calendar fails closed
 *   6 SETUP     still valid and the data status allows it: the offer check, run
 *               again, says so (no refresh pending, the picked zone not past its
 *               invalidation, the direction is the synthesis')
 *   7 LOT       a lot of at least the broker minimum, or the underflow help
 *
 * A check is PASS, FAIL or SKIPPED (it needs an input an earlier check refused).
 * The setup is sized, and its scenarios built, only when the numbers are
 * acceptable (checks 0 to 3) and there are broker figures; whatever else fails,
 * a refusal is a RESULT here, never a thrown error. `ok` is true only when all
 * eight checks pass.
 *
 * Pure: the clock, the offer check, the blackout, the broker row, the zones, the
 * levels and the day range are all passed in.
 *
 * @module lib/engine4/validate
 */

import type { BlackoutResult } from './blackout';
import type { BrokerResult } from './broker';
import { checkEntryBound, type DayRange } from './entry-bound';
import { Rational, type DecimalLike } from './exact';
import type { StructureRead } from './levels';
import {
  customEntryStopChoices,
  riskPreset,
  rrrBounds,
} from './modal-definition';
import type { OfferResult } from './offer';
import { buildScenarios } from './scenarios';
import { buildStopChoices, type StopChoices } from './stops';
import { utcClock } from './time';
import {
  Engine4InputError,
  type ScenarioSet,
  type Side,
  type SizingInput,
  type TraderProfile,
  type UnderflowHelp,
} from './types';
import { underflowHelp } from './underflow';
import { byRank, type ZoneInput } from './zone';

export const VALIDATED_SETUP_SCHEMA = 'validated-setup/1';

// ---------------------------------------------------------------------------
// What goes in
// ---------------------------------------------------------------------------

/**
 * What the trader entered, from the modal's fields or extracted from chat. Every
 * field is loose (`unknown`): a number, decimal text, or nothing. `stopDistance`
 * is the distance in dollars from the entry to the stop (the "$18.50" of chat).
 */
export interface SetupFields {
  /** BUY, SELL, LONG or SHORT: only compared with the synthesis' direction, never trusted */
  side?: unknown;
  /** a pill that was picked: fills an ABSENT entry with that zone's price, and nothing else */
  zoneId?: unknown;
  entry?: unknown;
  equity?: unknown;
  riskPct?: unknown;
  stopDistance?: unknown;
  /** the target RRR (the Normal scenario's) */
  rrr?: unknown;
}

export interface ValidationContext {
  profile: TraderProfile;
  /** `checkOffer`, run again at submit (6.4) */
  offer: OfferResult;
  blackout: BlackoutResult;
  specs: BrokerResult;
  /** the pinned reading's zones, any order */
  zones: readonly ZoneInput[];
  structure: StructureRead;
  /** `dayRange` of the closed M5 bars of the last 24 hours */
  range: DayRange;
  /** the newest cycle's reference price */
  livePrice: DecimalLike | null;
}

// ---------------------------------------------------------------------------
// What comes out
// ---------------------------------------------------------------------------

export type CheckId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type CheckName =
  | 'ENTRY'
  | 'RISK'
  | 'STOP'
  | 'RRR'
  | 'LEVERAGE'
  | 'BLACKOUT'
  | 'SETUP'
  | 'LOT';
export type CheckStatus = 'PASS' | 'FAIL' | 'SKIPPED';

export interface CheckResult {
  id: CheckId;
  name: CheckName;
  status: CheckStatus;
  /** why it failed; empty unless FAIL */
  codes: string[];
  /** English text for the codes */
  detail: string[];
  /** facts worth recording whatever the status (the entry is a zone price, the lot was clamped) */
  notes: string[];
}

export interface ValidatedSetup {
  schema: typeof VALIDATED_SETUP_SCHEMA;
  /** all eight checks passed */
  ok: boolean;
  /** the cycle the setup is pinned to, unix seconds as text */
  pinnedSlot: string | null;
  side: Side | null;
  /** the SETUP is counter-trend (ADR-064) */
  counterTrend: boolean;
  entry: {
    price: string | null;
    source: 'ZONE' | 'CUSTOM' | null;
    zoneId: string | null;
  };
  equity: string | null;
  riskPct: string | null;
  stop: {
    distance: string | null;
    price: string | null;
    kind: 'STRUCTURAL' | 'MINIMUM_STOP' | 'CUSTOM' | null;
    /** the level a structural stop sits behind, "M5 LOEDT" */
    level: string | null;
  };
  rrr: string | null;
  /** the profile it was validated against, canonical */
  profile: TraderProfile;
  risk: { preset: string; max: string; halfRisk: boolean; reasons: string[] };
  overrides: {
    /** the trader chose more than the half-risk pre-set (up to Max RPT); null otherwise */
    defectFlag: { preset: string; chosen: string; reasons: string[] } | null;
  };
  /** the offer's notices (delay, caution, style), by code */
  notices: string[];
  /** other HIGH-impact USD releases inside the holding window */
  warnings: {
    eventId: string;
    eventName: string;
    eventTime: string;
    approximate: boolean;
    tier1: boolean;
  }[];
  checks: CheckResult[];
  /** the sizing is `scenarios.sizing`; null until the numbers are acceptable and there are broker figures */
  scenarios: ScenarioSet | null;
  /** set exactly when the lot is below the broker minimum */
  underflow: UnderflowHelp | null;
  versions: { specs: string | null; tier1List: number | null };
}

/** The canonical text of a validated setup: what "byte-identical" means. */
export function serializeValidatedSetup(setup: ValidatedSetup): string {
  return JSON.stringify(setup);
}

// ---------------------------------------------------------------------------
// Reading the fields
// ---------------------------------------------------------------------------

type Parsed =
  | { state: 'MISSING' }
  | { state: 'BAD' }
  | { state: 'OK'; value: Rational };

function parse(raw: unknown): Parsed {
  const value = typeof raw === 'string' ? raw.trim() : raw;
  if (value === undefined || value === null || value === '') {
    return { state: 'MISSING' };
  }
  try {
    return { state: 'OK', value: Rational.of(value as DecimalLike) };
  } catch (error) {
    if (error instanceof Engine4InputError) return { state: 'BAD' };
    throw error;
  }
}

const SIDE_WORDS: Readonly<Record<string, Side>> = {
  BUY: 'BUY',
  LONG: 'BUY',
  SELL: 'SELL',
  SHORT: 'SELL',
};

class Check {
  readonly codes: string[] = [];
  readonly detail: string[] = [];
  readonly notes: string[] = [];
  skipped = false;

  constructor(
    readonly id: CheckId,
    readonly name: CheckName
  ) {}

  fail(code: string, detail: string): void {
    if (!this.codes.includes(code)) {
      this.codes.push(code);
      this.detail.push(detail);
    }
  }

  get status(): CheckStatus {
    if (this.codes.length > 0) return 'FAIL';
    return this.skipped ? 'SKIPPED' : 'PASS';
  }

  result(): CheckResult {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      codes: this.codes,
      detail: this.detail,
      notes: this.notes,
    };
  }
}

function levelName(option: { level: { tf: string; name: string } }): string {
  return `${option.level.tf} ${option.level.name}`;
}

// ---------------------------------------------------------------------------
// The validator
// ---------------------------------------------------------------------------

export function validateSetup(
  ctx: ValidationContext,
  fields: SetupFields
): ValidatedSetup {
  const { profile, offer, blackout, specs } = ctx;
  const direction = offer.direction;
  const side: Side | null =
    direction === null ? null : direction === 'LONG' ? 'BUY' : 'SELL';
  const counterTrend = offer.trendRelation === 'COUNTER_TREND';
  const zones = (
    direction === null
      ? []
      : ctx.zones.filter((zone) => zone.bias === direction)
  ).sort(byRank);

  const c0 = new Check(0, 'ENTRY');
  const c1 = new Check(1, 'RISK');
  const c2 = new Check(2, 'STOP');
  const c3 = new Check(3, 'RRR');
  const c4 = new Check(4, 'LEVERAGE');
  const c5 = new Check(5, 'BLACKOUT');
  const c6 = new Check(6, 'SETUP');
  const c7 = new Check(7, 'LOT');

  // -- 0: the entry ------------------------------------------------------------------------
  let entry: Rational | null = null;
  let zone: ZoneInput | null = null;
  const entryField = parse(fields.entry);
  if (entryField.state === 'OK') {
    if (entryField.value.isPositive()) entry = entryField.value;
    else c0.fail('ENTRY_NOT_POSITIVE', 'the entry must be above zero');
  } else if (entryField.state === 'BAD') {
    c0.fail('ENTRY_NOT_A_NUMBER', 'the entry is not a number');
  } else {
    const hint = fields.zoneId;
    if (hint === undefined || hint === null || hint === '') {
      c0.fail('ENTRY_MISSING', 'there is no entry');
    } else {
      const hinted = zones.find((candidate) => candidate.zoneId === hint);
      if (hinted === undefined) {
        c0.fail(
          'ENTRY_ZONE_UNKNOWN',
          'the picked zone is not one of this reading'
        );
      } else {
        entry = hinted.referencePrice;
      }
    }
  }
  if (entry !== null) {
    const price = entry;
    zone =
      zones.find((candidate) => candidate.referencePrice.eq(price)) ?? null;
    if (zone !== null) {
      c0.notes.push('ENTRY_ON_ZONE_PRICE');
    } else {
      const bound = checkEntryBound(price, ctx.range, ctx.livePrice);
      if (!bound.ok) c0.fail(bound.code, bound.detail);
    }
  }

  // -- 1: risk (and the equity it is a percent of) -------------------------------------------
  const maxRisk = Rational.of(profile.maxRiskPct);
  let equity: Rational | null = null;
  const equityField = parse(fields.equity);
  if (equityField.state === 'MISSING') {
    c1.fail('EQUITY_MISSING', 'there is no equity');
  } else if (equityField.state === 'BAD') {
    c1.fail('EQUITY_NOT_A_NUMBER', 'the equity is not a number');
  } else if (!equityField.value.isPositive()) {
    c1.fail('EQUITY_NOT_POSITIVE', 'the equity must be above zero');
  } else {
    equity = equityField.value;
  }
  let riskPct: Rational | null = null;
  const riskField = parse(fields.riskPct);
  if (riskField.state === 'MISSING') {
    c1.fail('RISK_MISSING', 'there is no risk');
  } else if (riskField.state === 'BAD') {
    c1.fail('RISK_NOT_A_NUMBER', 'the risk is not a number');
  } else if (!riskField.value.isPositive()) {
    c1.fail('RISK_NOT_POSITIVE', 'the risk must be above zero');
  } else if (riskField.value.gt(maxRisk)) {
    c1.fail(
      'RISK_ABOVE_MAX_RPT',
      `the risk is above your Max RPT of ${maxRisk.toString()}%`
    );
  } else {
    riskPct = riskField.value;
  }

  // -- the stop options behind this entry (for check 2) ---------------------------------------
  let choices: StopChoices | null = null;
  if (side !== null && entry !== null) {
    choices =
      zone === null
        ? customEntryStopChoices({
            side,
            entry,
            minSld: profile.minSld,
            structure: ctx.structure,
          })
        : buildStopChoices({
            zone,
            entry,
            minSld: profile.minSld,
            structure: ctx.structure,
          });
  }

  // -- 2: the stop ----------------------------------------------------------------------------
  const minSld = Rational.of(profile.minSld);
  let stopDistance: Rational | null = null;
  let stopPrice: Rational | null = null;
  let stopKind: ValidatedSetup['stop']['kind'] = null;
  let stopLevel: string | null = null;
  const stopField = parse(fields.stopDistance);
  if (stopField.state === 'MISSING') {
    c2.fail('STOP_MISSING', 'there is no stop');
  } else if (stopField.state === 'BAD') {
    c2.fail('STOP_NOT_A_NUMBER', 'the stop is not a number');
  } else if (!stopField.value.isPositive()) {
    c2.fail('STOP_NOT_POSITIVE', 'the stop distance must be above zero');
  } else if (stopField.value.lt(minSld)) {
    c2.fail(
      'STOP_BELOW_MIN_SLD',
      `the stop is closer than your Min SLD of ${minSld.toString()}`
    );
  } else if (
    side === 'BUY' &&
    entry !== null &&
    !entry.sub(stopField.value).isPositive()
  ) {
    c2.fail(
      'STOP_PRICE_NOT_POSITIVE',
      'the stop price would not be above zero'
    );
  } else {
    stopDistance = stopField.value;
  }
  if (stopDistance !== null && side !== null && entry !== null) {
    const distance = stopDistance;
    stopPrice = side === 'BUY' ? entry.sub(distance) : entry.add(distance);
    const option = (choices === null ? [] : choices.structural).find(
      (candidate) => candidate.stopDistance.eq(distance)
    );
    const minimum = choices === null ? null : choices.minimumStop;
    if (option !== undefined) {
      stopKind = 'STRUCTURAL';
      stopLevel = levelName(option);
      c2.notes.push('STOP_STRUCTURAL');
    } else if (minimum !== null && minimum.stopDistance.eq(distance)) {
      stopKind = 'MINIMUM_STOP';
      c2.notes.push('STOP_MINIMUM');
    } else {
      stopKind = 'CUSTOM';
      c2.notes.push('STOP_CUSTOM');
    }
  }

  // -- 3: the RRR -------------------------------------------------------------------------------
  const rrrLimits = rrrBounds(profile, counterTrend);
  let rrr: Rational | null = null;
  const rrrField = parse(fields.rrr);
  if (rrrField.state === 'MISSING') {
    c3.fail('RRR_MISSING', 'there is no RRR');
  } else if (rrrField.state === 'BAD') {
    c3.fail('RRR_NOT_A_NUMBER', 'the RRR is not a number');
  } else if (rrrField.value.lt(rrrLimits.min)) {
    c3.fail('RRR_BELOW_MIN', `the RRR is below ${rrrLimits.min.toString()}`);
  } else if (rrrField.value.gt(rrrLimits.max)) {
    c3.fail(
      counterTrend ? 'RRR_ABOVE_COUNTER_TREND_CAP' : 'RRR_ABOVE_MAX',
      counterTrend
        ? `the RRR is above ${rrrLimits.max.toString()}, the cap for a counter-trend setup`
        : `the RRR is above ${rrrLimits.max.toString()}`
    );
  } else {
    rrr = rrrField.value;
  }

  // -- the lot (for checks 4 and 7) --------------------------------------------------------------
  let scenarios: ScenarioSet | null = null;
  let underflow: UnderflowHelp | null = null;
  let sizingRefusal: string | null = null;
  if (
    specs.ok &&
    side !== null &&
    entry !== null &&
    equity !== null &&
    riskPct !== null &&
    stopDistance !== null &&
    rrr !== null &&
    c0.status === 'PASS'
  ) {
    const sizingInput: SizingInput = {
      side,
      entry,
      stopDistance,
      equity,
      riskPct,
      maxLeverage: profile.maxLeverage,
      commission: profile.commission,
      spec: specs.figures.spec,
    };
    try {
      scenarios = buildScenarios(sizingInput, { targetRrr: rrr, counterTrend });
      // null when the lot fits; otherwise what the trader may do about it, inside his limits
      underflow = underflowHelp(sizingInput, {
        maxRiskPct: profile.maxRiskPct,
        minSld: profile.minSld,
        structuralStopDistances: (choices === null
          ? []
          : choices.structural
        ).map((option) => option.stopDistance),
      });
    } catch (error) {
      if (!(error instanceof Engine4InputError)) throw error;
      sizingRefusal = error.message;
    }
  }

  // -- 4: leverage -------------------------------------------------------------------------------
  const sizing = scenarios === null ? null : scenarios.sizing;
  if (sizing === null) {
    c4.skipped = true;
  } else if (sizing.status === 'OK') {
    if (sizing.leverageUsed.gt(Rational.of(profile.maxLeverage))) {
      c4.fail(
        'LEVERAGE_ABOVE_MAX',
        'the lot uses more leverage than your maximum'
      );
    } else if (sizing.limitedBy === 'LEVERAGE') {
      c4.notes.push('LOT_CLAMPED_BY_LEVERAGE');
    }
  }

  // -- 5: the news blackout -----------------------------------------------------------------------
  if (blackout.status === 'BLOCKED') {
    const ends =
      blackout.windowEndsAt === null
        ? ''
        : `; the window ends ${utcClock(blackout.windowEndsAt)} UTC`;
    c5.fail(
      'TIER1_BLACKOUT',
      `${blackout.blocks.map((block) => block.eventName).join(', ')}${ends}`
    );
  } else if (blackout.status === 'UNKNOWN') {
    for (const reason of blackout.unknownReasons) {
      c5.fail(reason, 'the news blackout cannot be judged');
    }
  } else if (blackout.calendar.late) {
    c5.notes.push('CALENDAR_LATE');
  }

  // -- 6: the setup is still valid and the data allows it ------------------------------------------
  for (const reason of offer.reasons) {
    if (reason.row === 6 || reason.row === 7 || reason.row === 9) {
      c6.fail(reason.code, reason.detail);
    }
  }
  if (offer.verdict === 'REFRESH_OFFERED') {
    c6.fail(
      'SETUP_CHANGED',
      'a newer cycle changed the picture: refresh the setup'
    );
  }
  if (zone !== null) {
    const picked = zone.zoneId;
    const checked = offer.zones.find(
      (candidate) => candidate.zoneId === picked
    );
    if (checked === undefined) {
      c6.fail(
        'ZONE_NOT_CHECKED',
        `${picked} was not checked against the price`
      );
    } else if (checked.invalidated) {
      c6.fail('PAST_INVALIDATION', `${picked}: this setup is no longer valid`);
    }
  }
  const typed = fields.side;
  if (typed !== undefined && typed !== null && typed !== '') {
    const key = typeof typed === 'string' ? typed.trim() : '';
    const word = Object.prototype.hasOwnProperty.call(SIDE_WORDS, key)
      ? SIDE_WORDS[key]
      : undefined;
    if (word === undefined) {
      c6.fail(
        'SIDE_NOT_RECOGNISED',
        'the side is not BUY, SELL, LONG or SHORT'
      );
    } else if (side !== null && word !== side) {
      c6.fail(
        'DIRECTION_MISMATCH',
        'the synthesis does not give that direction'
      );
    }
  }

  // -- 7: the lot ----------------------------------------------------------------------------------
  if (!specs.ok) {
    c7.fail('NO_BROKER_FIGURES', specs.detail);
    c7.notes.push(specs.code);
  } else if (sizingRefusal !== null) {
    c7.fail('SIZING_REFUSED', sizingRefusal);
  } else if (sizing === null) {
    c7.skipped = true;
  } else if (sizing.status === 'UNDERFLOW') {
    c7.fail(
      'LOT_BELOW_BROKER_MINIMUM',
      'the lot your limits allow is below the broker minimum'
    );
    for (const cause of sizing.causes) c7.notes.push(`CAUSE_${cause}`);
  } else {
    c7.notes.push(`LIMITED_BY_${sizing.limitedBy}`);
  }

  // -- the half-risk override -------------------------------------------------------------------------
  const risk = riskPreset(profile, offer);
  const overridden = riskPct !== null && riskPct.gt(risk.preset);

  const checks = [c0, c1, c2, c3, c4, c5, c6, c7].map((check) =>
    check.result()
  );
  return {
    schema: VALIDATED_SETUP_SCHEMA,
    ok: checks.every((check) => check.status === 'PASS'),
    pinnedSlot: offer.pinnedSlot === null ? null : offer.pinnedSlot.toString(),
    side,
    counterTrend,
    entry: {
      price: entry === null ? null : entry.toString(),
      source: entry === null ? null : zone === null ? 'CUSTOM' : 'ZONE',
      zoneId: zone === null ? null : zone.zoneId,
    },
    equity: equity === null ? null : equity.toString(),
    riskPct: riskPct === null ? null : riskPct.toString(),
    stop: {
      distance: stopDistance === null ? null : stopDistance.toString(),
      price: stopPrice === null ? null : stopPrice.toString(),
      kind: stopKind,
      level: stopLevel,
    },
    rrr: rrr === null ? null : rrr.toString(),
    profile: { ...profile },
    risk: {
      preset: risk.preset.toString(),
      max: risk.max.toString(),
      halfRisk: risk.halfRisk,
      reasons: risk.reasons,
    },
    overrides: {
      defectFlag:
        overridden && riskPct !== null
          ? {
              preset: risk.preset.toString(),
              chosen: riskPct.toString(),
              reasons: risk.reasons,
            }
          : null,
    },
    notices: offer.notices.map((notice) => notice.code),
    warnings: blackout.warnings.map((warning) => ({
      eventId: warning.eventId,
      eventName: warning.eventName,
      eventTime: warning.eventTime.toString(),
      approximate: warning.approximate,
      tier1: warning.tier1,
    })),
    checks,
    scenarios,
    underflow,
    versions: {
      specs: specs.ok ? specs.figures.version.toString() : null,
      tier1List: blackout.listVersion,
    },
  };
}
