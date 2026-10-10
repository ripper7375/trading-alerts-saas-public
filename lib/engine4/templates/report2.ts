/**
 * Report 2 as a fixed template (architecture 6.10, ADR-068; build step 5, part 7).
 *
 * `buildReport2` turns what the routes answered (`ValidatedSetup`, the badge, the
 * offer) into a DOCUMENT: ordered sections of label keys and typed figures. The
 * card draws the document and the modal draws pieces of it, so both show the same
 * numbers by construction. Nothing is computed by a model and no figure is made
 * here: a number is either one Engine 4 produced, rounded for display with exact
 * arithmetic, or the difference of two such numbers (the room to the next level).
 * Words are KEYS of `text.ts`; the component translates them and formats the
 * figures with the viewer's formatters.
 *
 * Display rounding (6.7: "checks use exact values; display rounds to 2 decimals"):
 * prices, money, percentages, ratios and multiples to 2 decimals, half away from
 * zero; a lot as its exact decimal, at least 2 places.
 *
 * Versions: the template and the disclaimer carry a version that the consent record
 * stores. Both are DRAFT until counsel's text replaces the wording (decision D14);
 * any change to the template or its texts bumps the template version.
 *
 * @module lib/engine4/templates/report2
 */

import { Rational } from '../exact';
import { PROFILE_BOUNDS } from '../profile';
import type { OmittedReason, ScenarioName } from '../types';
import {
  describeCheckCode,
  describeNotice,
  describeNotOffered,
  type Described,
  type MessageLimits,
  type ParamValue,
} from './messages';
import type { Report2Key } from './text';
import {
  readWire,
  type WireBadgeView,
  type WireBlackoutResult,
  type WireCheck,
  type WireOfferResult,
  type WireScenario,
  type WireValidatedSetup,
} from './wire';

export const REPORT2_TEMPLATE_VERSION = 'report2-template/draft-1';
export const REPORT2_DISCLAIMER_VERSION = 'disclaimer/draft-1';

/** A figure ready to be formatted: exact text, already rounded for display, and its kind. */
export type Shown = ParamValue;

const show = (
  kind: ParamValue['kind'],
  value: Rational,
  places = 2
): Shown => ({ kind, text: value.toDecimal(places) });

const showWire = (
  kind: ParamValue['kind'],
  text: string | null,
  places = 2
): Shown | null => (text === null ? null : show(kind, readWire(text), places));

/** A lot as its exact decimal with at least two places ("0.06", "1.00", "0.015"). */
export function lotText(value: Rational): string {
  const exact = value.toExactDecimal();
  if (exact === null) return value.toDecimal(4);
  if (!exact.includes('.')) return `${exact}.00`;
  return /\.\d$/.test(exact) ? `${exact}0` : exact;
}

const showLot = (value: Rational): Shown => ({
  kind: 'lot',
  text: lotText(value),
});

const NO_PARAMS: Described['params'] = {};

// ---------------------------------------------------------------------------
// The document
// ---------------------------------------------------------------------------

export interface HeaderDoc {
  side: 'BUY' | 'SELL' | null;
  directionKey: Report2Key | null;
  /** the setup is counter-trend (ADR-064) */
  counterTrend: boolean;
  /** the cycle the report is pinned to (unix seconds as text) */
  pinned: Shown | null;
}

export interface SetupDoc {
  entry: Shown | null;
  /** "Zone Z1" or "Your own entry" */
  entrySource: Described | null;
  stopPrice: Shown | null;
  stopDistance: Shown | null;
  /** the chart (bid) level of the stop, only when it differs from the order price */
  stopChartLevel: Shown | null;
  /** "Behind M5 LOEDT", "Minimum stop distance", "Custom stop" */
  stopHow: Described | null;
  equity: Shown | null;
  riskPct: Shown | null;
  rrr: Shown | null;
  /** half the maximum was pre-set, and why (codes from the sensors, shown as they are) */
  halfRisk: { preset: Shown; max: Shown; reasons: string[] } | null;
  /** the trader chose more than the pre-set half (6.6): recorded with the reason */
  override: { chosen: Shown; preset: Shown; reasons: string[] } | null;
}

