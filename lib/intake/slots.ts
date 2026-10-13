/**
 * Cycle slots and event times as text, without a clock (architecture 2.2 rule 1, 4.4).
 *
 * A cycle is named by its slot: unix UTC seconds, a multiple of 300. The sensors' envelopes,
 * the packet and the board write it as ISO 8601 to the minute (`2026-09-18T20:55Z`); the
 * calendar's events are written to the second (`2026-09-18T21:30:00Z`). The pure files of
 * this folder may not use `Date` (the boundaries guard), so the calendar arithmetic is done
 * here on whole days, the way the civil calendar is counted from the epoch; a test holds it
 * to `Date` over every slot of several years and the edges of the range.
 *
 * @module lib/intake/slots
 */

export const SLOT_SECONDS = 300;

/** 9999-12-31T23:59:59Z: the last instant four digits can name. */
export const MAX_SECONDS = 253_402_300_799;

const DAY = 86_400;
const MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;

const pad = (value: number, width: number): string =>
  String(value).padStart(width, '0');

/** Whole seconds inside the range the text forms can name. */
export function isEpochSeconds(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_SECONDS
  );
}

export function isSlotSeconds(value: unknown): value is number {
  return isEpochSeconds(value) && value % SLOT_SECONDS === 0;
}

interface Civil {
  year: number;
  month: number; // 1 to 12
  day: number; // 1 to 31
  hour: number;
  minute: number;
  second: number;
}

/** The civil date of a day count from 1970-01-01 (Hinnant's days-to-civil). */
function civilOfDays(days: number): {
  year: number;
  month: number;
  day: number;
} {
  const z = days + 719_468;
  const era = Math.floor(z / 146_097);
  const doe = z - era * 146_097;
  const yoe = Math.floor(
    (doe -
      Math.floor(doe / 1_460) +
      Math.floor(doe / 36_524) -
      Math.floor(doe / 146_096)) /
      365
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  return { year, month, day };
}

/** The day count from 1970-01-01 of a civil date (Hinnant's civil-to-days). */
function daysOfCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = month > 2 ? month - 3 : month + 9;
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146_097 + doe - 719_468;
}

function civilOf(seconds: number): Civil {
  const days = Math.floor(seconds / DAY);
  const rest = seconds - days * DAY;
  return {
    ...civilOfDays(days),
    hour: Math.floor(rest / 3_600),
    minute: Math.floor((rest % 3_600) / 60),
    second: rest % 60,
  };
}

/** `2026-09-18T20:55Z`: a slot as the envelopes write it. */
export function slotIso(seconds: number): string {
  if (!isEpochSeconds(seconds)) {
    throw new RangeError('not a time in 1970..9999');
  }
  const c = civilOf(seconds);
  return `${pad(c.year, 4)}-${pad(c.month, 2)}-${pad(c.day, 2)}T${pad(c.hour, 2)}:${pad(c.minute, 2)}Z`;
}

/** `2026-09-18T21:30:00Z`: a time to the second, as the calendar's events are written. */
export function timeIso(seconds: number): string {
  if (!isEpochSeconds(seconds)) {
    throw new RangeError('not a time in 1970..9999');
  }
  const c = civilOf(seconds);
  return `${pad(c.year, 4)}-${pad(c.month, 2)}-${pad(c.day, 2)}T${pad(c.hour, 2)}:${pad(c.minute, 2)}:${pad(c.second, 2)}Z`;
}

const SLOT_TEXT = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2})Z$/;

/** The unix seconds of `2026-09-18T20:55Z`, or null when the text is not a real slot. */
export function secondsOfSlot(text: unknown): number | null {
  if (typeof text !== 'string') return null;
  const m = SLOT_TEXT.exec(text);
  if (m === null) return null;
  const [year, month, day, hour, minute] = m.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const seconds =
    daysOfCivil(year, month, day) * DAY + hour * 3_600 + minute * 60;
  // A part the calendar does not have (month 13, 31 February, hour 24, minute 60) reads back
  // as another time, so writing the time out again and comparing is the whole validation.
  if (!isEpochSeconds(seconds) || slotIso(seconds) !== text) return null;
  return seconds % SLOT_SECONDS === 0 ? seconds : null;
}

/** The slot `count` slots after (or, negative, before) `slot`; null when it leaves the range. */
export function shiftSlot(slot: string, count: number): string | null {
  const seconds = secondsOfSlot(slot);
  if (seconds === null || !Number.isInteger(count)) return null;
  const shifted = seconds + count * SLOT_SECONDS;
  return isEpochSeconds(shifted) ? slotIso(shifted) : null;
}

/** `18 SEP 20:55`: the stamp the board's header carries (UTC). */
export function boardStamp(seconds: number): string {
  if (!isEpochSeconds(seconds)) {
    throw new RangeError('not a time in 1970..9999');
  }
  const c = civilOf(seconds);
  return `${pad(c.day, 2)} ${MONTHS[c.month - 1] as string} ${pad(c.hour, 2)}:${pad(c.minute, 2)}`;
}

/** `20:55`: the time of day of a time (UTC). */
export function clockOf(seconds: number): string {
  if (!isEpochSeconds(seconds)) {
    throw new RangeError('not a time in 1970..9999');
  }
  const c = civilOf(seconds);
  return `${pad(c.hour, 2)}:${pad(c.minute, 2)}`;
}
