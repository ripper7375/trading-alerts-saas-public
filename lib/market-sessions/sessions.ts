/**
 * Market Session Clock -- pure, dependency-free session-state computation.
 *
 * WHY THIS IS NOT MOCK DATA
 * -------------------------
 * `components/market-comments-panel.tsx` renders a genuine empty state
 * because Stack E's narrated comments feed does not exist yet, and
 * `seed-code`'s own panel simulated it (Session 9-4 Decision 2, "zero mock
 * data"). Session state is different in kind: it is *computed from the
 * clock*, not simulated. Nothing here is fabricated or stubbed -- given an
 * instant, there is exactly one correct answer. That is why the session
 * banner may ship while the news countdown beside it may not: the news
 * countdown needs event data that has no source in this repo yet.
 *
 * DESIGN NOTES
 * ------------
 * 1. All zone maths goes through IANA identifiers and `Intl`, never through
 *    hardcoded UTC offsets. Hardcoding breaks four times a year, and Sydney
 *    runs its DST opposite to London/New York, so a "just add 10 hours"
 *    shortcut is wrong for roughly half the year in at least one centre.
 *
 * 2. A session is only open when the FOREX MARKET ITSELF is open. This is
 *    not pedantry -- Sydney's nominal 08:00 Monday start falls up to an hour
 *    before the market actually opens (Sunday 17:00 New York), so an
 *    ungated implementation reports "Sydney open" while nothing is trading.
 *    Same class of error on Saturday, when every naive session clock shows
 *    Tokyo open at 10:00 JST.
 *
 * 3. Session hours below are the conventional financial-centre hours used by
 *    most session clocks. They are a presentation convention, not an
 *    exchange rule -- adjust freely; the engine does not care.
 */

export type MarketSessionId = 'sydney' | 'tokyo' | 'london' | 'newYork';

export interface MarketSessionDefinition {
  id: MarketSessionId;
  /** English name. Pass through `t()` at the render site, never here. */
  name: string;
  /** ISO 3166-1 alpha-2, matching the seed's AU / JP / GB / US pills. */
  countryCode: string;
  flag: string;
  timeZone: string;
  /** Local opening hour in that centre, 0-23. */
  openHour: number;
  /** Local closing hour in that centre, 0-23 (exclusive). */
  closeHour: number;
}

export const MARKET_SESSIONS: readonly MarketSessionDefinition[] = [
  {
    id: 'sydney',
    name: 'Sydney',
    countryCode: 'AU',
    flag: '\u{1F1E6}\u{1F1FA}',
    timeZone: 'Australia/Sydney',
    openHour: 8,
    closeHour: 17,
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    countryCode: 'JP',
    flag: '\u{1F1EF}\u{1F1F5}',
    timeZone: 'Asia/Tokyo',
    openHour: 9,
    closeHour: 18,
  },
  {
    id: 'london',
    name: 'London',
    countryCode: 'GB',
    flag: '\u{1F1EC}\u{1F1E7}',
    timeZone: 'Europe/London',
    openHour: 8,
    closeHour: 17,
  },
  {
    id: 'newYork',
    name: 'New York',
    countryCode: 'US',
    flag: '\u{1F1FA}\u{1F1F8}',
    timeZone: 'America/New_York',
    openHour: 8,
    closeHour: 17,
  },
] as const;

/** The market's own week, expressed in New York local time. */
const MARKET_TIME_ZONE = 'America/New_York';
const MARKET_OPEN_WEEKDAY = 0; // Sunday
const MARKET_OPEN_HOUR = 17;
const MARKET_CLOSE_WEEKDAY = 5; // Friday
const MARKET_CLOSE_HOUR = 17;

const MS_PER_DAY = 86_400_000;

export interface MarketSessionStatus {
  id: MarketSessionId;
  isOpen: boolean;
  /** Seconds until this session opens. `null` while it is open. */
  opensInSeconds: number | null;
  /** Seconds until this session closes. `null` while it is closed. */
  closesInSeconds: number | null;
}

