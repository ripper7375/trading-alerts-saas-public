/**
 * The Tier-1 release blackout and the holding-window warning
 * (architecture 6.6, ADR-060).
 *
 * No Report 2 from 15 minutes before to 15 minutes after a Tier-1 release (US
 * CPI, Core PCE, the FOMC rate decision, NFP); 60 minutes either side when the
 * release's time is only approximate (`time_mode` is not 0). Other HIGH-impact
 * USD releases inside the trader's holding window (2 h Scalper, 12 h Day
 * Trader) are a warning, not a block. The edges are inclusive: at exactly 15
 * minutes the blackout still holds, one second later it does not.
 *
 * The list of Tier-1 releases is a versioned config file keyed on MT5 calendar
 * event ids, never on names. It cannot be invented here (plan decision D13), so
 * it ships EMPTY, and an empty, unreadable or incomplete list FAILS CLOSED: the
 * check answers `UNKNOWN` and Report 2 is not offered, rather than offering
 * during a release nobody listed. The same holds for a calendar that cannot be
 * read or holds no row at all (5.3: an unavailable calendar is never read as
 * "no news").
 *
 * The events arrive in UTC (the exporter converts from broker time), stored
 * append-only: the newest observation of each `value_id` is the release's
 * state. A calendar not seen for 45 minutes does NOT lift the blackout, which
 * keeps applying from the last known schedule; the calendar's age is returned
 * so the reply can show it (7.6). The age is the age of the NEWEST OBSERVATION:
 * the gateway stores a row only when something changed, so a quiet calendar
 * ages even though the exporter runs.
 *
 * Pure: the clock, the list and the events are passed in; every time is whole
 * seconds read once and compared exactly, with no date arithmetic on numbers.
 *
 * @module lib/engine4/blackout
 */

import { readPositive, type DecimalLike } from './exact';
import { isRecord } from './levels';
import { HOUR_SECONDS, MINUTE_SECONDS, readSeconds } from './time';
import { Engine4InputError, type TraderType } from './types';

/** 15 minutes either side of a release with an exact time. */
export const BLACKOUT_EXACT_SECONDS = 15n * MINUTE_SECONDS;
/** 60 minutes either side when the time is approximate (`time_mode` is not 0). */
export const BLACKOUT_APPROXIMATE_SECONDS = 60n * MINUTE_SECONDS;
/** The holding window of each trader type: how far ahead a release is worth a warning. */
export const HOLDING_WINDOW_SECONDS: Readonly<Record<TraderType, bigint>> = {
  SCALPER: 2n * HOUR_SECONDS,
  DAY_TRADER: 12n * HOUR_SECONDS,
};
/** The calendar counts as late when its newest observation is older than this (7.6). */
export const CALENDAR_LATE_SECONDS = 45n * MINUTE_SECONDS;

// ---------------------------------------------------------------------------
// The Tier-1 list (config/engine4/tier1-events.json)
// ---------------------------------------------------------------------------

/** The four releases ADR-060 names. */
export const TIER1_KINDS = [
  'CPI',
  'CORE_PCE',
  'FOMC_RATE_DECISION',
  'NFP',
] as const;
export type Tier1Kind = (typeof TIER1_KINDS)[number];

export const TIER1_SCHEMA_VERSION = 1;

export interface Tier1Entry {
  /** the MT5 calendar event id (`MqlCalendarEvent.id`) as text: opaque, never arithmetic */
  eventId: string;
  kind: Tier1Kind;
  /** a label for people; never matched on */
  name: string;
}

export interface Tier1List {
  schemaVersion: 1;
  /** bumped whenever the list changes; recorded with a blackout decision */
  listVersion: number;
  events: Tier1Entry[];
}

export type Tier1Parse =
  | { ok: true; list: Tier1List }
  | { ok: false; problems: string[] };

const LIST_KEYS: readonly string[] = [
  '$schema',
  'schemaVersion',
  'listVersion',
  'description',
  'events',
];
const ENTRY_KEYS: readonly string[] = ['eventId', 'kind', 'name'];
/** MQL5 ids are `ulong`: digits only, at most 20 of them. */
const EVENT_ID = /^[0-9]{1,20}$/;

function positiveInteger(value: unknown): boolean {
  if (typeof value !== 'number') return false;
  try {
    return readPositive('value', value).isInteger();
  } catch {
    return false;
  }
}

/**
 * Read the Tier-1 config strictly. This is the one reader of the file; the JSON
 * schema beside it (`tier1-events.schema.json`) says the same thing for people
 * and editors, and a test keeps the two in step.
 */
