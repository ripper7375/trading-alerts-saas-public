/**
 * The upcoming economic events a request carries (architecture 4.5 News row, 5.3 and 5.4,
 * plan decision D9 b and finding F10).
 *
 * `economic_events` is append-only: a release is many rows, one per observation, and the
 * NEWEST observation of each `value_id` is its state. A release can be rescheduled, so this
 * reader works in the two steps `lib/engine4/read/events.ts` does (it follows that reader
 * and does not import it, plan assumption A2): first the `value_id`s that have ANY
 * observation in the window, then EVERY observation of those, so that the newest of each
 * decides whether the release is upcoming.
 *
 * What the packet carries:
 *  - `UPCOMING_ALL` for the News intent: every upcoming release in the next 7 days, soonest
 *    first, at most 50;
 *  - `NEXT_24H_HIGH` for every other intent: the HIGH-impact releases of the next 24 hours.
 * Upcoming means the newest observation's time is not before `nowSeconds`.
 *
 * An unavailable calendar is SAID, never read as "no news" (5.3): a table with no row, or a
 * read that failed, is `UNAVAILABLE` with no items; a calendar whose newest observation is
 * older than 45 minutes is `LATE` (7.6; the age is that of the newest OBSERVATION, because
 * the gateway stores a row only when something changed). Nothing here throws.
 *
 * Imported BY PATH, never through the `lib/intake` barrel.
 *
 * @module lib/intake/read/events
 */

import 'server-only';

import tier1File from '@/config/engine4/tier1-events.json';
import { marketPrisma } from '@/lib/db/market-prisma';

import {
  EVENTS_MAX_ITEMS,
  type EventItem,
  type EventsScope,
  type PacketEvents,
} from '../packet';
import { isEpochSeconds, timeIso } from '../slots';

/** A calendar not seen for this long is LATE (7.6, the same 45 minutes as Engine 4). */
export const CALENDAR_LATE_SECONDS = 45 * 60;
/** How far ahead the News intent looks. */
export const UPCOMING_HORIZON_SECONDS = 7 * 24 * 3_600;
/** How far ahead every other intent looks, for HIGH-impact releases. */
export const NEXT_DAY_SECONDS = 24 * 3_600;
const NAME_MAX = 120;

const EVENT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const CURRENCY = /^[A-Z]{3}$/;
const IMPORTANCE = /^[A-Z_]{1,12}$/;
const TIER1_EVENT_ID = /^[0-9]{1,20}$/;

/** The columns of an `economic_events` row this reader uses. */
export interface CalendarRow {
  value_id: string;
  event_id: string;
  event_name: string;
  event_time: number;
  currency: string;
  importance: string;
  time_mode: number | null;
  captured_at: number;
}

export interface ReleasesQuery {
  where: { event_time: { gte: number; lte: number } };
  select: { value_id: true };
  distinct: ['value_id'];
}

export interface ObservationsQuery {
  where: { value_id: { in: string[] } };
  orderBy: [{ value_id: 'asc' }, { captured_at: 'desc' }];
  select: Record<keyof CalendarRow, true>;
}

export interface NewestQuery {
  orderBy: { captured_at: 'desc' };
  select: { captured_at: true };
}

/**
 * The three queries this reader makes, one delegate each so each has one exact signature:
 * the real `marketPrisma.economicEvent` fits all three with no cast, and a test passes its own.
 */
export interface IntakeCalendarClient {
  releases: { findMany(args: ReleasesQuery): Promise<{ value_id: string }[]> };
  observations: { findMany(args: ObservationsQuery): Promise<CalendarRow[]> };
  newest: {
    findFirst(args: NewestQuery): Promise<{ captured_at: number } | null>;
  };
}

function prismaCalendar(): IntakeCalendarClient {
  const events = marketPrisma.economicEvent;
  return { releases: events, observations: events, newest: events };
}

/**
 * The MT5 ids of the Tier-1 releases, from `config/engine4/tier1-events.json`. The file is
 * Engine 4's (it ships EMPTY until Davin gives the ids, D13); this reads only the ids, to
 * mark an event `tier1` in the packet, and ignores anything that is not an id.
 */
export function tier1IdsOf(raw: unknown = tier1File): Set<string> {
  const ids = new Set<string>();
  if (typeof raw !== 'object' || raw === null) return ids;
  const events = (raw as { events?: unknown }).events;
  if (!Array.isArray(events)) return ids;
  for (const entry of events) {
    if (typeof entry !== 'object' || entry === null) continue;
    const id = (entry as { eventId?: unknown }).eventId;
    if (typeof id === 'string' && TIER1_EVENT_ID.test(id)) ids.add(id);
  }
  return ids;
}