export interface MarketSessionState {
  /** Is the forex market itself trading right now? */
  isMarketOpen: boolean;
  /** All four sessions, always in MARKET_SESSIONS order. */
  sessions: MarketSessionStatus[];
  /**
   * The session to headline. When several overlap (London/New York being
   * the significant one), this is the most recently opened -- the centre
   * whose turn it currently is. `null` when nothing is open.
   */
  primarySessionId: MarketSessionId | null;
  /** Seconds until the market reopens. `null` while it is open. */
  marketReopensInSeconds: number | null;
}

interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Wall-clock fields for `date` as observed in `timeZone`.
 *
 * `hourCycle: 'h23'` rather than `hour12: false` -- the latter can yield
 * hour "24" for midnight on some ICU builds, which silently breaks every
 * comparison below.
 */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

/**
 * Constructing an `Intl.DateTimeFormat` is the expensive part of zone
 * maths; formatting with an existing one is cheap. A single
 * `getMarketSessionState()` call resolves parts a few hundred times in the
 * worst case (four sessions x an eight-day forward scan), and the banner
 * recomputes once a second, so the uncached version would build tens of
 * thousands of formatters a minute in an open terminal tab. There are only
 * ever five distinct zones, so the cache is bounded by construction.
 */
function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = getFormatter(timeZone).formatToParts(date);

  const found: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') found[part.type] = part.value;
  }

  return {
    year: Number(found['year']),
    month: Number(found['month']),
    day: Number(found['day']),
    hour: Number(found['hour']),
    minute: Number(found['minute']),
    second: Number(found['second']),
    weekday: WEEKDAY_INDEX[found['weekday'] ?? 'Sun'] ?? 0,
  };
}

/** Offset of `timeZone` from UTC at `date`, in milliseconds. */
function getZoneOffsetMs(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone);
  const asIfUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second
  );
  // Parts carry second resolution, so compare against a second-floored instant.
  return asIfUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * The UTC instant at which `timeZone` reads the given wall-clock time.
 *
 * Offsets are resolved twice: the first guess uses the offset in force at
 * the naive instant, which is the wrong side of a DST boundary roughly two
 * hours per year. The second pass corrects it.
 */
function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, 0, 0);
  const firstOffset = getZoneOffsetMs(new Date(naive), timeZone);
  let instant = naive - firstOffset;

  const secondOffset = getZoneOffsetMs(new Date(instant), timeZone);
  if (secondOffset !== firstOffset) instant = naive - secondOffset;

  return new Date(instant);
}

/** Is the forex market trading at `date`? */
export function isForexMarketOpen(date: Date): boolean {
  const ny = getZonedParts(date, MARKET_TIME_ZONE);

  if (ny.weekday === 6) return false; // all Saturday
  if (ny.weekday === MARKET_CLOSE_WEEKDAY && ny.hour >= MARKET_CLOSE_HOUR) {
    return false; // Friday, after the New York close
  }
  if (ny.weekday === MARKET_OPEN_WEEKDAY && ny.hour < MARKET_OPEN_HOUR) {
    return false; // Sunday, before the Sydney-side reopen
  }
  return true;
}

/** The next instant at or after `from` at which the market is open. */
function getNextMarketOpen(from: Date): Date {
  for (let dayOffset = 0; dayOffset <= 8; dayOffset++) {
    const probe = new Date(from.getTime() + dayOffset * MS_PER_DAY);
    const ny = getZonedParts(probe, MARKET_TIME_ZONE);
    if (ny.weekday !== MARKET_OPEN_WEEKDAY) continue;

    const open = zonedWallTimeToUtc(
      ny.year,
      ny.month,
      ny.day,
      MARKET_OPEN_HOUR,
      MARKET_TIME_ZONE
    );
    if (open.getTime() > from.getTime()) return open;
  }
  // Unreachable for any real date; keeps the return type honest.
  return new Date(from.getTime() + 7 * MS_PER_DAY);
}

/** That session's open/close instants on the local day containing `date`. */
function getSessionBoundsOnLocalDay(
  session: MarketSessionDefinition,
  date: Date
): { open: Date; close: Date; weekday: number } {
  const p = getZonedParts(date, session.timeZone);
  return {
    open: zonedWallTimeToUtc(
      p.year,
      p.month,
      p.day,
      session.openHour,
      session.timeZone
    ),
    close: zonedWallTimeToUtc(
      p.year,
      p.month,
      p.day,
      session.closeHour,
      session.timeZone
    ),
    weekday: p.weekday,
  };
}