export function parseTier1List(raw: unknown): Tier1Parse {
  const problems: string[] = [];
  if (!isRecord(raw)) {
    return { ok: false, problems: ['the Tier-1 list is not an object'] };
  }
  for (const key of Object.keys(raw)) {
    if (!LIST_KEYS.includes(key)) problems.push(`unknown key ${key}`);
  }
  if (raw['schemaVersion'] !== TIER1_SCHEMA_VERSION) {
    problems.push(`schemaVersion must be ${TIER1_SCHEMA_VERSION}`);
  }
  if (!positiveInteger(raw['listVersion'])) {
    problems.push('listVersion must be a whole number of at least 1');
  }
  if (
    raw['description'] !== undefined &&
    typeof raw['description'] !== 'string'
  ) {
    problems.push('description must be text');
  }

  const events: Tier1Entry[] = [];
  const rows = raw['events'];
  if (!Array.isArray(rows)) {
    problems.push('events must be a list');
  } else {
    const seen = new Set<string>();
    rows.forEach((row: unknown, index: number) => {
      const where = `events[${index}]`;
      if (!isRecord(row)) {
        problems.push(`${where} is not an object`);
        return;
      }
      for (const key of Object.keys(row)) {
        if (!ENTRY_KEYS.includes(key))
          problems.push(`${where} has an unknown key ${key}`);
      }
      const eventId = row['eventId'];
      const kind = row['kind'];
      const name = row['name'];
      if (typeof eventId !== 'string' || !EVENT_ID.test(eventId)) {
        problems.push(`${where}.eventId must be digits (an MT5 event id)`);
      } else if (seen.has(eventId)) {
        problems.push(`${where}.eventId ${eventId} is listed twice`);
      } else {
        seen.add(eventId);
      }
      if (typeof kind !== 'string' || !TIER1_KINDS.some((k) => k === kind)) {
        problems.push(`${where}.kind must be one of ${TIER1_KINDS.join(', ')}`);
      }
      if (typeof name !== 'string' || name.trim() === '') {
        problems.push(`${where}.name must be text`);
      }
      // an entry that broke a rule has put a problem in the list, and a list with a problem is thrown away
      events.push({
        eventId: eventId as string,
        kind: kind as Tier1Kind,
        name: name as string,
      });
    });
  }
  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    list: {
      schemaVersion: TIER1_SCHEMA_VERSION,
      listVersion: raw['listVersion'] as number,
      events,
    },
  };
}

/** The kinds the list does not cover. A list missing one would stay silent through that release. */
export function missingTier1Kinds(list: Tier1List): Tier1Kind[] {
  return TIER1_KINDS.filter(
    (kind) => !list.events.some((e) => e.kind === kind)
  );
}

// ---------------------------------------------------------------------------
// The check
// ---------------------------------------------------------------------------

/** One observation of a calendar release, the columns of `economic_events` this check uses. */
export interface CalendarEvent {
  /** MqlCalendarValue.id: one release */
  valueId: string;
  /** MqlCalendarEvent.id: the recurring event the Tier-1 list is keyed on */
  eventId: string;
  eventName: string;
  /** unix UTC seconds */
  eventTime: DecimalLike;
  currency: string;
  importance: string;
  /** upstream's ENUM_CALENDAR_EVENT_TIMEMODE; 0 is an exact instant, anything else (or unknown) is approximate */
  timeMode: number | null;
  /** unix UTC seconds: when this observation was made */
  capturedAt: DecimalLike;
}

export interface BlackoutInput {
  nowSeconds: DecimalLike;
  traderType: TraderType;
  /** the parsed Tier-1 config; null when it could not be read or failed its checks */
  list: Tier1List | null;
  /** every observation of every release that could matter; null when the calendar could not be read */
  events: readonly CalendarEvent[] | null;
  /** the newest `captured_at` in the whole calendar table; null when it holds no row */
  newestCapturedAt: DecimalLike | null;
}

export type BlackoutStatus = 'CLEAR' | 'BLOCKED' | 'UNKNOWN';

/** Why the check could not be answered; each one fails closed. */
export type BlackoutUnknownReason =
  | 'LIST_NOT_SET'
  | 'LIST_INVALID'
  | 'LIST_INCOMPLETE'
  | 'CALENDAR_UNAVAILABLE'
  | 'CALENDAR_EMPTY'
  | 'EVENT_UNREADABLE';

export interface BlackoutBlock {
  valueId: string;
  eventId: string;
  eventName: string;
  kind: Tier1Kind;
  eventTime: bigint;
  /** the time is only approximate: the wider margin applied */
  approximate: boolean;
  marginSeconds: bigint;
  windowStart: bigint;
  /** from this second on the release no longer blocks */
  windowEnd: bigint;
}

export interface HoldingWarning {
  valueId: string;
  eventId: string;
  eventName: string;
  eventTime: bigint;
  approximate: boolean;
  /** the release is on the Tier-1 list (it will block when its window opens) */
  tier1: boolean;
  /** seconds from now to the release */
  secondsUntil: bigint;
}

export interface CalendarAge {
  /** the newest `captured_at` in the calendar, or null when there is none */
  newestObservationAt: bigint | null;
  ageSeconds: bigint | null;
  /** older than 45 minutes: show the age (7.6); the blackout still applies */
  late: boolean;
}

