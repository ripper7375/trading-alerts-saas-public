/**
 * Pillar 8 prompt serialization — turning `economic_events` rows into the text
 * block the LLM sees.
 *
 * ⚠ NO RUNTIME CALLER YET. Stack D's orchestrator is Phase 12 and is not
 * built; `execute8PillarRetrieval()` does not exist. This module is here ahead
 * of it deliberately, and that is a judgement worth stating rather than
 * hiding: the rules below are safety rules, not formatting preferences, and
 * they are the kind of thing that quietly fails to survive the trip from a
 * design document into code written six sessions later. The retrieval half of
 * Pillar 8 (`getUpcomingHighImpactEvents`) IS live and exercised by
 * `/api/market/economic-events`; only this serialization awaits its consumer.
 *
 * WHY THIS EXISTS AT ALL
 * ----------------------
 * Stack D's Report 1 has always promised "High-Impact Economic News Warnings
 * & Market Risk Factors" while the retrieval engine had no news source. A
 * model asked to warn about news it cannot see does one of two things: omit
 * the section, or invent it. A fabricated NFP time shown to a trader sizing a
 * position is a real harm.
 *
 * @module lib/economic-events/prompt-context
 */

import type { UpcomingEconomicEvent } from './queries';

/**
 * Rendered value, or an explicit statement of absence.
 *
 * `null` means NOT PUBLISHED, and for forecasts that is the COMMON case —
 * measured at 12 of 23 upcoming high-impact events, because rate decisions,
 * votes and speeches carry no numeric forecast at all. Rendering a bare "0"
 * or omitting the field invites the model to fill the gap; saying so
 * explicitly does not.
 */
function renderValue(value: number | null, digits: number | null): string {
  if (value === null) return 'not published';
  return value.toFixed(digits ?? 2);
}

/** "in 1h 30m" / "in 12m" / "in 3d 4h" — deliberately coarse. */
function renderRelative(seconds: number): string {
  if (seconds <= 0) return 'imminent';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${minutes}m`;
  return `in ${minutes}m`;
}

/** `2026-01-14 13:30 UTC` — unambiguous, no locale in a prompt. */
function renderAbsolute(unixSeconds: number): string {
  return `${new Date(unixSeconds * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/**
 * The Pillar 8 context block, or an EMPTY STRING when nothing is scheduled.
 *
 * The empty case is the important one. "No events retrieved" is not a licence
 * for the model to reason about the economic calendar from training data — it
 * has no idea what is scheduled next week, and a plausible-sounding guess is
 * worse than silence. An empty string means the caller omits the section
 * entirely, so there is nothing for the model to riff on.
 */
export function buildNewsContext(
  events: UpcomingEconomicEvent[],
  now: Date = new Date()
): string {
  if (events.length === 0) return '';

  const nowSec = Math.floor(now.getTime() / 1000);

  const lines = events.map((e) => {
    const approx = e.timeMode ? ' (approximate time)' : '';
    return [
      `- ${renderAbsolute(e.eventTime)}${approx}`,
      `${renderRelative(e.eventTime - nowSec)}`,
      e.currency,
      e.eventName,
      `forecast: ${renderValue(e.forecastValue, e.digits)}`,
      `previous: ${renderValue(e.previousValue, e.digits)}`,
    ].join(' | ');
  });

  return [
    'UPCOMING HIGH-IMPACT ECONOMIC EVENTS:',
    ...lines,
    '',
    // An explicit boundary. Without it the model treats the list as a sample
    // and supplements it from memory, which is exactly the failure this
    // pillar exists to prevent.
    'These are the ONLY scheduled events known to the system. Do not mention',
    'any economic event not listed above, and do not estimate a forecast for',
    'an event whose forecast is "not published".',
  ].join('\n');
}
