/**
 * From the codes Engine 4 returns to the words Report 2 shows (build step 5, part 7).
 *
 * Engine 4 gives a CODE for every refusal, notice and reason, with an English
 * sentence for developers and logs (plan assumption A7). The codes are what get
 * translated: each maps to one key of `text.ts`, and a code nobody listed falls
 * back to a general sentence, so a new engine code can never show a raw token or
 * crash the card. Several codes may share one sentence (six calendar problems all
 * say "the calendar could not be checked").
 *
 * A message may need a figure ("your maximum of {max}"). `describe*` returns the
 * key and the figures as typed values, not as text: the component formats them
 * with the viewer's formatters and `fillText` puts them in. Nothing here formats
 * a number.
 *
 * @module lib/engine4/templates/messages
 */

import { ENTRY_TYPO_FRACTION } from '../entry-bound';
import { Rational } from '../exact';
import type { Report2Key } from './text';

/** How a figure is to be shown. */
export type ParamKind =
  | 'percent'
  /** a percentage shown with only the places it needs: 5%, not 5.00% */
  | 'percent_free'
  | 'ratio'
  | 'money'
  | 'price'
  | 'multiple'
  | 'lot'
  | 'time'
  | 'raw';

/** A figure from Engine 4, as exact text (a time is unix seconds as text), and how to show it. */
export interface ParamValue {
  kind: ParamKind;
  text: string;
}

export type MessageParams = Readonly<Record<string, ParamValue>>;

/** A message: the key, and the figures that fill its placeholders. */
export interface Described {
  key: Report2Key;
  params: MessageParams;
}

/** The limits a message may quote, as the modal's definition gave them (all exact text). */
export interface MessageLimits {
  /** Max RPT, percent */
  riskMax?: string;
  /** the least stop distance, dollars of price */
  stopMin?: string;
  rrrMin?: string;
  rrrMax?: string;
}

const NO_PARAMS: MessageParams = {};

type Builder = (limits: MessageLimits) => MessageParams;

function have(text: string | undefined, kind: ParamKind): ParamValue | null {
  return text === undefined ? null : { kind, text };
}

function only(name: string, value: ParamValue | null): MessageParams {
  return value === null ? NO_PARAMS : { [name]: value };
}

interface Entry {
  key: Report2Key;
  params?: Builder;
}

const entry = (key: Report2Key, params?: Builder): Entry =>
  params === undefined ? { key } : { key, params };