export interface BlackoutResult {
  status: BlackoutStatus;
  unknownReasons: BlackoutUnknownReason[];
  /** soonest first */
  blocks: BlackoutBlock[];
  /** the latest end among the blocks, or null when there is none */
  windowEndsAt: bigint | null;
  /** soonest first */
  warnings: HoldingWarning[];
  holdingWindowSeconds: bigint;
  calendar: CalendarAge;
  /** the version of the list the decision used, or null when there was none */
  listVersion: number | null;
}

interface Observed {
  event: CalendarEvent;
  time: bigint;
  captured: bigint;
}

export function checkBlackout(input: BlackoutInput): BlackoutResult {
  const now = readSeconds('nowSeconds', input.nowSeconds);
  if (
    !Object.prototype.hasOwnProperty.call(
      HOLDING_WINDOW_SECONDS,
      input.traderType
    )
  ) {
    throw new Engine4InputError(
      'BAD_OPTION',
      'traderType is not SCALPER or DAY_TRADER',
      'traderType'
    );
  }
  const holding = HOLDING_WINDOW_SECONDS[input.traderType];
  const unknown: BlackoutUnknownReason[] = [];
  const addUnknown = (reason: BlackoutUnknownReason): void => {
    if (!unknown.includes(reason)) unknown.push(reason);
  };

  // -- the list ---------------------------------------------------------------
  const list = input.list;
  if (list === null) addUnknown('LIST_INVALID');
  else if (list.events.length === 0) addUnknown('LIST_NOT_SET');
  else if (missingTier1Kinds(list).length > 0) addUnknown('LIST_INCOMPLETE');
  const tier1ById = new Map<string, Tier1Entry>();
  for (const entry of list === null ? [] : list.events) {
    tier1ById.set(entry.eventId, entry);
  }

  // -- the calendar -----------------------------------------------------------
  let newest: bigint | null = null;
  if (input.events === null) {
    addUnknown('CALENDAR_UNAVAILABLE');
  } else if (input.newestCapturedAt === null) {
    addUnknown('CALENDAR_EMPTY');
  }
  if (input.newestCapturedAt !== null) {
    try {
      newest = readSeconds('newestCapturedAt', input.newestCapturedAt);
    } catch {
      addUnknown('CALENDAR_UNAVAILABLE');
    }
  }

  // the newest observation of each release is that release's state
  const newestOfRelease = new Map<string, Observed>();
  for (const event of input.events ?? []) {
    let time: bigint;
    let captured: bigint;
    try {
      time = readSeconds('eventTime', event.eventTime);
      captured = readSeconds('capturedAt', event.capturedAt);
    } catch {
      addUnknown('EVENT_UNREADABLE');
      continue;
    }
    const seen = newestOfRelease.get(event.valueId);
    if (seen === undefined || captured > seen.captured) {
      newestOfRelease.set(event.valueId, { event, time, captured });
    }
  }

  // -- the windows ------------------------------------------------------------
  const blocks: BlackoutBlock[] = [];
  const warnings: HoldingWarning[] = [];
  for (const { event, time } of newestOfRelease.values()) {
    const entry = tier1ById.get(event.eventId);
    const approximate = event.timeMode !== 0;
    const margin = approximate
      ? BLACKOUT_APPROXIMATE_SECONDS
      : BLACKOUT_EXACT_SECONDS;
    const windowStart = time - margin;
    const windowEnd = time + margin;
    if (entry !== undefined && now >= windowStart && now <= windowEnd) {
      blocks.push({
        valueId: event.valueId,
        eventId: event.eventId,
        eventName: event.eventName,
        kind: entry.kind,
        eventTime: time,
        approximate,
        marginSeconds: margin,
        windowStart,
        windowEnd,
      });
      continue;
    }
    if (
      event.importance === 'HIGH' &&
      event.currency === 'USD' &&
      time >= now &&
      time - now <= holding
    ) {
      warnings.push({
        valueId: event.valueId,
        eventId: event.eventId,
        eventName: event.eventName,
        eventTime: time,
        approximate,
        tier1: entry !== undefined,
        secondsUntil: time - now,
      });
    }
  }
  const byTime = (
    a: { eventTime: bigint },
    b: { eventTime: bigint }
  ): number =>
    a.eventTime < b.eventTime ? -1 : a.eventTime > b.eventTime ? 1 : 0;
  blocks.sort(byTime);
  warnings.sort(byTime);

  let windowEndsAt: bigint | null = null;
  for (const block of blocks) {
    if (windowEndsAt === null || block.windowEnd > windowEndsAt) {
      windowEndsAt = block.windowEnd;
    }
  }

  const ageSeconds = newest === null ? null : now > newest ? now - newest : 0n;
  return {
    status:
      blocks.length > 0 ? 'BLOCKED' : unknown.length > 0 ? 'UNKNOWN' : 'CLEAR',
    unknownReasons: unknown,
    blocks,
    windowEndsAt,
    warnings,
    holdingWindowSeconds: holding,
    calendar: {
      newestObservationAt: newest,
      ageSeconds,
      late: ageSeconds !== null && ageSeconds > CALENDAR_LATE_SECONDS,
    },
    listVersion: list === null ? null : list.listVersion,
  };
}