export interface EventsRequest {
  /** the clock, unix UTC seconds; passed in so the reader holds no clock of its own */
  nowSeconds: number;
  /** UPCOMING_ALL for the News intent, NEXT_24H_HIGH for every other */
  scope: EventsScope;
  /** the Tier-1 ids; Engine 4's file by default */
  tier1Ids?: ReadonlySet<string>;
}

export interface EventsRead {
  events: PacketEvents;
  /** what could not be read or was left out; for the trace and the log, never for the trader */
  problems: string[];
}

const unavailable = (scope: EventsScope, problem: string): EventsRead => ({
  events: {
    status: 'UNAVAILABLE',
    calendar_age_seconds: null,
    scope,
    items: [],
  },
  problems: [problem],
});

/** The newest observation of each release. */
function newestPerRelease(rows: readonly CalendarRow[]): CalendarRow[] {
  const newest = new Map<string, CalendarRow>();
  for (const row of rows) {
    const held = newest.get(row.value_id);
    if (held === undefined || row.captured_at > held.captured_at) {
      newest.set(row.value_id, row);
    }
  }
  return [...newest.values()];
}

export async function readUpcomingEvents(
  request: EventsRequest,
  client: IntakeCalendarClient = prismaCalendar()
): Promise<EventsRead> {
  const { scope, nowSeconds } = request;
  if (!isEpochSeconds(nowSeconds)) {
    return unavailable(scope, 'nowSeconds is not a time');
  }
  const horizon =
    scope === 'UPCOMING_ALL' ? UPCOMING_HORIZON_SECONDS : NEXT_DAY_SECONDS;
  const until = nowSeconds + horizon;
  const tier1 = request.tier1Ids ?? tier1IdsOf();

  let newestCapturedAt: number | null;
  let rows: CalendarRow[];
  try {
    const releases = await client.releases.findMany({
      where: { event_time: { gte: nowSeconds, lte: until } },
      select: { value_id: true },
      distinct: ['value_id'],
    });
    const valueIds = releases.map((release) => release.value_id);
    rows =
      valueIds.length === 0
        ? []
        : await client.observations.findMany({
            where: { value_id: { in: valueIds } },
            orderBy: [{ value_id: 'asc' }, { captured_at: 'desc' }],
            select: {
              value_id: true,
              event_id: true,
              event_name: true,
              event_time: true,
              currency: true,
              importance: true,
              time_mode: true,
              captured_at: true,
            },
          });
    const newest = await client.newest.findFirst({
      orderBy: { captured_at: 'desc' },
      select: { captured_at: true },
    });
    newestCapturedAt = newest === null ? null : newest.captured_at;
  } catch (error) {
    return unavailable(
      scope,
      `the news calendar could not be read: ${error instanceof Error ? error.message : 'unknown error'}`
    );
  }

  // an empty table is not "no news": nobody has ever told us (5.3)
  if (newestCapturedAt === null || !Number.isFinite(newestCapturedAt)) {
    return unavailable(scope, 'the news calendar holds no row');
  }
  const age = Math.max(0, Math.floor(nowSeconds - newestCapturedAt));

  const problems: string[] = [];
  const items: EventItem[] = [];
  for (const row of newestPerRelease(rows)) {
    if (
      !isEpochSeconds(row.event_time) ||
      row.event_time < nowSeconds ||
      row.event_time > until
    ) {
      continue; // rescheduled out of the window, or already past
    }
    if (scope === 'NEXT_24H_HIGH' && row.importance !== 'HIGH') continue;
    const name =
      typeof row.event_name === 'string' ? row.event_name.trim() : '';
    if (
      !EVENT_ID.test(String(row.event_id)) ||
      !CURRENCY.test(String(row.currency)) ||
      !IMPORTANCE.test(String(row.importance)) ||
      name.length === 0
    ) {
      problems.push(
        `an event row (${String(row.event_id)}) is not well formed and was left out`
      );
      continue;
    }
    items.push({
      event_id: row.event_id,
      name: name.length > NAME_MAX ? name.slice(0, NAME_MAX) : name,
      time: timeIso(row.event_time),
      currency: row.currency,
      importance: row.importance,
      approximate: row.time_mode !== 0,
      tier1: tier1.has(row.event_id),
    });
  }
  items.sort((a, b) =>
    a.time === b.time
      ? a.event_id < b.event_id
        ? -1
        : 1
      : a.time < b.time
        ? -1
        : 1
  );

  return {
    events: {
      status: age > CALENDAR_LATE_SECONDS ? 'LATE' : 'OK',
      calendar_age_seconds: age,
      scope,
      items: items.slice(0, EVENTS_MAX_ITEMS),
    },
    problems,
  };
}