export interface RiskPairDoc {
  declared: { money: Shown; pct: Shown };
  /** null when the lot is below the broker minimum: there is no lot to risk */
  actual: { money: Shown; pct: Shown } | null;
  lot: Shown | null;
  leverageUsed: Shown | null;
  leverageMax: Shown;
  limitedBy: Described | null;
  /** the lot was rounded down to the broker's lot step */
  roundedDown: boolean;
  spread: Shown;
  commission: Shown;
}

export interface ScenarioDoc {
  name: ScenarioName;
  nameKey: Report2Key;
  rrr: Shown;
  distance: Shown;
  /** the price the order triggers at (6.7 step 9) */
  price: Shown;
  /** the chart (bid) level, only when it differs from `price` (a SELL with a spread) */
  chartLevel: Shown | null;
  netProfit: Shown | null;
  /** this scenario carries the badge */
  badge: boolean;
}

export interface OmittedDoc {
  name: ScenarioName;
  nameKey: Report2Key;
  reason: Described;
}

export type RoomDoc =
  | { state: 'NAMED'; level: Shown; price: Shown; room: Shown }
  | { state: 'NONE' }
  | { state: 'UNKNOWN' }
  | { state: 'NOT_SIZED' };

export interface BadgeDoc {
  badge: ScenarioName | null;
  nameKey: Report2Key | null;
  /** why there is none, when there is none to explain */
  why: Described | null;
}

export type UnderflowActionDoc =
  | { kind: 'RAISE_RISK'; label: Described; riskPct: string }
  | { kind: 'NEARER_STOP'; label: Described; stopDistance: string };

export interface UnderflowDoc {
  minLotLoss: Shown;
  minLotRiskPct: Shown;
  /** facts, never buttons: what equity would be needed */
  facts: Described[];
  /** what the trader may do inside their limits */
  actions: UnderflowActionDoc[];
}

export interface WarningDoc {
  name: Shown;
  time: Shown;
  approximate: boolean;
}

export interface CheckDoc {
  id: number;
  nameKey: Report2Key;
  status: WireCheck['status'];
  messages: Described[];
}

export interface Report2Document {
  version: { template: string; disclaimer: string };
  /** all eight checks passed */
  ok: boolean;
  /** why the offer check no longer offers this setup (6.4), when it does not; null while it is offered */
  offerReason: Described | null;
  /** the numbers were acceptable and a sizing exists */
  sized: boolean;
  header: HeaderDoc;
  notices: Described[];
  setup: SetupDoc;
  risk: RiskPairDoc | null;
  scenarios: ScenarioDoc[];
  omitted: OmittedDoc[];
  room: RoomDoc;
  badge: BadgeDoc;
  underflow: UnderflowDoc | null;
  warnings: WarningDoc[];
  checks: CheckDoc[];
  /** on every report: the single-order notice, "you place the order with your broker", the disclaimer */
  compulsory: Report2Key[];
}

export interface Report2Input {
  setup: WireValidatedSetup;
  badge: WireBadgeView;
  /** the offer the answer carried; supplies the data time and the refresh slot for the notices */
  offer?: WireOfferResult;
  /** the blackout the offer answer carried; names the release behind a "news window" refusal */
  blackout?: WireBlackoutResult;
}

/** The three texts that are on every report, in this order. */
export const COMPULSORY_KEYS: readonly Report2Key[] = [
  'report2.notice.single_order',
  'report2.notice.broker_order',
  'report2.notice.calculation_tool',
];

const SCENARIO_KEYS: Readonly<Record<ScenarioName, Report2Key>> = {
  CONSERVATIVE: 'report2.scenario.conservative',
  NORMAL: 'report2.scenario.normal',
  AGGRESSIVE: 'report2.scenario.aggressive',
};

const CHECK_KEYS: Readonly<Record<WireCheck['name'], Report2Key>> = {
  ENTRY: 'report2.check.entry',
  RISK: 'report2.check.risk',
  STOP: 'report2.check.stop',
  RRR: 'report2.check.rrr',
  LEVERAGE: 'report2.check.leverage',
  BLACKOUT: 'report2.check.blackout',
  SETUP: 'report2.check.setup',
  LOT: 'report2.check.lot',
};

