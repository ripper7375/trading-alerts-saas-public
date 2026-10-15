/**
 * The period of the quota ledger: a UTC calendar month (build step 7 part 6; decision D2,
 * architecture 7.3).
 *
 * A trader's allowance runs from the first instant of a UTC month to the first instant of the
 * next, whatever time zone the trader or the server is in, so two requests a millisecond apart
 * across midnight UTC of the 1st belong to two different periods. The month is written
 * `YYYY-MM` (`2026-10`), the key of `ai_quota_periods`.
 *
 * Every function takes the time as a number of milliseconds since the epoch: nothing here reads
 * the clock (the caller does, and a test passes the instant it wants). Pure.
 *
 * @module lib/platform/metering/period
 */

/** `YYYY-MM`: the database's own pattern (`ai_quota_periods_month_is_a_month`). */
export const MONTH = /^[0-9]{4}-(0[1-9]|1[0-2])$/;

/** The first year the ledger writes: before the product existed, and a typo guard on the other side. */
export const FIRST_YEAR = 2000;
export const LAST_YEAR = 9998;

export function isMonth(value: unknown): value is string {
  return typeof value === 'string' && MONTH.test(value);
}

/** A time the ledger can hold: a finite number of milliseconds in the years 2000 to 9998. */
export function isInstant(ms: unknown): ms is number {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return false;
  const year = new Date(ms).getUTCFullYear();
  return year >= FIRST_YEAR && year <= LAST_YEAR;
}

/** The UTC month an instant falls in, or null for a time that is not an instant of the ledger's years. */
export function monthOf(ms: number): string | null {
  if (!isInstant(ms)) return null;
  const date = new Date(ms);
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function partsOf(month: string): { year: number; index: number } | null {
  if (!isMonth(month)) return null;
  return {
    year: Number(month.slice(0, 4)),
    index: Number(month.slice(5, 7)) - 1,
  };
}

/** The first millisecond of a month (UTC), or null for a string that is not a month. */
export function monthStartMs(month: string): number | null {
  const parts = partsOf(month);
  if (parts === null) return null;
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.index, 1);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

/** The first millisecond of the month after (UTC): the instant the period ends, exclusive. */
export function nextMonthStartMs(month: string): number | null {
  const parts = partsOf(month);
  if (parts === null) return null;
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.index + 1, 1);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

/** The month after a month, `2026-12` to `2027-01`; null for a string that is not a month. */
export function nextMonth(month: string): string | null {
  const next = nextMonthStartMs(month);
  return next === null ? null : monthOf(next);
}
