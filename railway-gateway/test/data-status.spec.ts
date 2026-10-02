import {
  DATA_STATUSES,
  ReadyCycle,
  computeDataStatus,
  cycleStatus,
} from '../src/cycle/data-status';
import { FRESHNESS_THRESHOLDS } from '../src/cycle/thresholds';
import { readCollectorConstants } from './helpers/collector-constants';

/**
 * Data status (rule 7, ADR-012): FRESH, DELAYED, STALE, MARKET CLOSED.
 *
 * The two statuses that matter most, and are easiest to confuse, are STALE
 * ("data stopped") and MARKET CLOSED ("nobody is trading"). Both look like "no
 * new cycle", and a trader must not be told the feed broke on a Saturday, nor
 * that the market is merely closed when the feed died on a Wednesday. The
 * section 1.8 item "Stale and closed differ" is the first block below.
 *
 * Boundaries are tested exactly, one second either side, because the ADR-012
 * values are starting values that will be tuned: a boundary that is off by one
 * second now is a wrong status for real traders later.
 */

const utc = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0): number =>
  Date.UTC(y, mo - 1, d, h, mi, s) / 1000;

// Wednesday 16 Sep 2026, 12:00 UTC (server 15:00): the market is open all day.
const WED_NOON = utc(2026, 9, 16, 12, 0);
const SATURDAY_NOON = utc(2026, 9, 19, 12, 0);

/** A cycle ready `latency` seconds after its slot, first attempt unless stated. */
const cycle = (slot: number, latency = 40, attempts = 1): ReadyCycle => ({
  slot,
  readyAt: slot + latency,
  attempts,
});

describe('Stale and closed differ (section 1.8)', () => {
  it('feed stopped 15 min → STALE', () => {
    // The last cycle was the 12:00 slot, ready at 12:00:40. Nothing since.
    const last = cycle(WED_NOON);
    const result = computeDataStatus({
      now: WED_NOON + 15 * 60,
      latestReadyCycle: last,
    });
    expect(result.status).toBe('STALE');
    expect(result.dataAsOfSlot).toBe(WED_NOON);
  });

  it('weekend → MARKET CLOSED, even though the same feed is silent', () => {
    // The last cycle was Friday's final slot; the clock is Saturday.
    const fridayLast = cycle(utc(2026, 9, 18, 20, 55));
    const result = computeDataStatus({
      now: SATURDAY_NOON,
      latestReadyCycle: fridayLast,
    });
    expect(result.status).toBe('MARKET_CLOSED');
    expect(result.reason).toBe('MARKET_CLOSED');
    // The reader labels "last session's picture" from this slot.
    expect(result.dataAsOfSlot).toBe(fridayLast.slot);
  });

  it('the identical silent feed is STALE on a Wednesday and CLOSED on a Saturday', () => {
    // Same shape on both days: a cycle for 12:00 ready at 12:00:40, then 15
    // minutes of nothing. Only the market-hours gate differs.
    const silentFor15Min = (noon: number) =>
      computeDataStatus({
        now: noon + 15 * 60,
        latestReadyCycle: cycle(noon),
      });
    expect(silentFor15Min(WED_NOON).status).toBe('STALE');
    expect(silentFor15Min(SATURDAY_NOON).status).toBe('MARKET_CLOSED');
  });

  it('the closed gate wins over a missing or unusable cycle row', () => {
    for (const latestReadyCycle of [
      null,
      { slot: SATURDAY_NOON + 7, readyAt: 0, attempts: 0 },
    ]) {
      const result = computeDataStatus({
        now: SATURDAY_NOON,
        latestReadyCycle,
      });
      expect(result.status).toBe('MARKET_CLOSED');
    }
  });
});