const OMITTED_REASON_KEYS: Readonly<Record<OmittedReason, Report2Key>> = {
  BELOW_MIN_RRR: 'report2.scenarios.omitted_below_min',
  ABOVE_MAX_RRR: 'report2.scenarios.omitted_above_max',
  ABOVE_COUNTER_TREND_CAP: 'report2.scenarios.omitted_above_cap',
};

/** The limits the messages of a setup quote, taken from the setup itself. */
export function limitsFromSetup(setup: WireValidatedSetup): MessageLimits {
  const ceiling = setup.counterTrend
    ? PROFILE_BOUNDS.counterTrendRrrCap
    : PROFILE_BOUNDS.targetRrr.max;
  return {
    riskMax: setup.risk.max,
    stopMin: setup.profile.minSld,
    rrrMin: Rational.of(PROFILE_BOUNDS.targetRrr.min).toString(),
    rrrMax: Rational.of(ceiling).toString(),
  };
}

// ---------------------------------------------------------------------------
// The builder
// ---------------------------------------------------------------------------

function headerOf(setup: WireValidatedSetup): HeaderDoc {
  return {
    side: setup.side,
    directionKey:
      setup.side === null
        ? null
        : setup.side === 'BUY'
          ? 'report2.direction.long'
          : 'report2.direction.short',
    counterTrend: setup.counterTrend,
    pinned:
      setup.pinnedSlot === null
        ? null
        : { kind: 'time', text: setup.pinnedSlot },
  };
}

function setupOf(setup: WireValidatedSetup): SetupDoc {
  const sizing = setup.scenarios === null ? null : setup.scenarios.sizing;
  const stopPrice = showWire('price', setup.stop.price);
  const chart =
    sizing === null ? null : show('price', readWire(sizing.stopChartLevel));
  const stopChartLevel =
    sizing !== null &&
    !readWire(sizing.stopChartLevel).eq(readWire(sizing.stopPrice))
      ? chart
      : null;
  let stopHow: Described | null = null;
  if (setup.stop.kind === 'STRUCTURAL' && setup.stop.level !== null) {
    stopHow = {
      key: 'report2.stop.behind',
      params: { level: { kind: 'raw', text: setup.stop.level } },
    };
  } else if (setup.stop.kind === 'MINIMUM_STOP') {
    stopHow = { key: 'report2.stop.minimum', params: NO_PARAMS };
  } else if (setup.stop.kind === 'CUSTOM') {
    stopHow = { key: 'report2.stop.custom', params: NO_PARAMS };
  }
  let entrySource: Described | null = null;
  if (setup.entry.source === 'ZONE' && setup.entry.zoneId !== null) {
    entrySource = {
      key: 'report2.entry.zone',
      params: { zone: { kind: 'raw', text: setup.entry.zoneId } },
    };
  } else if (setup.entry.source === 'CUSTOM') {
    entrySource = { key: 'report2.entry.own', params: NO_PARAMS };
  }
  const flag = setup.overrides.defectFlag;
  return {
    entry: showWire('price', setup.entry.price),
    entrySource,
    stopPrice,
    stopDistance: showWire('price', setup.stop.distance),
    stopChartLevel,
    stopHow,
    equity: showWire('money', setup.equity),
    riskPct: showWire('percent', setup.riskPct),
    rrr: showWire('ratio', setup.rrr),
    halfRisk: setup.risk.halfRisk
      ? {
          preset: show('percent', readWire(setup.risk.preset)),
          max: show('percent', readWire(setup.risk.max)),
          reasons: [...setup.risk.reasons],
        }
      : null,
    override:
      flag === null
        ? null
        : {
            chosen: show('percent', readWire(flag.chosen)),
            preset: show('percent', readWire(flag.preset)),
            reasons: [...flag.reasons],
          },
  };
}