/** The codes of the eight checks (validate.ts, entry-bound.ts) and of the offer rows 6, 7 and 9 they repeat. */
const CHECK_CODES: Readonly<Record<string, Entry>> = {
  // 0 entry
  ENTRY_MISSING: entry('report2.err.entry_required'),
  ENTRY_ZONE_UNKNOWN: entry('report2.err.entry_required'),
  ENTRY_NOT_A_NUMBER: entry('report2.err.entry_number'),
  ENTRY_NOT_POSITIVE: entry('report2.err.entry_number'),
  ENTRY_OUTSIDE_DAY_RANGE: entry('report2.err.entry_range'),
  // the filter is the engine's (ADR-034), so the figure in the sentence is too
  ENTRY_TYPO: entry('report2.err.entry_typo', () => ({
    limit: {
      kind: 'percent_free',
      text:
        Rational.of(ENTRY_TYPO_FRACTION)
          .mul(Rational.int(100n))
          .toExactDecimal() ?? '5',
    },
  })),
  LIVE_PRICE_UNKNOWN: entry('report2.err.entry_unknown'),
  DAY_RANGE_UNKNOWN: entry('report2.err.entry_unknown'),
  // 1 risk and equity
  EQUITY_MISSING: entry('report2.err.equity'),
  EQUITY_NOT_A_NUMBER: entry('report2.err.equity'),
  EQUITY_NOT_POSITIVE: entry('report2.err.equity'),
  RISK_MISSING: entry('report2.err.risk_number'),
  RISK_NOT_A_NUMBER: entry('report2.err.risk_number'),
  RISK_NOT_POSITIVE: entry('report2.err.risk_number'),
  RISK_ABOVE_MAX_RPT: entry('report2.err.risk_max', (l) =>
    only('max', have(l.riskMax, 'percent'))
  ),
  // 2 stop
  STOP_MISSING: entry('report2.err.stop_number'),
  STOP_NOT_A_NUMBER: entry('report2.err.stop_number'),
  STOP_NOT_POSITIVE: entry('report2.err.stop_number'),
  STOP_PRICE_NOT_POSITIVE: entry('report2.err.stop_number'),
  STOP_BELOW_MIN_SLD: entry('report2.err.stop_min', (l) =>
    only('min', have(l.stopMin, 'price'))
  ),
  // 3 RRR
  RRR_MISSING: entry('report2.err.rrr_number'),
  RRR_NOT_A_NUMBER: entry('report2.err.rrr_number'),
  RRR_BELOW_MIN: entry('report2.err.rrr_range', rrrRange),
  RRR_ABOVE_MAX: entry('report2.err.rrr_range', rrrRange),
  RRR_ABOVE_COUNTER_TREND_CAP: entry('report2.err.rrr_counter_cap', (l) =>
    only('max', have(l.rrrMax, 'ratio'))
  ),
  // 4 leverage
  LEVERAGE_ABOVE_MAX: entry('report2.err.leverage'),
  // 5 news window
  TIER1_BLACKOUT: entry('report2.err.blackout'),
  LIST_NOT_SET: entry('report2.err.calendar'),
  LIST_INVALID: entry('report2.err.calendar'),
  LIST_INCOMPLETE: entry('report2.err.calendar'),
  CALENDAR_UNAVAILABLE: entry('report2.err.calendar'),
  CALENDAR_EMPTY: entry('report2.err.calendar'),
  EVENT_UNREADABLE: entry('report2.err.calendar'),
  // 6 the setup is still valid
  SETUP_CHANGED: entry('report2.err.setup_changed'),
  ZONE_NOT_CHECKED: entry('report2.err.past_invalidation'),
  PAST_INVALIDATION: entry('report2.err.past_invalidation'),
  SIDE_NOT_RECOGNISED: entry('report2.err.direction'),
  DIRECTION_MISMATCH: entry('report2.err.direction'),
  SYNTHESIS_NEUTRAL: entry('report2.not_offered.neutral'),
  SYNTHESIS_STAND_ASIDE: entry('report2.not_offered.stand_aside'),
  SYNTHESIS_UNUSABLE: entry('report2.not_offered.unusable'),
  NO_ZONES: entry('report2.not_offered.unusable'),
  ZONE_UNKNOWN: entry('report2.not_offered.unusable'),
  DATA_STALE: entry('report2.not_offered.data_unknown'),
  DATA_STATUS_UNKNOWN: entry('report2.not_offered.data_unknown'),
  MARKET_CLOSED: entry('report2.not_offered.market_closed'),
  PRICE_UNKNOWN: entry('report2.not_offered.price_unknown'),
  // 7 the lot
  NO_BROKER_FIGURES: entry('report2.err.no_broker'),
  SIZING_REFUSED: entry('report2.err.sizing'),
  LOT_BELOW_BROKER_MINIMUM: entry('report2.err.lot_below_min'),
};

function rrrRange(limits: MessageLimits): MessageParams {
  if (limits.rrrMin === undefined || limits.rrrMax === undefined) {
    return NO_PARAMS;
  }
  return {
    min: { kind: 'ratio', text: limits.rrrMin },
    max: { kind: 'ratio', text: limits.rrrMax },
  };
}

/** The message for a code of one of the eight checks. An unknown code gets the general sentence. */
export function describeCheckCode(
  code: string,
  limits: MessageLimits = {}
): Described {
  const found = Object.prototype.hasOwnProperty.call(CHECK_CODES, code)
    ? CHECK_CODES[code]
    : undefined;
  if (found === undefined)
    return { key: 'report2.err.generic', params: NO_PARAMS };
  return {
    key: found.key,
    params: found.params === undefined ? NO_PARAMS : found.params(limits),
  };
}

/** What the "not offered" sentences may quote. */
export interface NotOfferedFacts {
  /** the slot of the newest ready cycle, unix seconds as text */
  dataAsOfSlot: string | null;
  /** the first release that blocks, and when its window ends (unix seconds as text) */
  block: { name: string; time: string; end: string } | null;
}

/**
 * The sentence for a reason the offer check gave (6.4, rows 6 to 10). The row-6
 * to row-9 codes that the checks repeat share their sentences; the calendar and
 * the broker figures group.
 */