describe('cycleStatus: was the cycle ready in time?', () => {
  const slot = WED_NOON;

  it('first try: FRESH up to and including 2 minutes, DELAYED after', () => {
    expect(cycleStatus({ slot, readyAt: slot + 1, attempts: 1 })).toBe('FRESH');
    expect(cycleStatus({ slot, readyAt: slot + 120, attempts: 1 })).toBe(
      'FRESH'
    );
    expect(cycleStatus({ slot, readyAt: slot + 121, attempts: 1 })).toBe(
      'DELAYED'
    );
  });

  it('after a collector retry: FRESH up to and including 4 minutes, DELAYED after', () => {
    for (const attempts of [2, 3]) {
      expect(cycleStatus({ slot, readyAt: slot + 121, attempts })).toBe(
        'FRESH'
      );
      expect(cycleStatus({ slot, readyAt: slot + 240, attempts })).toBe(
        'FRESH'
      );
      expect(cycleStatus({ slot, readyAt: slot + 241, attempts })).toBe(
        'DELAYED'
      );
    }
  });

  it('reads its deadlines from the thresholds it is given', () => {
    const tight = {
      ...FRESHNESS_THRESHOLDS,
      readyDeadlineSec: 30,
      readyDeadlineWithRetriesSec: 60,
    };
    expect(cycleStatus({ slot, readyAt: slot + 31, attempts: 1 }, tight)).toBe(
      'DELAYED'
    );
    expect(cycleStatus({ slot, readyAt: slot + 60, attempts: 2 }, tight)).toBe(
      'FRESH'
    );
  });

  it('accepts a cycle ready exactly at its slot (zero latency is valid)', () => {
    expect(cycleStatus({ slot, readyAt: slot, attempts: 1 })).toBe('FRESH');
    // And a reader treats such a row as usable, not as a broken one.
    const r = computeDataStatus({
      now: slot + 10,
      latestReadyCycle: { slot, readyAt: slot, attempts: 1 },
    });
    expect(r.status).toBe('FRESH');
    expect(r.reason).toBe('CYCLE_READY_IN_TIME');
  });

  it('refuses a row that cannot be right', () => {
    expect(() =>
      cycleStatus({ slot: slot + 7, readyAt: slot + 100, attempts: 1 })
    ).toThrow(RangeError); // not on a slot boundary
    expect(() => cycleStatus({ slot, readyAt: slot - 1, attempts: 1 })).toThrow(
      RangeError
    ); // ready before its own slot
    for (const attempts of [0, -1, 1.5, Number.NaN]) {
      expect(() => cycleStatus({ slot, readyAt: slot + 10, attempts })).toThrow(
        RangeError
      );
    }
  });
});