function riskOf(setup: WireValidatedSetup): RiskPairDoc | null {
  if (setup.scenarios === null) return null;
  const sizing = setup.scenarios.sizing;
  const base = {
    declared: {
      money: show('money', readWire(sizing.declaredRisk)),
      pct: show('percent', readWire(sizing.declaredRiskPct)),
    },
    leverageMax: show('multiple', readWire(setup.profile.maxLeverage)),
    spread: show('price', readWire(sizing.spreadPrice)),
    commission: show('money', readWire(sizing.commission)),
  };
  if (sizing.status !== 'OK') {
    return {
      ...base,
      actual: null,
      lot: null,
      leverageUsed: null,
      limitedBy: null,
      roundedDown: false,
    };
  }
  const limitedBy: Report2Key =
    sizing.limitedBy === 'RISK'
      ? 'report2.pair.limited_risk'
      : sizing.limitedBy === 'LEVERAGE'
        ? 'report2.pair.limited_leverage'
        : 'report2.pair.limited_broker';
  return {
    ...base,
    actual: {
      money: show('money', readWire(sizing.actualRisk)),
      pct: show('percent', readWire(sizing.actualRiskPct)),
    },
    lot: showLot(readWire(sizing.lot)),
    leverageUsed: show('multiple', readWire(sizing.leverageUsed)),
    limitedBy: { key: limitedBy, params: NO_PARAMS },
    roundedDown: readWire(sizing.lot).lt(readWire(sizing.rawLot)),
  };
}

function scenarioOf(
  scenario: WireScenario,
  badge: ScenarioName | null
): ScenarioDoc {
  const price = readWire(scenario.target.targetPrice);
  const chart = readWire(scenario.target.targetChartLevel);
  return {
    name: scenario.name,
    nameKey: SCENARIO_KEYS[scenario.name],
    rrr: show('ratio', readWire(scenario.target.rrr)),
    distance: show('price', readWire(scenario.target.targetDistance)),
    price: show('price', price),
    chartLevel: chart.eq(price) ? null : show('price', chart),
    netProfit:
      scenario.target.netProfit === null
        ? null
        : show('money', readWire(scenario.target.netProfit)),
    badge: badge === scenario.name,
  };
}

function roomAndBadge(
  setup: WireValidatedSetup,
  view: WireBadgeView
): { room: RoomDoc; badge: BadgeDoc } {
  const none: BadgeDoc = { badge: null, nameKey: null, why: null };
  if (view.result === null) {
    const unknown =
      view.unavailable === 'LEVELS_UNAVAILABLE' ||
      view.unavailable === 'SYNTHESIS_UNAVAILABLE';
    return {
      room: { state: unknown ? 'UNKNOWN' : 'NOT_SIZED' },
      badge: unknown
        ? {
            ...none,
            why: { key: 'report2.badge.not_decided', params: NO_PARAMS },
          }
        : none,
    };
  }
  const result = view.result;
  const level = result.nextLevel;
  const entry = setup.entry.price;
  const named =
    level === null || entry === null
      ? null
      : {
          level: { kind: 'raw', text: `${level.tf} ${level.name}` } as Shown,
          price: show('price', readWire(level.price)),
          room: show('price', readWire(level.price).sub(readWire(entry)).abs()),
        };
  const room: RoomDoc =
    named === null ? { state: 'NONE' } : { state: 'NAMED', ...named };
  if (result.badge !== null) {
    return {
      room,
      badge: {
        badge: result.badge,
        nameKey: SCENARIO_KEYS[result.badge],
        why: null,
      },
    };
  }
  let why: Described | null = null;
  if (result.noBadgeReason === 'NO_SCENARIO_FITS' && named !== null) {
    why = {
      key: 'report2.badge.none_no_fit',
      params: { level: named.level, price: named.price },
    };
  } else if (result.noBadgeReason === 'NO_SCENARIO_WITHIN_STYLE') {
    why = { key: 'report2.badge.none_within_style', params: NO_PARAMS };
  }
  return { room, badge: { badge: null, nameKey: null, why } };
}

