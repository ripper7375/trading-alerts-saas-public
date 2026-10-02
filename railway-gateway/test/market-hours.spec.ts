import * as fs from 'fs';
import * as path from 'path';
import {
  MARKET_CLOSE_SERVER_MINUTE,
  MARKET_OPEN_SERVER_MINUTE,
  isDstActive,
  isMarketOpenXauusd,
  serverOffsetHours,
} from '../src/cycle/market-hours';

/**
 * The market-hours gate is a TypeScript port of the collector's own
 * is_market_open_xauusd(). It decides MARKET CLOSED versus STALE, so it must
 * agree with the Python that decides whether a slot is collected at all.
 *
 * Three independent kinds of evidence, because each catches what the others
 * cannot:
 *
 *   1. PARITY with the real Python, over 2025-2027, at every moment the answer
 *      changes (fixture written by scripts/generate_market_hours_parity.py).
 *   2. HAND-DERIVED boundary cases, written from the rule (01:01 to 23:59
 *      server time, Monday to Friday, UTC+2 or UTC+3), not from the Python.
 *   3. AN INVARIANT: every server weekday has the same number of open minutes
 *      in both offsets, so a port that is right in winter and shifted by an
 *      hour in summer (or the reverse) cannot pass.
 */

interface ParityFixture {
  rangeStart: number;
  rangeEnd: number;
  stepSec: number;
  initialOpen: boolean;
  openFlips: number[];
  initialDst: boolean;
  dstFlips: number[];
}

const fixture: ParityFixture = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, 'fixtures/market-hours-parity.json'),
    'utf8'
  )
);

const utc = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0): number =>
  Date.UTC(y, mo - 1, d, h, mi, s) / 1000;

describe('parity with the collector (2025-2027)', () => {
  it('the fixture covers three years and a plausible number of flips', () => {
    // 2025, 2026 and 2027 are all common years: exactly 3 x 365 days.
    expect(fixture.rangeEnd - fixture.rangeStart).toBeGreaterThanOrEqual(
      3 * 365 * 86400
    );
    // About ten changes a week (nightly close and reopen, weekend close and reopen).
    expect(fixture.openFlips.length).toBeGreaterThan(1500);
    expect(fixture.openFlips.length).toBeLessThan(1700);
    expect(fixture.dstFlips).toHaveLength(6);
  });

  it('agrees at the start of the range', () => {
    expect(isMarketOpenXauusd(fixture.rangeStart)).toBe(fixture.initialOpen);
  });

  it('flips at exactly the same minute as the Python gate, every time', () => {
    let before = fixture.initialOpen;
    const mismatches: string[] = [];
    fixture.openFlips.forEach((flipAt, i) => {
      const after = !before;
      const checks: Array<[string, number, boolean]> = [
        ['one second before', flipAt - 1, before],
        ['one minute before', flipAt - fixture.stepSec, before],
        ['on the flip', flipAt, after],
        ['one second after', flipAt + 1, after],
      ];
      const next = fixture.openFlips[i + 1];
      if (next !== undefined) {
        // Midway through the stretch that follows, rounded down to a minute.
        const mid =
          Math.floor((flipAt + next) / 2 / fixture.stepSec) * fixture.stepSec;
        checks.push(['midway to the next flip', mid, after]);
      }
      for (const [label, ts, expected] of checks) {
        if (isMarketOpenXauusd(ts) !== expected) {
          mismatches.push(
            `${new Date(ts * 1000).toISOString()} (${label}): expected ${expected}`
          );
        }
      }
      before = after;
    });
    expect(mismatches).toEqual([]);
  });

  it('DST flips at exactly the same minute as the Python function', () => {
    expect(isDstActive(fixture.rangeStart)).toBe(fixture.initialDst);
    let before = fixture.initialDst;
    for (const flipAt of fixture.dstFlips) {
      const after = !before;
      expect(isDstActive(flipAt - 1)).toBe(before);
      expect(isDstActive(flipAt - fixture.stepSec)).toBe(before);
      expect(isDstActive(flipAt)).toBe(after);
      before = after;
    }
  });
});

