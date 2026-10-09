/**
 * The offer check: is Report 2 offered, and if not, why not
 * (architecture 6.4, ADR-058, ADR-059).
 *
 * It runs before Report 1 is shown and again when the modal is submitted. It
 * holds no clock, no database and no network: the pinned reading, the newest
 * reading, the LIVE data status, the blackout verdict, the broker figures, the
 * zones and the newest price are all passed in, so every row of the table is a
 * case of one pure function.
 *
 * The nine rows of 6.4, by row:
 *
 *   1  FRESH, LONG or SHORT                    OFFERED
 *   2  DELAYED                                 OFFERED, notice `DATA_DELAYED`
 *   3  CAUTIONARY, or RETUNING                 OFFERED, half risk pre-set (`CAUTIONARY`, `RETUNING`)
 *   4  outside the trader's style              OFFERED, notice `STYLE_COUNTER_TREND` / `STYLE_WITH_TREND`
 *   5  a newer cycle changed the synthesis     REFRESH_OFFERED, `NEWER_CYCLE_CHANGED`
 *   6  NEUTRAL or STAND_ASIDE                  NOT OFFERED, `SYNTHESIS_NEUTRAL` / `SYNTHESIS_STAND_ASIDE`
 *   7  STALE or MARKET CLOSED                  NOT OFFERED, `DATA_STALE` / `MARKET_CLOSED`
 *   8  a Tier-1 release within the window      NOT OFFERED, `TIER1_BLACKOUT`
 *   9  price already past the invalidation     NOT OFFERED, `PAST_INVALIDATION`
 *
 * Beyond the table, and ALWAYS failing closed (an unknown is never an offer):
 * a synthesis that cannot be read (`SYNTHESIS_UNUSABLE`, row 6), a live data
 * status that was not supplied (`DATA_STATUS_UNKNOWN`, row 7), a Tier-1 list or
 * calendar that cannot answer (`CALENDAR_*`, row 8), no usable zone, an unknown
 * zone or no price (`NO_ZONES`, `ZONE_UNKNOWN`, `PRICE_UNKNOWN`, row 9), and the
 * broker figures of 6.9 and 7.6 (`SPECS_*`, row 10: older than 7 days, missing,
 * unreadable). When several "not offered" reasons apply the FIRST in table order
 * is the reason shown and every one is returned (plan assumption A1).
 *
 * The pinned reading decides what Report 2 would be (ADR-059): direction, trend
 * relation, caution. What is true NOW decides whether it may be offered: the
 * live data status, the blackout, and the newest cycle's price against the
 * zone's invalidation (A2). A newer cycle whose reading differs offers a
 * refresh; it never silently replaces the pinned setup.
 *
 * @module lib/engine4/offer
 */

import type { BlackoutResult, BlackoutUnknownReason } from './blackout';
import type { BrokerProblemCode, BrokerResult } from './broker';
import { readPositive, type DecimalLike, type Rational } from './exact';
import { isRecord } from './levels';
import { readSeconds, utcClock } from './time';
import type { TradingStyle } from './types';
import type { ZoneInput } from './zone';

export type OfferVerdict = 'OFFERED' | 'REFRESH_OFFERED' | 'NOT_OFFERED';

export type NotOfferedCode =
  // row 6
  | 'SYNTHESIS_NEUTRAL'
  | 'SYNTHESIS_STAND_ASIDE'
  | 'SYNTHESIS_UNUSABLE'
  // row 7
  | 'DATA_STALE'
  | 'MARKET_CLOSED'
  | 'DATA_STATUS_UNKNOWN'
  // row 8
  | 'TIER1_BLACKOUT'
  | 'CALENDAR_LIST_NOT_SET'
  | 'CALENDAR_LIST_INVALID'
  | 'CALENDAR_LIST_INCOMPLETE'
  | 'CALENDAR_UNAVAILABLE'
  | 'CALENDAR_EMPTY'
  | 'CALENDAR_UNREADABLE'
  // row 9
  | 'PAST_INVALIDATION'
  | 'NO_ZONES'
  | 'ZONE_UNKNOWN'
  | 'PRICE_UNKNOWN'
  // row 10: the broker figures (6.9, 7.6)
  | 'SPECS_MISSING'
  | 'SPECS_UNREADABLE'
  | 'SPECS_STALE'
  | 'SPECS_FROM_THE_FUTURE'
  | 'SPECS_UNAVAILABLE';