describe('computeDataStatus while the market is open', () => {
  const slot = WED_NOON; // the current slot in these cases
  const previous = slot - 300;

  it('the current slot is ready in time → FRESH', () => {
    const r = computeDataStatus({
      now: slot + 90,
      latestReadyCycle: cycle(slot, 40),
    });
    expect(r).toMatchObject({
      status: 'FRESH',
      reason: 'CYCLE_READY_IN_TIME',
      dataAsOfSlot: slot,
      secondsSinceReady: 50,
    });
  });

  it('the current slot was ready late → DELAYED, with the lateness known', () => {
    const r = computeDataStatus({
      now: slot + 200,
      latestReadyCycle: cycle(slot, 150),
    });
    expect(r.status).toBe('DELAYED');
    expect(r.reason).toBe('CYCLE_READY_LATE');
  });

  it('a retried cycle ready inside 4 minutes stays FRESH', () => {
    const r = computeDataStatus({
      now: slot + 250,
      latestReadyCycle: cycle(slot, 230, 2),
    });
    expect(r.status).toBe('FRESH');
  });

  describe('the current slot has no ready cycle yet', () => {
    const last = cycle(previous, 40); // the previous slot is the newest

    it('is FRESH while inside the ready deadline, including the deadline itself', () => {
      for (const elapsed of [0, 30, 119, 120]) {
        const r = computeDataStatus({
          now: slot + elapsed,
          latestReadyCycle: last,
        });
        expect(r.status).toBe('FRESH');
        expect(r.reason).toBe('AWAITING_CURRENT_CYCLE');
      }
    });

    it('turns DELAYED one second after the deadline', () => {
      const r = computeDataStatus({
        now: slot + 121,
        latestReadyCycle: last,
      });
      expect(r.status).toBe('DELAYED');
      expect(r.reason).toBe('CURRENT_CYCLE_OVERDUE');
    });

    it('a whole slot was missed → DELAYED straight away, not FRESH', () => {
      const missed = cycle(slot - 600, 60); // two slots back
      const r = computeDataStatus({ now: slot + 30, latestReadyCycle: missed });
      expect(r.status).toBe('DELAYED');
      expect(r.reason).toBe('CYCLE_MISSED');
    });

    it('turns STALE exactly when 10 minutes have passed since the last ready cycle', () => {
      const missed = cycle(slot - 600, 60); // ready at slot - 540
      const readyAt = missed.readyAt;
      const justBefore = computeDataStatus({
        now: readyAt + 599,
        latestReadyCycle: missed,
      });
      const exactly = computeDataStatus({
        now: readyAt + 600,
        latestReadyCycle: missed,
      });
      expect(justBefore.status).toBe('DELAYED');
      expect(exactly.status).toBe('STALE');
      expect(exactly.reason).toBe('NO_READY_CYCLE_WITHIN_STALE_WINDOW');
    });
  });

  it('no ready cycle at all → STALE', () => {
    const r = computeDataStatus({ now: slot + 30, latestReadyCycle: null });
    expect(r).toMatchObject({
      status: 'STALE',
      reason: 'NO_READY_CYCLE',
      dataAsOfSlot: null,
      secondsSinceReady: null,
    });
  });

  it('an unusable row fails closed to STALE, never to FRESH', () => {
    const r = computeDataStatus({
      now: slot + 30,
      latestReadyCycle: { slot: slot + 7, readyAt: slot + 9, attempts: 1 },
    });
    expect(r.status).toBe('STALE');
    expect(r.reason).toBe('INVALID_CYCLE_ROW');
    expect(r.dataAsOfSlot).toBeNull();
  });

  it('never reports a negative age when the reader clock is behind', () => {
    const r = computeDataStatus({
      now: slot + 10,
      latestReadyCycle: cycle(slot, 40),
    });
    expect(r.secondsSinceReady).toBe(0);
  });

  it('rejects a clock that is not a finite time', () => {
    expect(() =>
      computeDataStatus({ now: Number.NaN, latestReadyCycle: null })
    ).toThrow(RangeError);
  });
});

describe('a feed that runs and then stops (every second of the transition)', () => {
  // Cycles for every slot from 12:00 to 12:25, each ready 40 s after its slot.
  // The 12:30 cycle never arrives.
  const lastSlot = WED_NOON + 25 * 60; // 12:25
  const last = cycle(lastSlot, 40); // ready 12:25:40

  it('stays FRESH every second while the feed is healthy', () => {
    // A healthy feed: the cycle for slot S is ready at S + 40, and until then
    // the previous slot's cycle is the newest one.
    const newestAt = (now: number): ReadyCycle => {
      const slot = Math.floor(now / 300) * 300;
      return now >= slot + 40 ? cycle(slot, 40) : cycle(slot - 300, 40);
    };
    let evaluated = 0;
    for (let now = WED_NOON + 300; now < lastSlot + 300; now += 1) {
      const r = computeDataStatus({ now, latestReadyCycle: newestAt(now) });
      if (r.status !== 'FRESH') {
        throw new Error(
          `${new Date(now * 1000).toISOString()}: expected FRESH, got ${r.status} (${r.reason})`
        );
      }
      evaluated += 1;
    }
    expect(evaluated).toBe(25 * 60); // 12:05:00 to 12:29:59
  });

  it('goes FRESH → DELAYED → STALE at the documented seconds', () => {
    const at = (offsetFromLastSlot: number) =>
      computeDataStatus({
        now: lastSlot + offsetFromLastSlot,
        latestReadyCycle: last,
      }).status;

    expect(at(299)).toBe('FRESH'); // still the 12:25 slot's own cycle
    expect(at(300)).toBe('FRESH'); // 12:30:00, awaiting the 12:30 cycle
    expect(at(420)).toBe('FRESH'); // 12:32:00, exactly on the deadline
    expect(at(421)).toBe('DELAYED'); // 12:32:01
    // 12:25:40 + 600 s = 12:35:40 is the STALE moment.
    expect(at(40 + 599)).toBe('DELAYED');
    expect(at(40 + 600)).toBe('STALE');
    expect(at(15 * 60)).toBe('STALE');
    expect(at(40 * 60)).toBe('STALE'); // and it stays STALE
  });
});