function underflowOf(setup: WireValidatedSetup): UnderflowDoc | null {
  const help = setup.underflow;
  if (help === null) return null;
  const facts: Described[] = [];
  for (const fact of help.facts) {
    if (fact.kind === 'EQUITY_NEEDED_FOR_RISK') {
      facts.push({
        key: 'report2.underflow.fact_risk',
        params: {
          pct: show('percent', readWire(fact.atRiskPct)),
          equity: show('money', readWire(fact.equity)),
        },
      });
    } else {
      facts.push({
        key: 'report2.underflow.fact_leverage',
        params: {
          max: show('multiple', readWire(fact.atMaxLeverage)),
          equity: show('money', readWire(fact.equity)),
        },
      });
    }
  }
  const actions: UnderflowActionDoc[] = [];
  for (const option of help.options) {
    if (option.kind === 'RAISE_RISK') {
      actions.push({
        kind: 'RAISE_RISK',
        label: {
          key: 'report2.underflow.raise_risk',
          params: { pct: show('percent', readWire(option.riskPct)) },
        },
        riskPct: readWire(option.riskPct).toString(),
      });
    } else if (option.kind === 'NEARER_STRUCTURAL_STOP') {
      actions.push({
        kind: 'NEARER_STOP',
        label: {
          key: 'report2.underflow.nearer_stop',
          params: { distance: show('price', readWire(option.stopDistance)) },
        },
        stopDistance: readWire(option.stopDistance).toString(),
      });
    }
  }
  return {
    minLotLoss: show('money', readWire(help.minLotLoss)),
    minLotRiskPct: show('percent', readWire(help.minLotRiskPct)),
    facts,
    actions,
  };
}

function offerReasonOf(
  offer: WireOfferResult | undefined,
  blackout: WireBlackoutResult | undefined
): Described | null {
  if (offer === undefined || offer.reason === null) return null;
  const first = blackout === undefined ? undefined : blackout.blocks[0];
  return describeNotOffered(offer.reason.code, {
    dataAsOfSlot: offer.dataAsOfSlot,
    block:
      first === undefined || blackout === undefined
        ? null
        : {
            name: first.eventName,
            time: first.eventTime,
            end: blackout.windowEndsAt ?? first.windowEnd,
          },
  });
}

/** Build the document of a validated setup. Pure: the same answer gives the same document. */
export function buildReport2(input: Report2Input): Report2Document {
  const { setup, badge: view, offer } = input;
  const limits = limitsFromSetup(setup);
  const sized = setup.scenarios !== null;

  const noticeFacts = {
    dataAsOfSlot:
      offer === undefined || offer.dataAsOfSlot === null
        ? null
        : offer.dataAsOfSlot,
    newSlot:
      offer === undefined || offer.refresh === null
        ? null
        : offer.refresh.newSlot,
    cap: Rational.of(PROFILE_BOUNDS.counterTrendRrrCap).toString(),
  };
  const notices: Described[] = [];
  for (const code of setup.notices) {
    const described = describeNotice(code, noticeFacts);
    if (described !== null) notices.push(described);
  }

  const { room, badge } = roomAndBadge(setup, view);
  const scenarios =
    setup.scenarios === null
      ? []
      : setup.scenarios.scenarios.map((scenario) =>
          scenarioOf(scenario, badge.badge)
        );
  const omitted: OmittedDoc[] =
    setup.scenarios === null
      ? []
      : setup.scenarios.omitted.map((item) => {
          const params: Record<string, ParamValue> =
            item.reason === 'BELOW_MIN_RRR'
              ? { min: { kind: 'ratio', text: limits.rrrMin ?? '' } }
              : { max: { kind: 'ratio', text: limits.rrrMax ?? '' } };
          return {
            name: item.name,
            nameKey: SCENARIO_KEYS[item.name],
            reason: { key: OMITTED_REASON_KEYS[item.reason], params },
          };
        });

  return {
    version: {
      template: REPORT2_TEMPLATE_VERSION,
      disclaimer: REPORT2_DISCLAIMER_VERSION,
    },
    ok: setup.ok,
    offerReason: offerReasonOf(offer, input.blackout),
    sized,
    header: headerOf(setup),
    notices,
    setup: setupOf(setup),
    risk: riskOf(setup),
    scenarios,
    omitted,
    room,
    badge,
    underflow: underflowOf(setup),
    warnings: setup.warnings.map((warning) => ({
      name: { kind: 'raw', text: warning.eventName },
      time: { kind: 'time', text: warning.eventTime },
      approximate: warning.approximate,
    })),
    checks: setup.checks.map((check) => ({
      id: check.id,
      nameKey: CHECK_KEYS[check.name],
      status: check.status,
      messages: check.codes.map((code) => describeCheckCode(code, limits)),
    })),
    compulsory: [...COMPULSORY_KEYS],
  };
}
