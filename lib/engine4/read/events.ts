/**
 * Read what the blackout needs from the news calendar (`economic_events`) and
 * the Tier-1 list from its config file (architecture 6.6, ADR-060).
 *
 * `economic_events` is append-only: a release is many rows, one per
 * observation, and the NEWEST observation of each `value_id` is its state. A
 * release can be rescheduled, so filtering rows by time and then keeping the
 * newest of what is left could pick a stale observation. This reader therefore
 * works in two steps: first the `value_id`s that have ANY observation in the
 * time window (and are Tier-1 or HIGH-impact USD), then EVERY observation of
 * those, so `checkBlackout` can keep the newest of each and judge its time.
 *
 * It also returns the newest `captured_at` of the whole table, for the
 * calendar's age. The gateway stores a row only when something changed, so
 * that age is the age of the newest OBSERVATION, not of the last export.
 *
 * Nothing here throws for a database error: the answer is `events: null` and
 * the problem, and the blackout then fails closed (`CALENDAR_UNAVAILABLE`).
 *
 * @module lib/engine4/read/events
 */

import tier1Config from '@/config/engine4/tier1-events.json';
import { marketPrisma } from '@/lib/db/market-prisma';

import {
  BLACKOUT_APPROXIMATE_SECONDS,
  HOLDING_WINDOW_SECONDS,
  parseTier1List,
  type CalendarEvent,
  type Tier1List,
} from '../blackout';
import type { DecimalLike } from '../exact';
import { readSeconds, toDbInt } from '../time';
import { Engine4InputError, type TraderType } from '../types';

/** The Tier-1 list as the repository ships it, read through the strict parser. */
export function loadTier1List(raw: unknown = tier1Config): {
  list: Tier1List | null;
  problems: string[];
} {
  const parsed = parseTier1List(raw);
  return parsed.ok
    ? { list: parsed.list, problems: [] }
    : { list: null, problems: parsed.problems };
}

/** The columns of an `economic_events` row the blackout uses. */
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

/** Step 1: the releases with an observation in the window. */
export interface ReleasesQuery {
  where: {
    event_time: { gte: number; lte: number };
    OR: [
      { event_id: { in: string[] } },
      { importance: 'HIGH'; currency: 'USD' },
    ];
  };
  select: { value_id: true };
  distinct: ['value_id'];
}

/** Step 2: every observation of those releases. */
export interface ObservationsQuery {
  where: { value_id: { in: string[] } };
  orderBy: [{ value_id: 'asc' }, { captured_at: 'desc' }];
  select: Record<keyof CalendarRow, true>;
}

/** Step 3: the newest observation in the table. */
export interface NewestQuery {
  orderBy: { captured_at: 'desc' };
  select: { captured_at: true };
}

/**
 * The three queries this reader makes, one delegate each so each has one exact
 * signature: the real `marketPrisma.economicEvent` fits all three with no cast
 * (`prismaCalendar`), and a test passes its own.
 */
export interface CalendarClient {
  releases: {
    findMany(args: ReleasesQuery): Promise<{ value_id: string }[]>;
  };
  observations: {
    findMany(args: ObservationsQuery): Promise<CalendarRow[]>;
  };
  newest: {
    findFirst(args: NewestQuery): Promise<{ captured_at: number } | null>;
  };
}

function prismaCalendar(): CalendarClient {
  const events = marketPrisma.economicEvent;
  return { releases: events, observations: events, newest: events };
}

export interface CalendarRequest {
  /** the clock, unix UTC seconds; passed in so the reader holds no clock of its own */
  nowSeconds: DecimalLike;
  traderType: TraderType;
  /** the parsed Tier-1 list; null when it is not usable (its ids are then not asked for) */
  list: Tier1List | null;
}

export interface CalendarRead {
  /** null when the calendar could not be read */
  events: CalendarEvent[] | null;
  /** the newest `captured_at` in the table, null when it is empty or unread */
  newestCapturedAt: number | null;
  problems: string[];
}

export async function readCalendar(
  request: CalendarRequest,
  client: CalendarClient = prismaCalendar()
): Promise<CalendarRead> {
  const now = readSeconds('nowSeconds', request.nowSeconds);
  if (
    !Object.prototype.hasOwnProperty.call(
      HOLDING_WINDOW_SECONDS,
      request.traderType
    )
  ) {
    throw new Engine4InputError(
      'BAD_OPTION',
      'traderType is not SCALPER or DAY_TRADER',
      'traderType'
    );
  }
  // far enough back for the widest blackout; far enough ahead for the holding window, which is
  // longer than the widest blackout for both trader types (a test holds that to account)
  const from = toDbInt('window start', now - BLACKOUT_APPROXIMATE_SECONDS);
  const to = toDbInt(
    'window end',
    now + HOLDING_WINDOW_SECONDS[request.traderType]
  );
  const tier1Ids =
    request.list === null ? [] : request.list.events.map((e) => e.eventId);

  try {
    const releases = await client.releases.findMany({
      where: {
        event_time: { gte: from, lte: to },
        OR: [
          { event_id: { in: tier1Ids } },
          { importance: 'HIGH', currency: 'USD' },
        ],
      },
      select: { value_id: true },
      distinct: ['value_id'],
    });
    const valueIds = releases.map((release) => release.value_id);
    const rows =
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
    return {
      events: rows.map((row) => ({
        valueId: row.value_id,
        eventId: row.event_id,
        eventName: row.event_name,
        eventTime: row.event_time,
        currency: row.currency,
        importance: row.importance,
        timeMode: row.time_mode,
        capturedAt: row.captured_at,
      })),
      newestCapturedAt: newest === null ? null : newest.captured_at,
      problems: [],
    };
  } catch (error) {
    return {
      events: null,
      newestCapturedAt: null,
      problems: [
        `the news calendar could not be read: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      ],
    };
  }
}
