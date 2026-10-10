/**
 * Every word Report 2 shows, in English: the fixed template's labels (architecture
 * 6.10, ADR-068) and the messages for the codes Engine 4 returns.
 *
 * This file is the single source of the text. It is (1) the fallback `t(key, text)`
 * gets, (2) the content of the en-GB and en-US dictionaries, and (3) the list the
 * translation-coverage test holds the 19 dictionaries to, key by key. A key that
 * is in a dictionary and not here, or here and not in a dictionary, fails a test.
 *
 * Numbers are never in the text: a `{name}` placeholder is filled with a figure
 * Engine 4 produced, formatted by the shared formatters. No language model writes
 * any of it. `DRAFT_TEXT_KEYS` lists the wording that is waiting for counsel
 * (plan decision D14): a draft in all 19 languages ships, and the flag stays off.
 *
 * Placeholders: `{name}` only, the same in every language.
 *
 * @module lib/engine4/templates/text
 */

export const REPORT2_TEXT = {
  // -- chrome ----------------------------------------------------------------
  'report2.title': 'Trade setup',
  'report2.subtitle': 'Gold (XAUUSD)',
  'report2.modal.description':
    'Review the setup, adjust the fields, then accept, modify or decline.',
  'report2.modal.loading': 'Sizing your setup…',
  'report2.modal.sizing_failed': 'The setup could not be sized just now.',
  'report2.card.heading': 'Report 2: your sized trade setup',
  'report2.card.pinned': 'Pinned to the {time} reading',

  // -- direction -------------------------------------------------------------
  'report2.direction.label': 'Direction',
  'report2.direction.long': 'Buy (long)',
  'report2.direction.short': 'Sell (short)',
  'report2.direction.note': 'Set by the current market reading.',
  'report2.setup.counter_trend': 'Counter-trend setup',
  'report2.setup.with_trend': 'With-trend setup',

  // -- entry -----------------------------------------------------------------
  'report2.entry.heading': 'Entry',
  'report2.entry.zones': 'Entry zones, best first',
  'report2.entry.zone': 'Zone {zone}',
  'report2.entry.own': 'Your own entry',
  'report2.entry.invalidated': 'No longer valid',
  'report2.entry.invalidated_hint':
    "Price has passed this zone's invalidation level.",
  'report2.entry.custom_label': 'Entry price',
  'report2.entry.custom_range': 'Allowed: {low} to {high}',
  'report2.entry.custom_unavailable':
    'Your own entry cannot be checked right now. Pick a zone.',

  // -- stop ------------------------------------------------------------------
  'report2.stop.heading': 'Stop loss',
  'report2.stop.nearest': 'Behind structure, nearest first',
  'report2.stop.behind': 'Behind {level}',
  'report2.stop.away': '{distance} from entry',
  'report2.stop.also_at': 'Same price: {levels}',
  'report2.stop.minimum': 'Minimum stop distance',
  'report2.stop.minimum_note': 'No structure behind it.',
  'report2.stop.more': 'More levels ({count})',
  'report2.stop.fewer': 'Fewer levels',
  'report2.stop.custom': 'Custom stop',
  'report2.stop.custom_label': 'Stop distance from entry',
  'report2.stop.custom_hint': 'At least {min}.',
  'report2.stop.degraded':
    "Other structure levels could not be read, so only the zone's own stop is offered.",
  'report2.stop.suggested': 'Suggested',
  'report2.label.stop_price': 'Stop price',
  'report2.label.stop_distance': 'Stop distance',
  'report2.label.on_chart': 'On the chart',

  // -- the trader's figures --------------------------------------------------
  'report2.equity.label': 'Equity',
  'report2.equity.note': 'From your profile.',
  'report2.risk.label': 'Risk per trade (%)',
  'report2.risk.max': 'Your maximum is {max}.',
  'report2.risk.half':
    'Half your maximum is pre-set: {preset} instead of {max}.',
  'report2.risk.reasons': 'Why: {reasons}',
  'report2.risk.override':
    'More than the pre-set half. This choice and the reason are recorded.',
  'report2.rrr.label': 'Target reward-to-risk (RRR)',
  'report2.rrr.range': 'From {min} to {max}.',
  'report2.rrr.counter_cap': 'A counter-trend setup is capped at {max}.',
  'report2.rrr.lowered': 'Your profile target was lowered to the cap.',

  // -- sizing: declared and actual risk --------------------------------------
  'report2.pair.heading': 'Declared risk and actual risk',
  'report2.pair.declared': 'Declared risk',
  'report2.pair.declared_hint': 'What you chose: {pct} of your equity.',
  'report2.pair.actual': 'Actual risk',
  'report2.pair.actual_hint':
    'What the lot really risks at the stop, commission included.',
  'report2.pair.lot': 'Lot size',
  'report2.pair.leverage': 'Leverage used',
  'report2.pair.leverage_limit': 'Your limit: {max}',
  'report2.pair.limited_risk': 'Your risk limit set this lot.',
  'report2.pair.limited_leverage':
    'Your leverage limit set this lot, not your risk limit.',
  'report2.pair.limited_broker': "The broker's maximum lot set this lot.",
  'report2.pair.rounded_down':
    "The lot is rounded down to the broker's lot step, never up.",
  'report2.pair.spread': 'Spread used',
  'report2.pair.commission': 'Commission per lot',

  // -- scenarios -------------------------------------------------------------
  'report2.scenarios.heading': 'Three scenarios',
  'report2.scenarios.empty': 'Fill in the fields to see the scenarios.',
  'report2.scenario.conservative': 'Conservative',
  'report2.scenario.normal': 'Normal',
  'report2.scenario.aggressive': 'Aggressive',
  'report2.scenarios.rrr': 'RRR',
  'report2.scenarios.distance': 'Target distance',
  'report2.scenarios.target_price': 'Target price',
  'report2.scenarios.net_profit': 'Net profit',
  'report2.scenarios.omitted': 'Not shown: {name}, {reason}',
  'report2.scenarios.omitted_below_min': 'its RRR would be under {min}',
  'report2.scenarios.omitted_above_max': 'its RRR would be over {max}',
  'report2.scenarios.omitted_above_cap':
    'its RRR would pass the counter-trend cap of {max}',
  'report2.scenarios.has_badge': 'Badge',

  // -- room and badge --------------------------------------------------------
  'report2.room.heading': 'Room to the next level',
  'report2.room.named':
    'The next opposing level is {level} at {price}, {room} away.',
  'report2.room.none': 'No opposing level was found beyond your entry.',
  'report2.room.unknown':
    'The levels could not be read, so the room ahead is not known.',
  'report2.badge.heading': 'Badge',
  'report2.badge.none': 'No badge',
  'report2.badge.none_no_fit':
    'No scenario has its target before {level} at {price}, so none gets a badge.',
  'report2.badge.none_within_style':
    'No scenario that fits before the next level is allowed for this kind of setup.',
  'report2.badge.not_decided':
    'No badge was decided because the levels could not be read.',

  // -- notices that go with every report -------------------------------------
  'report2.notice.single_order':
    'This report covers a single order only. It does not manage your account or your open positions.',
  'report2.notice.broker_order':
    'You place the order with your broker. DavinTrade places no orders.',
  'report2.notice.calculation_tool':
    'This is a calculation tool, not a suitability assessment or personal advice. Check every figure before you trade.',

  // -- notices from the offer check ------------------------------------------
  'report2.notice.data_delayed':
    'Data as of {time}. The market feed is delayed.',
  'report2.notice.data_delayed_plain': 'The market feed is delayed.',
  'report2.notice.cautionary':
    'The market sensors are cautious right now. Half your maximum risk is pre-set; you may choose more, up to your maximum.',
  'report2.notice.retuning':
    'The system is re-tuning after a change. Half your maximum risk is pre-set; you may choose more, up to your maximum.',
  'report2.notice.style_counter_trend':
    'This is a counter-trend setup and your style is trend following. Your target RRR is capped at {cap}.',
  'report2.notice.style_with_trend':
    'This setup follows the trend and your style is trend countering.',
  'report2.notice.newer_cycle': 'The picture changed at {time}.',
  'report2.notice.refresh': 'Refresh',
  'report2.warning.heading': 'Releases while the trade could be open',
  'report2.warning.release': '{name} is due at {time}.',
  'report2.warning.approximate': 'The time is approximate.',

  // -- not offered -----------------------------------------------------------
  'report2.not_offered.heading': 'Report 2 is not available right now',
  'report2.not_offered.neutral':
    'The current reading does not point to a direction, so there is no setup to size.',
  'report2.not_offered.stand_aside': 'The current reading says to stand aside.',
  'report2.not_offered.unusable':
    'The reading behind this setup cannot be used right now.',
  'report2.not_offered.data_stale':
    'Market data stopped arriving at {time}, so no setup is offered.',
  'report2.not_offered.data_unknown':
    'The state of the market data is not known right now, so no setup is offered.',
  'report2.not_offered.market_closed': 'The market is closed.',
  'report2.not_offered.blackout':
    '{name} is due at {time}. No setup is offered until {end}.',
  'report2.not_offered.calendar':
    'The economic calendar could not be checked, so no setup is offered.',
  'report2.not_offered.past_invalidation':
    'This setup is no longer valid: price has passed its invalidation level.',
  'report2.not_offered.price_unknown':
    'The latest price is not available, so no setup is offered.',
  'report2.not_offered.specs':
    "The broker's contract figures are missing or out of date, so a lot cannot be sized.",

  // -- the eight checks ------------------------------------------------------
  'report2.checks.heading': 'Checks',
  'report2.checks.passed': '{passed} of {total} passed',
  'report2.check.entry': 'Entry',
  'report2.check.risk': 'Risk',
  'report2.check.stop': 'Stop',
  'report2.check.rrr': 'RRR',
  'report2.check.leverage': 'Leverage',
  'report2.check.blackout': 'News window',
  'report2.check.setup': 'Setup still valid',
  'report2.check.lot': 'Lot size',
  'report2.check.pass': 'Passed',
  'report2.check.fail': 'Failed',
  'report2.check.skipped': 'Not checked yet',

  // -- messages for the codes of the checks ----------------------------------
  'report2.err.entry_required': 'Pick a zone or enter your own entry.',
  'report2.err.entry_number': 'Enter the entry as a price above zero.',
  'report2.err.entry_range': "That entry is outside the day's range.",
  'report2.err.entry_typo':
    'That entry is more than {limit} from the live price. Check for a typing error.',
  'report2.err.entry_unknown':
    'Your own entry cannot be checked right now. Pick a zone.',
  'report2.err.equity': 'Enter your equity as an amount above zero.',
  'report2.err.risk_number': 'Enter the risk as a percentage above zero.',
  'report2.err.risk_max': 'The risk is above your maximum of {max}.',
  'report2.err.stop_number': 'Enter the stop as a distance above zero.',
  'report2.err.stop_min': 'The stop is closer than your minimum of {min}.',
  'report2.err.rrr_number': 'Enter the RRR as a number.',
  'report2.err.rrr_range': 'The RRR must be from {min} to {max}.',
  'report2.err.rrr_counter_cap':
    'The RRR is above {max}, the cap for a counter-trend setup.',
  'report2.err.leverage': 'This lot would use more leverage than you allow.',
  'report2.err.blackout':
    'A major US release is close. Setups are paused around it.',
  'report2.err.calendar':
    'The economic calendar could not be checked, so the news window is closed.',
  'report2.err.setup_changed':
    'A newer market reading changed this setup. Refresh it.',
  'report2.err.past_invalidation':
    'This setup is no longer valid: price has passed its invalidation level.',
  'report2.err.direction':
    'The direction does not match the current market reading.',
  'report2.err.no_broker':
    "The broker's contract figures are not available, so a lot cannot be sized.",
  'report2.err.sizing': 'The setup could not be sized with these figures.',
  'report2.err.lot_below_min':
    "At this stop, the lot would be below the broker's minimum.",
  'report2.err.generic': 'This check did not pass.',

  // -- a lot below the broker's minimum --------------------------------------
  'report2.underflow.heading': "The lot would be below your broker's minimum",
  'report2.underflow.body':
    'One minimum lot would risk {loss}, which is {pct} of your equity, at this stop. Report 2 never rounds a lot up.',
  'report2.underflow.fact_risk':
    'At {pct} risk, this setup needs at least {equity} of equity.',
  'report2.underflow.fact_leverage':
    'At your leverage limit of {max}, this setup needs at least {equity} of equity.',
  'report2.underflow.raise_risk': 'Use {pct} risk',
  'report2.underflow.nearer_stop': 'Use the nearer stop, {distance} away',
  'report2.underflow.options': 'What you can do within your limits',

  // -- the three buttons -----------------------------------------------------
  'report2.consent.accept': 'Accept setup',
  'report2.consent.modify': 'Modify',
  'report2.consent.decline': 'Decline',
  'report2.consent.saving': 'Recording…',
  'report2.consent.accepted':
    'Setup accepted and recorded. You place the order with your broker.',
  'report2.consent.modified': 'Recorded. Change the fields, then review again.',
  'report2.consent.declined': 'Declined and recorded.',
  'report2.consent.recorded_at': 'Recorded at {time}.',
  'report2.consent.duplicate': 'This was already recorded.',
  'report2.consent.blocked': 'Fix the checks above to accept.',
  'report2.consent.not_ready': 'Waiting for the figures to settle.',
  'report2.consent.retry': 'It could not be recorded. Press the button again.',
  'report2.consent.setup_changed':
    'The setup changed while you were reviewing it. Review it again.',

  // -- when a route refuses --------------------------------------------------
  'report2.api.unauthenticated': 'Please sign in again.',
  'report2.api.tier': 'Report 2 is part of the Pro plan.',
  'report2.api.disabled': 'Report 2 is not available yet.',
  'report2.api.profile': 'Confirm your trading profile first.',
  'report2.api.in_flight': 'This is already being recorded.',
  'report2.api.unavailable':
    'Some data could not be read just now. Try again in a moment.',
  'report2.api.network': 'The connection failed. Nothing was recorded.',
  'report2.api.generic': 'Something went wrong. Nothing was recorded.',
} as const;

export type Report2Key = keyof typeof REPORT2_TEXT;

/** Every key, in the order of the registry. */
export const REPORT2_KEYS = Object.keys(REPORT2_TEXT) as Report2Key[];

/** The compulsory wording that waits for counsel (decision D14). A draft ships in all 19 languages. */
export const DRAFT_TEXT_KEYS: readonly Report2Key[] = [
  'report2.notice.single_order',
  'report2.notice.broker_order',
  'report2.notice.calculation_tool',
  'report2.consent.accept',
  'report2.consent.modify',
  'report2.consent.decline',
  'report2.consent.accepted',
  'report2.consent.modified',
  'report2.consent.declined',
];

export type TextParams = Readonly<Record<string, string>>;

/** Fill `{name}` placeholders; one that has no value is left as it is, so a gap is visible. */
export function fillText(text: string, params?: TextParams): string {
  if (params === undefined) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name)
      ? (params[name] as string)
      : whole
  );
}

/** The placeholders of a text, sorted, for the check that a translation keeps them. */
export function placeholdersOf(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string).sort();
}
