/**
 * Slot and closed-bar arithmetic (STACK-D-ARCHITECTURE.md section 1.3,
 * rules 1, 2 and 3; ADR-008, ADR-011).
 *
 * A SLOT is a 5-minute boundary in UTC (20:55, 21:00, ...) and the one key that
 * says which M5 rows, M15 rows, statistics and chart belong together. Everything
 * here is pure: whole-second UTC timestamps in, whole-second UTC timestamps out.
 *
 * WHY THIS IS STRICT ABOUT ITS INPUTS
 *
 * Every function that takes a `slot` rejects a value that is not on a slot
 * boundary. The classic bug is passing "now" where a slot belongs: the window
 * is then wrong by up to four minutes and nothing errors, because a wrong
 * window is still a valid window. Throwing here turns that into a loud failure
 * at the call site.
 *
 * These functions say which bar WOULD be closed or forming at a slot. Whether a
 * bar exists for that time (a market-closed gap has none) is the data's business
 * and belongs to the closed-bar view, not to arithmetic.
 */

/** One cycle per 5-minute slot (rule 1). */
export const SLOT_SECONDS = 300;

export const TIMEFRAMES = ['M5', 'M15'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

/**
 * Bar length in seconds. Restated rather than imported from
 * `worker/point-in-time-snapshot.ts` so the cycle module does not depend on the
 * worker; test/cycle-slot.spec.ts fails if the two ever disagree.
 */
export const TIMEFRAME_SECONDS: Readonly<Record<Timeframe, number>> =
  Object.freeze({
    M5: 300,
    M15: 900,
  });

export function isTimeframe(value: unknown): value is Timeframe {
  // An explicit list, not `in`: `'toString' in {}` is true.
  return (
    typeof value === 'string' &&
    (TIMEFRAMES as readonly string[]).includes(value)
  );
}

function periodOf(timeframe: Timeframe): number {
  const period = isTimeframe(timeframe) ? TIMEFRAME_SECONDS[timeframe] : NaN;
  if (!Number.isFinite(period)) {
    throw new RangeError(`unsupported timeframe: ${String(timeframe)}`);
  }
  return period;
}

function assertUnixSeconds(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(
      `${name} must be a finite unix time in seconds, got ${String(value)}`
    );
  }
}

function assertSlot(slot: number): void {
  assertUnixSeconds('slot', slot);
  if (slot % SLOT_SECONDS !== 0) {
    throw new RangeError(
      `slot must be a multiple of ${SLOT_SECONDS} seconds, got ${slot}`
    );
  }
}

/** True when `ts` falls exactly on a slot boundary. */
export function isSlot(ts: number): boolean {
  return Number.isFinite(ts) && ts >= 0 && ts % SLOT_SECONDS === 0;
}

/** The slot a moment belongs to: `ts` rounded down to the 5-minute boundary. */
export function slotOf(ts: number): number {
  assertUnixSeconds('ts', ts);
  return Math.floor(ts / SLOT_SECONDS) * SLOT_SECONDS;
}

/**
 * Rule 2: a bar is closed when its open time plus its period is at or before
 * the slot. At the 20:55 slot the M5 bar opened 20:50 is closed (20:50 + 5 min
 * = 20:55) and the one opened 20:55 is not.
 */
export function isClosedBar(
  barOpenTime: number,
  timeframe: Timeframe,
  slot: number
): boolean {
  assertUnixSeconds('barOpenTime', barOpenTime);
  assertSlot(slot);
  return barOpenTime + periodOf(timeframe) <= slot;
}

/**
 * Open time of the bar still forming at the slot (rule 3 exposes it only as a
 * labelled last price, never as a bar). At the 20:55 slot: M5 -> 20:55,
 * M15 -> 20:45.
 */
export function formingBarOpen(timeframe: Timeframe, slot: number): number {
  assertSlot(slot);
  const period = periodOf(timeframe);
  return Math.floor(slot / period) * period;
}

/**
 * Open time of the newest bar that is closed at the slot. At the 20:55 slot:
 * M5 -> 20:50, M15 -> 20:30 (the 20:45 bar is still open), as in section 1.5.
 * By construction `isClosedBar` is true for this time and false for the next.
 */
export function lastClosedBarOpen(timeframe: Timeframe, slot: number): number {
  return formingBarOpen(timeframe, slot) - periodOf(timeframe);
}

/**
 * Rule 5: a sensor uses the statistics row captured at the slot where its
 * timeframe was LAST COLLECTED. M5 is collected on every slot. M15 only on
 * :00 :15 :30 :45, so at the 20:55 slot its statistics sit at the 20:45 slot.
 * A reader that finds no row at this slot reports STALE; it never falls back to
 * "the latest available".
 */
export function lastCollectedSlot(timeframe: Timeframe, slot: number): number {
  return formingBarOpen(timeframe, slot);
}

/** True when the slot refreshes this timeframe (always for M5; quarter hours for M15). */
export function isRefreshSlot(timeframe: Timeframe, slot: number): boolean {
  return lastCollectedSlot(timeframe, slot) === slot;
}
