/**
 * XAUUSD market-hours gate (STACK-D-ARCHITECTURE.md section 1.3 rule 7: MARKET
 * CLOSED comes from the market-hours gate).
 *
 * A TypeScript port of `is_dst_active()` and `is_market_open_xauusd()` in
 * backend-stack-c/.../export_collector_validator_v2.py. The collector decides
 * whether to run a cycle with the Python gate; the gateway decides what status
 * to report with this one. They MUST agree, or a slot the collector skipped would
 * be reported STALE instead of MARKET CLOSED. So this is a faithful port, not an
 * improvement, and test/market-hours.spec.ts checks it against fixtures that
 * scripts/generate_market_hours_parity.py produces by running the real Python.
 *
 * The rule: the broker's server clock is UTC+2, or UTC+3 while US daylight
 * saving is in force. The market is open Monday to Friday, 01:01 up to (not
 * including) 23:59 server time; Saturday and Sunday server days are closed.
 *
 * US DST is modelled as 2nd Sunday of March 00:00 UTC up to 1st Sunday of
 * November 00:00 UTC, exactly as the collector does. The US change itself
 * happens a few hours later on that Sunday, but the server day is Sunday under
 * either offset (closed until Monday 01:01), so that difference cannot change an
 * open/closed answer. Whether the broker's own clock follows the US rule is
 * taken from the collector, not verified here; the chapter 7 blackout test
 * across the broker's clock change is a separate concern.
 */

const MS_PER_SECOND = 1000;
const MS_PER_DAY = 86_400_000;

/** 01:01 server time, in minutes since server midnight (inclusive). */
export const MARKET_OPEN_SERVER_MINUTE = 61;
/** 23:59 server time, in minutes since server midnight (exclusive). */
export const MARKET_CLOSE_SERVER_MINUTE = 23 * 60 + 59;

function assertTime(tsUtc: number): void {
  if (!Number.isFinite(tsUtc)) {
    throw new RangeError(
      `tsUtc must be a finite unix time in seconds, got ${String(tsUtc)}`
    );
  }
}

/** Epoch milliseconds of 00:00 UTC on the nth Sunday of a month (month 1-12). */
function nthSundayUtcMs(year: number, month: number, nth: number): number {
  const firstOfMonth = Date.UTC(year, month - 1, 1);
  const dayOfWeek = new Date(firstOfMonth).getUTCDay(); // 0 = Sunday
  const daysToFirstSunday = (7 - dayOfWeek) % 7;
  return firstOfMonth + (daysToFirstSunday + 7 * (nth - 1)) * MS_PER_DAY;
}

/** True while US daylight saving is modelled as in force (see header). */
export function isDstActive(tsUtc: number): boolean {
  assertTime(tsUtc);
  const ms = tsUtc * MS_PER_SECOND;
  const year = new Date(ms).getUTCFullYear();
  return nthSundayUtcMs(year, 3, 2) <= ms && ms < nthSundayUtcMs(year, 11, 1);
}

/** Hours the broker's server clock is ahead of UTC at this moment. */
export function serverOffsetHours(tsUtc: number): 2 | 3 {
  return isDstActive(tsUtc) ? 3 : 2;
}

/** True when the XAUUSD market is open at this moment (unix UTC seconds). */
export function isMarketOpenXauusd(tsUtc: number): boolean {
  assertTime(tsUtc);
  const server = new Date(
    (tsUtc + serverOffsetHours(tsUtc) * 3600) * MS_PER_SECOND
  );
  const day = server.getUTCDay(); // server weekday: 0 = Sunday, 6 = Saturday
  if (day === 0 || day === 6) return false;
  const minutes = server.getUTCHours() * 60 + server.getUTCMinutes();
  return (
    minutes >= MARKET_OPEN_SERVER_MINUTE && minutes < MARKET_CLOSE_SERVER_MINUTE
  );
}