export function describeNotOffered(
  code: string,
  facts: NotOfferedFacts
): Described {
  switch (code) {
    case 'SYNTHESIS_NEUTRAL':
      return { key: 'report2.not_offered.neutral', params: NO_PARAMS };
    case 'SYNTHESIS_STAND_ASIDE':
      return { key: 'report2.not_offered.stand_aside', params: NO_PARAMS };
    case 'SYNTHESIS_UNUSABLE':
    case 'NO_ZONES':
    case 'ZONE_UNKNOWN':
      return { key: 'report2.not_offered.unusable', params: NO_PARAMS };
    case 'DATA_STALE':
      return facts.dataAsOfSlot === null
        ? { key: 'report2.not_offered.data_unknown', params: NO_PARAMS }
        : {
            key: 'report2.not_offered.data_stale',
            params: { time: { kind: 'time', text: facts.dataAsOfSlot } },
          };
    case 'DATA_STATUS_UNKNOWN':
      return { key: 'report2.not_offered.data_unknown', params: NO_PARAMS };
    case 'MARKET_CLOSED':
      return { key: 'report2.not_offered.market_closed', params: NO_PARAMS };
    case 'TIER1_BLACKOUT':
      return facts.block === null
        ? { key: 'report2.err.blackout', params: NO_PARAMS }
        : {
            key: 'report2.not_offered.blackout',
            params: {
              name: { kind: 'raw', text: facts.block.name },
              time: { kind: 'time', text: facts.block.time },
              end: { kind: 'time', text: facts.block.end },
            },
          };
    case 'PAST_INVALIDATION':
      return {
        key: 'report2.not_offered.past_invalidation',
        params: NO_PARAMS,
      };
    case 'PRICE_UNKNOWN':
      return { key: 'report2.not_offered.price_unknown', params: NO_PARAMS };
    default:
      if (code.startsWith('CALENDAR_')) {
        return { key: 'report2.not_offered.calendar', params: NO_PARAMS };
      }
      if (code.startsWith('SPECS_')) {
        return { key: 'report2.not_offered.specs', params: NO_PARAMS };
      }
      return { key: 'report2.not_offered.unusable', params: NO_PARAMS };
  }
}

/** The codes of the offer's notices (6.4 rows 2 to 5). */
export function describeNotice(
  code: string,
  facts: {
    dataAsOfSlot: string | null;
    newSlot: string | null;
    cap: string | null;
  }
): Described | null {
  switch (code) {
    case 'DATA_DELAYED':
      return facts.dataAsOfSlot === null
        ? { key: 'report2.notice.data_delayed_plain', params: NO_PARAMS }
        : {
            key: 'report2.notice.data_delayed',
            params: { time: { kind: 'time', text: facts.dataAsOfSlot } },
          };
    case 'CAUTIONARY':
      return { key: 'report2.notice.cautionary', params: NO_PARAMS };
    case 'RETUNING':
      return { key: 'report2.notice.retuning', params: NO_PARAMS };
    case 'STYLE_COUNTER_TREND':
      return facts.cap === null
        ? { key: 'report2.setup.counter_trend', params: NO_PARAMS }
        : {
            key: 'report2.notice.style_counter_trend',
            params: { cap: { kind: 'ratio', text: facts.cap } },
          };
    case 'STYLE_WITH_TREND':
      return { key: 'report2.notice.style_with_trend', params: NO_PARAMS };
    case 'NEWER_CYCLE_CHANGED':
      return facts.newSlot === null
        ? null
        : {
            key: 'report2.notice.newer_cycle',
            params: { time: { kind: 'time', text: facts.newSlot } },
          };
    default:
      return null;
  }
}

/**
 * What a route's refusal says to the trader. The route's own English sentence is
 * for developers; the code decides the words. Anything not listed is the general
 * "something went wrong, nothing was recorded".
 */
export function describeApiError(code: string): Described {
  switch (code) {
    case 'UNAUTHENTICATED':
      return { key: 'report2.api.unauthenticated', params: NO_PARAMS };
    case 'TIER_REQUIRED':
      return { key: 'report2.api.tier', params: NO_PARAMS };
    case 'FEATURE_DISABLED':
      return { key: 'report2.api.disabled', params: NO_PARAMS };
    case 'PROFILE_NOT_SET':
      return { key: 'report2.api.profile', params: NO_PARAMS };
    case 'SUBMISSION_IN_FLIGHT':
      return { key: 'report2.api.in_flight', params: NO_PARAMS };
    case 'SETUP_CHANGED':
      return { key: 'report2.consent.setup_changed', params: NO_PARAMS };
    case 'DATA_UNAVAILABLE':
    case 'AUDIT_NOT_CONFIGURED':
      return { key: 'report2.api.unavailable', params: NO_PARAMS };
    case 'NETWORK':
      return { key: 'report2.api.network', params: NO_PARAMS };
    default:
      return { key: 'report2.api.generic', params: NO_PARAMS };
  }
}
