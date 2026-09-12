/**
 * Economic-events read layer.
 *
 * The table is APPEND-ONLY: one row per observation, so a single release has
 * a pre-publication row (forecast known, actual null) and later rows carrying
 * the revision and the published actual. Every read here therefore has to
 * collapse to the NEWEST observation per `value_id` before it means anything.
 *
 * That collapse uses Prisma's own `distinct`, not hand-written SQL. The
 * candidate set is small by construction -- HIGH-impact only, inside a
 * days-wide window, which measured out at 25 events per 8 days -- so the
 * simple typed query is both correct and cheap, and it keeps this file free of
 * interpolated SQL. (`mtf_render`'s `data_source.py` built SQL by f-string and
 * shipped a query that could not run against the live schema; not repeating
 * the shape.)
 *
 * @module lib/economic-events/queries
 */

import { marketPrisma } from '@/lib/db/market-prisma';

/**
 * Currencies whose high-impact releases actually move XAUUSD.
 *
 * USD dominates -- gold is priced in it -- but ECB, BoE and BoJ decisions move
 * it too, so the majors are included and the UI shows which currency an event
 * belongs to rather than implying everything is a dollar print. Widen this
 * freely; the pipeline captures EVERY currency, so nothing here is a capture
 * decision, only a display one.
 */
export const XAU_RELEVANT_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CHF',
] as const;

/** Default forward window. Long enough to always have something to count down to. */
export const DEFAULT_HORIZON_DAYS = 14;

export interface UpcomingEconomicEvent {
  valueId: string;
  eventId: string;
  eventName: string;
  /** Unix seconds, UTC. */
  eventTime: number;
  currency: string;
  countryCode: string;
  importance: string;
  /**
   * `null` means NOT PUBLISHED, never zero. For high-impact events this is
   * the common case -- rate decisions, votes and speeches carry no numeric
   * forecast -- so a consumer must say "no forecast published" rather than
   * render a number it does not have.
   */
  forecastValue: number | null;
  previousValue: number | null;
  /** Decimal places for rendering the values above. */
  digits: number | null;
  /**
   * Upstream's ENUM_CALENDAR_EVENT_TIMEMODE. A non-zero mode means the time is
   * a day or a floating estimate rather than a precise instant, so a
   * second-resolution countdown would overstate what is actually known.
   */
  timeMode: number | null;
  sourceUrl: string | null;
}

interface GetUpcomingOptions {
  /** Defaults to now. Injectable so tests are not clock-dependent. */
  now?: Date;
  horizonDays?: number;
  limit?: number;
  currencies?: readonly string[];
}

/**
 * Upcoming HIGH-impact events, newest observation of each, soonest first.
 *
 * Returns `[]` rather than throwing when the table does not exist yet -- the
 * migration is applied separately from the deploy, and an unbuilt lane should
 * render as "nothing scheduled", not as a broken panel.
 */
export async function getUpcomingHighImpactEvents(
  options: GetUpcomingOptions = {}
): Promise<UpcomingEconomicEvent[]> {
  const {
    now = new Date(),
    horizonDays = DEFAULT_HORIZON_DAYS,
    limit = 10,
    currencies = XAU_RELEVANT_CURRENCIES,
  } = options;

  const nowSec = Math.floor(now.getTime() / 1000);
  const horizonSec = nowSec + horizonDays * 86400;

  try {
    // Ordering by (value_id, captured_at desc) is what makes `distinct` keep
    // the NEWEST observation of each release rather than an arbitrary one.
    const rows = await marketPrisma.economicEvent.findMany({
      where: {
        importance: 'HIGH',
        event_time: { gte: nowSec, lte: horizonSec },
        currency: { in: [...currencies] },
      },
      orderBy: [{ value_id: 'asc' }, { captured_at: 'desc' }],
      distinct: ['value_id'],
      select: {
        value_id: true,
        event_id: true,
        event_name: true,
        event_time: true,
        currency: true,
        country_code: true,
        importance: true,
        forecast_value: true,
        prev_value: true,
        digits: true,
        time_mode: true,
        source_url: true,
      },
    });

    // `distinct` forced the ordering above, so soonest-first has to be applied
    // after the collapse rather than in the query.
    return rows
      .sort((a, b) => a.event_time - b.event_time)
      .slice(0, limit)
      .map((r) => ({
        valueId: r.value_id,
        eventId: r.event_id,
        eventName: r.event_name,
        eventTime: r.event_time,
        currency: r.currency,
        countryCode: r.country_code,
        importance: r.importance,
        forecastValue: r.forecast_value,
        previousValue: r.prev_value,
        digits: r.digits,
        timeMode: r.time_mode,
        sourceUrl: r.source_url,
      }));
  } catch (error) {
    // The table is created by a migration that is applied separately from the
    // application deploy. Until then this must degrade to "nothing scheduled".
    console.error('[economic-events] upcoming query failed:', error);
    return [];
  }
}

/**
 * Every HIGH-impact event inside an explicit [dayStartSec, dayEndSec) window,
 * regardless of whether it's already happened relative to "now" -- unlike
 * `getUpcomingHighImpactEvents` above (which only returns future events for a
 * countdown), the Currency Index PRO chart's timeline overlay needs the
 * WHOLE trading day, past markers included, so a visitor loading the chart
 * mid-afternoon still sees this morning's releases plotted.
 */
export async function getHighImpactEventsForDay(
  dayStartSec: number,
  dayEndSec: number,
  currencies: readonly string[]
): Promise<UpcomingEconomicEvent[]> {
  try {
    const rows = await marketPrisma.economicEvent.findMany({
      where: {
        importance: 'HIGH',
        event_time: { gte: dayStartSec, lt: dayEndSec },
        currency: { in: [...currencies] },
      },
      orderBy: [{ value_id: 'asc' }, { captured_at: 'desc' }],
      distinct: ['value_id'],
      select: {
        value_id: true,
        event_id: true,
        event_name: true,
        event_time: true,
        currency: true,
        country_code: true,
        importance: true,
        forecast_value: true,
        prev_value: true,
        digits: true,
        time_mode: true,
        source_url: true,
      },
    });

    return rows
      .sort((a, b) => a.event_time - b.event_time)
      .map((r) => ({
        valueId: r.value_id,
        eventId: r.event_id,
        eventName: r.event_name,
        eventTime: r.event_time,
        currency: r.currency,
        countryCode: r.country_code,
        importance: r.importance,
        forecastValue: r.forecast_value,
        previousValue: r.prev_value,
        digits: r.digits,
        timeMode: r.time_mode,
        sourceUrl: r.source_url,
      }));
  } catch (error) {
    console.error('[economic-events] day-window query failed:', error);
    return [];
  }
}