describe('hand-derived cases (the rule, not the Python)', () => {
  it('summer, UTC+3: Friday closes at 23:59 server = 20:59 UTC', () => {
    expect(isMarketOpenXauusd(utc(2026, 9, 18, 20, 58, 59))).toBe(true);
    expect(isMarketOpenXauusd(utc(2026, 9, 18, 20, 59, 0))).toBe(false);
  });

  it('summer, UTC+3: Monday opens at 01:01 server = Sunday 22:01 UTC', () => {
    expect(isMarketOpenXauusd(utc(2026, 9, 20, 22, 0, 59))).toBe(false);
    expect(isMarketOpenXauusd(utc(2026, 9, 20, 22, 1, 0))).toBe(true);
  });

  it('winter, UTC+2: Friday closes at 21:59 UTC, Monday opens Sunday 23:01 UTC', () => {
    expect(isMarketOpenXauusd(utc(2026, 12, 4, 21, 58, 59))).toBe(true);
    expect(isMarketOpenXauusd(utc(2026, 12, 4, 21, 59, 0))).toBe(false);
    expect(isMarketOpenXauusd(utc(2026, 12, 6, 23, 0, 59))).toBe(false);
    expect(isMarketOpenXauusd(utc(2026, 12, 6, 23, 1, 0))).toBe(true);
  });

  it('is open in the middle of a weekday and closed all weekend', () => {
    expect(isMarketOpenXauusd(utc(2026, 9, 16, 12, 0))).toBe(true); // Wednesday
    expect(isMarketOpenXauusd(utc(2026, 9, 19, 12, 0))).toBe(false); // Saturday
    expect(isMarketOpenXauusd(utc(2026, 9, 20, 12, 0))).toBe(false); // Sunday
  });

  it('is closed through the nightly gap on a weekday', () => {
    // Wednesday 2026-09-16, UTC+3: server 23:59 to 01:01 is 20:59 to 22:01 UTC.
    expect(isMarketOpenXauusd(utc(2026, 9, 16, 20, 59))).toBe(false);
    expect(isMarketOpenXauusd(utc(2026, 9, 16, 21, 30))).toBe(false);
    expect(isMarketOpenXauusd(utc(2026, 9, 16, 22, 1))).toBe(true);
  });

  it('exposes the rule in server minutes', () => {
    expect(MARKET_OPEN_SERVER_MINUTE).toBe(1 * 60 + 1);
    expect(MARKET_CLOSE_SERVER_MINUTE).toBe(23 * 60 + 59);
  });
});

describe('daylight saving (2nd Sunday of March to 1st Sunday of November)', () => {
  it('2026 starts on 8 March and ends on 1 November, 00:00 UTC', () => {
    expect(isDstActive(utc(2026, 3, 7, 23, 59, 59))).toBe(false);
    expect(isDstActive(utc(2026, 3, 8, 0, 0, 0))).toBe(true);
    expect(isDstActive(utc(2026, 10, 31, 23, 59, 59))).toBe(true);
    expect(isDstActive(utc(2026, 11, 1, 0, 0, 0))).toBe(false);
  });

  it('puts the server clock at UTC+3 in summer and UTC+2 in winter', () => {
    expect(serverOffsetHours(utc(2026, 7, 1, 12))).toBe(3);
    expect(serverOffsetHours(utc(2026, 1, 1, 12))).toBe(2);
    expect(serverOffsetHours(utc(2026, 12, 31, 12))).toBe(2);
  });
});

describe('invariant: every server weekday has 1,378 open minutes', () => {
  const OPEN_MINUTES_PER_WEEKDAY =
    MARKET_CLOSE_SERVER_MINUTE - MARKET_OPEN_SERVER_MINUTE;

  function openMinutes(fromUtc: number, toUtc: number): number {
    let count = 0;
    for (let ts = fromUtc; ts < toUtc; ts += 60) {
      if (isMarketOpenXauusd(ts)) count += 1;
    }
    return count;
  }

  // Monday 00:00 SERVER time as a UTC instant, then five server days on.
  function mondayToSaturday(
    year: number,
    month: number,
    day: number,
    offsetHours: number
  ): [number, number] {
    const start = utc(year, month, day, 0, 0) - offsetHours * 3600;
    return [start, start + 5 * 86400];
  }

  it.each([
    ['winter', 2026, 1, 5, 2],
    ['the week before the March change', 2026, 3, 2, 2],
    ['the week after the March change', 2026, 3, 9, 3],
    ['midsummer', 2026, 7, 6, 3],
    ['the week before the November change', 2026, 10, 26, 3],
    ['the week after the November change', 2026, 11, 2, 2],
  ])(
    '%s: Monday to Friday open for 5 x 1,378 minutes',
    (_label, year, month, day, offset) => {
      expect(OPEN_MINUTES_PER_WEEKDAY).toBe(1378);
      const [from, to] = mondayToSaturday(year, month, day, offset);
      expect(openMinutes(from, to)).toBe(5 * 1378);
    }
  );

  it('and the two weekend days that follow are closed throughout', () => {
    const [, saturdayStart] = mondayToSaturday(2026, 9, 14, 3);
    expect(openMinutes(saturdayStart, saturdayStart + 2 * 86400)).toBe(0);
  });
});

describe('inputs', () => {
  it('rejects a time that is not finite', () => {
    expect(() => isMarketOpenXauusd(Number.NaN)).toThrow(RangeError);
    expect(() => isMarketOpenXauusd(Number.POSITIVE_INFINITY)).toThrow(
      RangeError
    );
    expect(() => isDstActive(Number.NaN)).toThrow(RangeError);
  });

  it('accepts fractional seconds (Date.now() / 1000)', () => {
    expect(isMarketOpenXauusd(utc(2026, 9, 16, 12, 0) + 0.5)).toBe(true);
  });
});