describe('just after the market reopens', () => {
  // UTC+3 in September: the market reopens Monday 01:01 server = Sunday 22:01 UTC.
  const fridayLast = cycle(utc(2026, 9, 18, 20, 55)); // last slot before the close
  const reopenFirstSlot = utc(2026, 9, 20, 22, 5); // 01:05 server

  it('reports STALE until the first cycle of the new session is ready', () => {
    const before = computeDataStatus({
      now: utc(2026, 9, 20, 22, 3),
      latestReadyCycle: fridayLast,
    });
    expect(before.status).toBe('STALE');
    expect(before.dataAsOfSlot).toBe(fridayLast.slot);

    const after = computeDataStatus({
      now: reopenFirstSlot + 60,
      latestReadyCycle: cycle(reopenFirstSlot, 40),
    });
    expect(after.status).toBe('FRESH');
  });

  it('is MARKET CLOSED right up to the reopening minute', () => {
    const closed = computeDataStatus({
      now: utc(2026, 9, 20, 22, 0, 59),
      latestReadyCycle: fridayLast,
    });
    expect(closed.status).toBe('MARKET_CLOSED');
  });
});

describe('thresholds (ADR-012 starting values)', () => {
  it('are 2 minutes, 4 minutes with retries, and 10 minutes to STALE', () => {
    expect(FRESHNESS_THRESHOLDS).toEqual({
      readyDeadlineSec: 120,
      readyDeadlineWithRetriesSec: 240,
      staleAfterSec: 600,
    });
  });

  it('cannot be changed at run time', () => {
    expect(Object.isFrozen(FRESHNESS_THRESHOLDS)).toBe(true);
  });

  it('there are exactly the four statuses of rule 7', () => {
    expect([...DATA_STATUSES]).toEqual([
      'FRESH',
      'DELAYED',
      'STALE',
      'MARKET_CLOSED',
    ]);
  });

  it('STALE matches the VPS stale-export guard (2 bars x 300 s)', () => {
    const collector = readCollectorConstants();
    expect(FRESHNESS_THRESHOLDS.staleAfterSec).toBe(
      collector.maxBarLagMultiplier * collector.tfSecondsM5
    );
  });

  it('the retry deadline leaves room for every collector attempt', () => {
    // The collector starts 5 s after the slot and retries every 65 s, up to 3
    // attempts, so the last attempt begins about 5 + 2 x 65 s after the slot.
    // The "with retries" deadline must still be later than that, or a cycle
    // that succeeded on its final attempt would always read DELAYED.
    const collector = readCollectorConstants();
    const lastAttemptStarts =
      5 + (collector.maxAttemptsPerCycle - 1) * collector.retryWaitSec;
    expect(FRESHNESS_THRESHOLDS.readyDeadlineWithRetriesSec).toBeGreaterThan(
      lastAttemptStarts
    );
  });
});