/** The notices and cautions of an offered setup (rows 2 to 5). */
export type NoticeCode =
  | 'DATA_DELAYED'
  | 'CAUTIONARY'
  | 'RETUNING'
  | 'STYLE_COUNTER_TREND'
  | 'STYLE_WITH_TREND'
  | 'NEWER_CYCLE_CHANGED';

/** The row of the 6.4 table a "not offered" code belongs to; 10 is the broker figures, which the table does not list. */
export const NOT_OFFERED_ROW: Readonly<Record<NotOfferedCode, number>> = {
  SYNTHESIS_NEUTRAL: 6,
  SYNTHESIS_STAND_ASIDE: 6,
  SYNTHESIS_UNUSABLE: 6,
  DATA_STALE: 7,
  MARKET_CLOSED: 7,
  DATA_STATUS_UNKNOWN: 7,
  TIER1_BLACKOUT: 8,
  CALENDAR_LIST_NOT_SET: 8,
  CALENDAR_LIST_INVALID: 8,
  CALENDAR_LIST_INCOMPLETE: 8,
  CALENDAR_UNAVAILABLE: 8,
  CALENDAR_EMPTY: 8,
  CALENDAR_UNREADABLE: 8,
  PAST_INVALIDATION: 9,
  NO_ZONES: 9,
  ZONE_UNKNOWN: 9,
  PRICE_UNKNOWN: 9,
  SPECS_MISSING: 10,
  SPECS_UNREADABLE: 10,
  SPECS_STALE: 10,
  SPECS_FROM_THE_FUTURE: 10,
  SPECS_UNAVAILABLE: 10,
};

export interface OfferReason {
  code: NotOfferedCode;
  /** the row of the 6.4 table (10: the broker figures) */
  row: number;
  /** English text; the codes are what step 6 translates */
  detail: string;
}