/**
 * Effective open instant: a session cannot begin before the market does.
 * This is what stops Sydney reporting "open" during the Sunday-evening gap.
 *
 * NOTE -- this and the `isForexMarketOpen(now)` term in
 * `computeSessionStatus` below are a DELIBERATE REDUNDANT PAIR, and each
 * looks removable in isolation. Verified by mutation testing: deleting
 * either one alone leaves all 26 tests green, because the other catches
 * every case reachable at the current session hours. Deleting BOTH fails
 * two tests. Do not "simplify" one away -- the redundancy stops being
 * redundant the moment a session's hours cross the Friday New York close
 * (e.g. raising `newYork.closeHour` past 17), and this pair is what keeps
 * that change from silently reporting a session open into the weekend.
 */
function effectiveOpen(nominalOpen: Date): Date {
  return isForexMarketOpen(nominalOpen)
    ? nominalOpen
    : getNextMarketOpen(nominalOpen);
}

function computeSessionStatus(
  session: MarketSessionDefinition,
  now: Date
): MarketSessionStatus {
  const nowMs = now.getTime();
  const today = getSessionBoundsOnLocalDay(session, now);

  const isWeekday = today.weekday >= 1 && today.weekday <= 5;
  const openMs = effectiveOpen(today.open).getTime();
  const closeMs = today.close.getTime();

  if (
    isWeekday &&
    nowMs >= openMs &&
    nowMs < closeMs &&
    isForexMarketOpen(now)
  ) {
    return {
      id: session.id,
      isOpen: true,
      opensInSeconds: null,
      closesInSeconds: Math.round((closeMs - nowMs) / 1000),
    };
  }

  // Closed: walk forward to the next local weekday whose session starts later
  // than now. Eight probes covers the longest possible gap (a Friday close to
  // the following Monday open) with room to spare.
  for (let dayOffset = 0; dayOffset <= 8; dayOffset++) {
    const probe = new Date(nowMs + dayOffset * MS_PER_DAY);
    const bounds = getSessionBoundsOnLocalDay(session, probe);
    if (bounds.weekday < 1 || bounds.weekday > 5) continue;

    const candidate = effectiveOpen(bounds.open).getTime();
    if (candidate > nowMs) {
      return {
        id: session.id,
        isOpen: false,
        opensInSeconds: Math.round((candidate - nowMs) / 1000),
        closesInSeconds: null,
      };
    }
  }

  return {
    id: session.id,
    isOpen: false,
    opensInSeconds: null,
    closesInSeconds: null,
  };
}

/**
 * Full session state at `now`. Pure: same instant in, same state out.
 */
export function getMarketSessionState(
  now: Date = new Date()
): MarketSessionState {
  const marketOpen = isForexMarketOpen(now);
  const sessions = MARKET_SESSIONS.map((s) => computeSessionStatus(s, now));

  // Headline the most recently opened active session -- during the
  // London/New York overlap that is New York, whose open moved the market.
  let primarySessionId: MarketSessionId | null = null;
  let latestOpenMs = -Infinity;

  for (const session of MARKET_SESSIONS) {
    const status = sessions.find((s) => s.id === session.id);
    if (!status?.isOpen) continue;

    const openMs = effectiveOpen(
      getSessionBoundsOnLocalDay(session, now).open
    ).getTime();
    if (openMs > latestOpenMs) {
      latestOpenMs = openMs;
      primarySessionId = session.id;
    }
  }

  return {
    isMarketOpen: marketOpen,
    sessions,
    primarySessionId,
    marketReopensInSeconds: marketOpen
      ? null
      : Math.round((getNextMarketOpen(now).getTime() - now.getTime()) / 1000),
  };
}

/** Look up a session definition by id. */
export function getSessionDefinition(
  id: MarketSessionId
): MarketSessionDefinition | undefined {
  return MARKET_SESSIONS.find((s) => s.id === id);
}

/**
 * `HH:MM:SS`, or `Nd HH:MM:SS` past a day -- a Friday-close-to-Monday-open
 * gap is ~65 hours, which reads as nonsense without the day component.
 */
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return days > 0 ? `${days}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}