export interface OfferNotice {
  code: NoticeCode;
  detail: string;
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * A synthesis reading as the offer check needs it: the columns of a
 * `synthesis_readings` row. Strings are checked here, so a value the database
 * should never hold is "unusable", not trusted.
 */
export interface OfferSynthesis {
  cycleSlot: DecimalLike;
  /** LONG, SHORT, NEUTRAL or STAND_ASIDE */
  bias: string;
  /** VALID, CAUTIONARY, INVALID or STALE */
  status: string;
  statusReasons: readonly string[];
  /** WITH_TREND or COUNTER_TREND; null when the reading has no direction */
  trendRelation: string | null;
  ruleId: string;
  branchId: string | null;
  /** the cycle was RETUNING when it was read (`retuning_observed`) */
  retuning: boolean;
}

/** What may be trusted right now, as the gateway computes it (never stored on a cycle). */
export interface LiveDataStatus {
  /** FRESH, DELAYED, STALE or MARKET_CLOSED */
  status: string;
  /** the slot of the newest ready cycle: "data as of hh:mm UTC" */
  dataAsOfSlot: DecimalLike | null;
}

export interface OfferInput {
  nowSeconds: DecimalLike;
  /** profile metric 2 */
  style: TradingStyle;
  /** the reading Report 1 used (ADR-059); null when it could not be found */
  pinned: OfferSynthesis | null;
  /** the newest cycle's reading for the same profile, when it is newer than the pinned one; null when none is known */
  newest: OfferSynthesis | null;
  /** the live status; null when it was not obtained, which is NOT an offer */
  dataStatus: LiveDataStatus | null;
  blackout: BlackoutResult;
  specs: BrokerResult;
  /** the zones of the pinned reading */
  zones: readonly ZoneInput[];
  /** the zone the trader picked; absent before a pick (Report 1's check) */
  zoneId?: string;
  /** the newest cycle's reference price (the last closed M5 close, ADR-086); null when unknown */
  price: DecimalLike | null;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export type SynthesisChange =
  | 'BIAS'
  | 'TREND_RELATION'
  | 'RULE'
  | 'BRANCH'
  | 'STATUS';

export interface RefreshOffer {
  /** the newer cycle's slot */
  newSlot: bigint;
  changes: SynthesisChange[];
}

export interface ZoneCheck {
  zoneId: string;
  /** the price is at or past the zone's invalidation */
  invalidated: boolean;
}

export interface OfferResult {
  verdict: OfferVerdict;
  /** the reason shown: the first "not offered" reason in table order (A1); null unless NOT_OFFERED */
  reason: OfferReason | null;
  /** every "not offered" reason that applied, in table order: the trace */
  reasons: OfferReason[];
  /** delay, caution, style and refresh notices; empty when NOT_OFFERED */
  notices: OfferNotice[];
  /** the modal pre-sets half the trader's risk (6.4 row 3, ADR-061) */
  halfRiskPreset: boolean;
  /** why: the sensors' caution reasons, and RETUNING */
  halfRiskReasons: string[];
  refresh: RefreshOffer | null;
  /** the zones checked against the price: invalidated ones are not selectable */
  zones: ZoneCheck[];
  pinnedSlot: bigint | null;
  dataAsOfSlot: bigint | null;
  /** the broker row's version (ADR-066), null when there is none */
  specsVersion: bigint | null;
  /** the Tier-1 list's version, null when there was none */
  tier1ListVersion: number | null;
}

// ---------------------------------------------------------------------------
// Reading what is passed in
// ---------------------------------------------------------------------------

const BIASES: readonly string[] = ['LONG', 'SHORT', 'NEUTRAL', 'STAND_ASIDE'];
const STATUSES: readonly string[] = ['VALID', 'CAUTIONARY', 'INVALID', 'STALE'];
const LIVE_STATUSES: readonly string[] = [
  'FRESH',
  'DELAYED',
  'STALE',
  'MARKET_CLOSED',
];

interface ReadSynthesis {
  slot: bigint;
  bias: 'LONG' | 'SHORT' | 'NEUTRAL' | 'STAND_ASIDE';
  status: 'VALID' | 'CAUTIONARY' | 'INVALID' | 'STALE';
  statusReasons: readonly string[];
  trendRelation: 'WITH_TREND' | 'COUNTER_TREND' | null;
  ruleId: string;
  branchId: string | null;
  retuning: boolean;
}

/** The reading, or the reason it cannot be used. */
function readSynthesis(
  raw: OfferSynthesis | null
): { ok: true; reading: ReadSynthesis } | { ok: false; detail: string } {
  if (raw === null)
    return { ok: false, detail: 'there is no synthesis reading' };
  let slot: bigint;
  try {
    slot = readSeconds('cycleSlot', raw.cycleSlot);
  } catch {
    return { ok: false, detail: 'the reading has no cycle slot' };
  }
  if (!BIASES.includes(raw.bias)) {
    return { ok: false, detail: 'the reading has no known bias' };
  }
  if (!STATUSES.includes(raw.status)) {
    return { ok: false, detail: 'the reading has no known status' };
  }
  const relation = raw.trendRelation;
  if (
    relation !== null &&
    relation !== 'WITH_TREND' &&
    relation !== 'COUNTER_TREND'
  ) {
    return { ok: false, detail: 'the reading has an unknown trend relation' };
  }
  return {
    ok: true,
    reading: {
      slot,
      bias: raw.bias as ReadSynthesis['bias'],
      status: raw.status as ReadSynthesis['status'],
      statusReasons: raw.statusReasons,
      trendRelation: relation,
      ruleId: raw.ruleId,
      branchId: raw.branchId,
      retuning: raw.retuning,
    },
  };
}

/**
 * The live status from the gateway's `dataStatus` object (`{ status, reason,
 * dataAsOfSlot, secondsSinceReady }`), or null when it is not one. Strict:
 * a status outside the four is not a status.
 */
export function parseLiveDataStatus(raw: unknown): LiveDataStatus | null {
  if (!isRecord(raw)) return null;
  const status = raw['status'];
  if (typeof status !== 'string' || !LIVE_STATUSES.includes(status))
    return null;
  const slot = raw['dataAsOfSlot'];
  if (slot === null || slot === undefined)
    return { status, dataAsOfSlot: null };
  try {
    readSeconds('dataAsOfSlot', slot);
  } catch {
    return null;
  }
  return { status, dataAsOfSlot: slot as DecimalLike };
}

// ---------------------------------------------------------------------------
// The check
// ---------------------------------------------------------------------------

const UNKNOWN_CALENDAR: Readonly<
  Record<BlackoutUnknownReason, NotOfferedCode>
> = {
  LIST_NOT_SET: 'CALENDAR_LIST_NOT_SET',
  LIST_INVALID: 'CALENDAR_LIST_INVALID',
  LIST_INCOMPLETE: 'CALENDAR_LIST_INCOMPLETE',
  CALENDAR_UNAVAILABLE: 'CALENDAR_UNAVAILABLE',
  CALENDAR_EMPTY: 'CALENDAR_EMPTY',
  EVENT_UNREADABLE: 'CALENDAR_UNREADABLE',
};

const UNKNOWN_CALENDAR_TEXT: Readonly<Record<BlackoutUnknownReason, string>> = {
  LIST_NOT_SET: 'the Tier-1 release list is not set',
  LIST_INVALID: 'the Tier-1 release list could not be read',
  LIST_INCOMPLETE: 'the Tier-1 release list does not cover every release',
  CALENDAR_UNAVAILABLE: 'the news calendar could not be read',
  CALENDAR_EMPTY: 'the news calendar holds no release',
  EVENT_UNREADABLE: 'a news calendar row could not be read',
};

const SPECS_CODE: Readonly<Record<BrokerProblemCode, NotOfferedCode>> = {
  NO_SPECS: 'SPECS_MISSING',
  SPECS_UNREADABLE: 'SPECS_UNREADABLE',
  SPECS_STALE: 'SPECS_STALE',
  SPECS_FROM_THE_FUTURE: 'SPECS_FROM_THE_FUTURE',
  DATABASE_ERROR: 'SPECS_UNAVAILABLE',
};

function reasonOf(code: NotOfferedCode, detail: string): OfferReason {
  return { code, row: NOT_OFFERED_ROW[code], detail };
}

function pastInvalidation(zone: ZoneInput, price: Rational): boolean {
  return zone.bias === 'LONG'
    ? price.lte(zone.invalidationPrice)
    : price.gte(zone.invalidationPrice);
}

function changesBetween(
  pinned: ReadSynthesis,
  newest: ReadSynthesis
): SynthesisChange[] {
  const changes: SynthesisChange[] = [];
  if (pinned.bias !== newest.bias) changes.push('BIAS');
  if (pinned.trendRelation !== newest.trendRelation)
    changes.push('TREND_RELATION');
  if (pinned.ruleId !== newest.ruleId) changes.push('RULE');
  if (pinned.branchId !== newest.branchId) changes.push('BRANCH');
  if (pinned.status !== newest.status) changes.push('STATUS');
  return changes;
}

export function checkOffer(input: OfferInput): OfferResult {
  readSeconds('nowSeconds', input.nowSeconds);
  const reasons: OfferReason[] = [];
  const fail = (code: NotOfferedCode, detail: string): void => {
    reasons.push(reasonOf(code, detail));
  };

  // -- row 6: the synthesis -----------------------------------------------------
  const pinnedRead = readSynthesis(input.pinned);
  const pinned = pinnedRead.ok ? pinnedRead.reading : null;
  let direction: 'LONG' | 'SHORT' | null = null;
  if (pinned === null) {
    fail('SYNTHESIS_UNUSABLE', (pinnedRead as { detail: string }).detail);
  } else if (pinned.bias === 'NEUTRAL' || pinned.bias === 'STAND_ASIDE') {
    const why =
      pinned.statusReasons.length > 0
        ? pinned.statusReasons.join(', ')
        : `rule ${pinned.ruleId}`;
    fail(
      pinned.bias === 'NEUTRAL' ? 'SYNTHESIS_NEUTRAL' : 'SYNTHESIS_STAND_ASIDE',
      `the synthesis gives no direction (${pinned.bias}: ${why})`
    );
  } else if (pinned.status === 'INVALID' || pinned.status === 'STALE') {
    fail(
      'SYNTHESIS_UNUSABLE',
      `the synthesis reading is ${pinned.status} and still names a direction`
    );
  } else if (pinned.trendRelation === null) {
    fail(
      'SYNTHESIS_UNUSABLE',
      'the reading names a direction but no trend relation'
    );
  } else {
    direction = pinned.bias;
  }

  // -- row 7: the live data status ----------------------------------------------
  let dataAsOf: bigint | null = null;
  let liveStatus: string | null = null;
  if (
    input.dataStatus === null ||
    !LIVE_STATUSES.includes(input.dataStatus.status)
  ) {
    fail('DATA_STATUS_UNKNOWN', 'the live data status was not available');
  } else {
    liveStatus = input.dataStatus.status;
    if (input.dataStatus.dataAsOfSlot !== null) {
      try {
        dataAsOf = readSeconds('dataAsOfSlot', input.dataStatus.dataAsOfSlot);
      } catch {
        fail(
          'DATA_STATUS_UNKNOWN',
          'the live data status has no readable time'
        );
      }
    }
    const asOf =
      dataAsOf === null ? 'no ready cycle' : `${utcClock(dataAsOf)} UTC`;
    if (liveStatus === 'STALE') {
      fail('DATA_STALE', `data stopped at ${asOf}`);
    } else if (liveStatus === 'MARKET_CLOSED') {
      fail(
        'MARKET_CLOSED',
        `the market is closed; the last picture is as of ${asOf}`
      );
    }
  }

  // -- row 8: the Tier-1 blackout ------------------------------------------------
  const blackout = input.blackout;
  if (blackout.status === 'BLOCKED') {
    const ends =
      blackout.windowEndsAt === null
        ? ''
        : `; the window ends ${utcClock(blackout.windowEndsAt)} UTC`;
    const names = blackout.blocks
      .map((block) => `${block.eventName} at ${utcClock(block.eventTime)} UTC`)
      .join(', ');
    fail('TIER1_BLACKOUT', `${names}${ends}`);
  }
  for (const unknown of blackout.unknownReasons) {
    fail(UNKNOWN_CALENDAR[unknown], UNKNOWN_CALENDAR_TEXT[unknown]);
  }

  // -- row 9: the zones against the newest price (A2) ------------------------------
  const zoneChecks: ZoneCheck[] = [];
  if (direction !== null) {
    let price: Rational | null = null;
    try {
      price = readPositive('price', input.price);
    } catch {
      price = null;
    }
    const usable = input.zones.filter((zone) => zone.bias === direction);
    if (price === null) {
      fail('PRICE_UNKNOWN', 'the newest price was not available');
    } else if (usable.length === 0) {
      fail('NO_ZONES', 'the reading has no entry zone on its side');
    } else {
      for (const zone of usable) {
        zoneChecks.push({
          zoneId: zone.zoneId,
          invalidated: pastInvalidation(zone, price),
        });
      }
      if (input.zoneId !== undefined) {
        const picked = zoneChecks.find(
          (check) => check.zoneId === input.zoneId
        );
        if (picked === undefined) {
          fail('ZONE_UNKNOWN', `${input.zoneId} is not a zone of this reading`);
        } else if (picked.invalidated) {
          fail(
            'PAST_INVALIDATION',
            `${picked.zoneId}: this setup is no longer valid`
          );
        }
      } else if (zoneChecks.every((check) => check.invalidated)) {
        fail(
          'PAST_INVALIDATION',
          'every zone is past its invalidation: this setup is no longer valid'
        );
      }
    }
  }

  // -- row 10: the broker figures (6.9, 7.6) -------------------------------------------
  if (!input.specs.ok) {
    fail(SPECS_CODE[input.specs.code], input.specs.detail);
  }

  // the checks above run in the order of the table (6, 7, 8, 9, 10), so the first reason found is the
  // first in table order and is the one shown; a test holds every combination to that order
  const specsVersion = input.specs.ok
    ? input.specs.figures.version
    : input.specs.version;
  const base = {
    zones: zoneChecks,
    pinnedSlot: pinned === null ? null : pinned.slot,
    dataAsOfSlot: dataAsOf,
    specsVersion,
    tier1ListVersion: blackout.listVersion,
  };
  const shown = reasons[0];
  if (shown !== undefined || pinned === null) {
    return {
      verdict: 'NOT_OFFERED',
      reason: shown ?? null,
      reasons,
      notices: [],
      halfRiskPreset: false,
      halfRiskReasons: [],
      refresh: null,
      ...base,
    };
  }

  // -- rows 2 to 5: offered, with what the trader must be told --------------------------
  const notices: OfferNotice[] = [];
  const halfRiskReasons: string[] = [];
  let halfRisk = false;
  if (liveStatus === 'DELAYED') {
    notices.push({
      code: 'DATA_DELAYED',
      detail:
        dataAsOf === null
          ? 'the data is delayed'
          : `data as of ${utcClock(dataAsOf)} UTC`,
    });
  }
  if (pinned.status === 'CAUTIONARY') {
    halfRisk = true;
    halfRiskReasons.push(...pinned.statusReasons);
    notices.push({
      code: 'CAUTIONARY',
      detail: `the sensors are cautionary (${pinned.statusReasons.join(', ')}); half risk is pre-set and the trader may override`,
    });
  }
  if (pinned.retuning) {
    halfRisk = true;
    halfRiskReasons.push('RETUNING');
    notices.push({
      code: 'RETUNING',
      detail:
        'a promote is in progress (RETUNING); half risk is pre-set and the trader may override',
    });
  }
  if (
    input.style === 'TREND_FOLLOWING' &&
    pinned.trendRelation === 'COUNTER_TREND'
  ) {
    notices.push({
      code: 'STYLE_COUNTER_TREND',
      detail: 'Counter-trend setup; your style is trend following',
    });
  } else if (
    input.style === 'TREND_COUNTERING' &&
    pinned.trendRelation === 'WITH_TREND'
  ) {
    notices.push({
      code: 'STYLE_WITH_TREND',
      detail: 'With-trend setup; your style is trend countering',
    });
  }

  // -- row 5: a newer cycle changed the synthesis ---------------------------------------
  let refresh: RefreshOffer | null = null;
  const newestRead = input.newest === null ? null : readSynthesis(input.newest);
  if (
    newestRead !== null &&
    newestRead.ok &&
    newestRead.reading.slot > pinned.slot
  ) {
    const changes = changesBetween(pinned, newestRead.reading);
    if (changes.length > 0) {
      refresh = { newSlot: newestRead.reading.slot, changes };
      notices.push({
        code: 'NEWER_CYCLE_CHANGED',
        detail: `The picture changed at ${utcClock(newestRead.reading.slot)} UTC`,
      });
    }
  }

  return {
    verdict: refresh === null ? 'OFFERED' : 'REFRESH_OFFERED',
    reason: null,
    reasons,
    notices,
    halfRiskPreset: halfRisk,
    halfRiskReasons,
    refresh,
    ...base,
  };
}
