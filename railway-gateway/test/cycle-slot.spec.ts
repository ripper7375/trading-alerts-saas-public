import {
  SLOT_SECONDS,
  TIMEFRAMES,
  TIMEFRAME_SECONDS,
  Timeframe,
  formingBarOpen,
  isClosedBar,
  isRefreshSlot,
  isSlot,
  isTimeframe,
  lastClosedBarOpen,
  lastCollectedSlot,
  slotOf,
} from '../src/cycle/slot';
import { TIMEFRAME_SECONDS as WORKER_TIMEFRAME_SECONDS } from '../src/worker/point-in-time-snapshot';
import { readCollectorConstants } from './helpers/collector-constants';

/**
 * Slot and closed-bar arithmetic: rules 1, 2, 3 and 5 of
 * STACK-D-ARCHITECTURE.md section 1.3.
 *
 * The anchor is the document's own worked example (section 1.5, the 20:55
 * slot): at 20:55 the M5 bars are closed up to the one opened 20:50, and the M15
 * bars up to the one opened 20:30, because the 20:45 M15 bar is still open.
 * Everything else is shaped around the ways this arithmetic can be wrong without
 * anything failing: an off-by-one at the closing boundary, and a raw timestamp
 * passed where a slot belongs.
 */

const utc = (h: number, m: number, s = 0): number =>
  Date.UTC(2026, 8, 18, h, m, s) / 1000; // 18 Sep 2026, the example cycle's day

const SLOT_2055 = utc(20, 55);

describe('slotOf and isSlot (rule 1)', () => {
  it('rounds down to the 5-minute boundary', () => {
    expect(slotOf(utc(20, 55, 0))).toBe(SLOT_2055);
    expect(slotOf(utc(20, 55, 5))).toBe(SLOT_2055); // the collector reads at :05
    expect(slotOf(utc(20, 59, 59))).toBe(SLOT_2055);
    expect(slotOf(utc(21, 0, 0))).toBe(utc(21, 0));
  });

  it('keeps fractional seconds inside their slot', () => {
    expect(slotOf(SLOT_2055 + 299.999)).toBe(SLOT_2055);
  });

  it('knows which moments are slot boundaries', () => {
    expect(isSlot(SLOT_2055)).toBe(true);
    expect(isSlot(SLOT_2055 + 1)).toBe(false);
    expect(isSlot(SLOT_2055 + 299)).toBe(false);
    expect(isSlot(Number.NaN)).toBe(false);
    expect(isSlot(-300)).toBe(false);
  });

  it('rejects a time that is not a finite unix time', () => {
    expect(() => slotOf(Number.NaN)).toThrow(RangeError);
    expect(() => slotOf(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => slotOf(-1)).toThrow(RangeError);
  });
});

describe('closed bar (rule 2) at the 20:55 slot', () => {
  it('M5: the 20:50 bar is closed and the 20:55 bar is not', () => {
    expect(isClosedBar(utc(20, 50), 'M5', SLOT_2055)).toBe(true);
    expect(isClosedBar(utc(20, 55), 'M5', SLOT_2055)).toBe(false);
    expect(isClosedBar(utc(20, 45), 'M5', SLOT_2055)).toBe(true);
  });

  it('M15: closed up to the 20:30 bar; the 20:45 bar is still open', () => {
    expect(isClosedBar(utc(20, 30), 'M15', SLOT_2055)).toBe(true);
    expect(isClosedBar(utc(20, 45), 'M15', SLOT_2055)).toBe(false);
  });

  it('is exact at the closing boundary: open + period equal to the slot is closed', () => {
    // 20:50 + 5 min == 20:55 exactly. One second later it would not be.
    expect(isClosedBar(SLOT_2055 - 300, 'M5', SLOT_2055)).toBe(true);
    expect(isClosedBar(SLOT_2055 - 300 + 1, 'M5', SLOT_2055)).toBe(false);
    expect(isClosedBar(SLOT_2055 - 900, 'M15', SLOT_2055)).toBe(true);
    expect(isClosedBar(SLOT_2055 - 900 + 1, 'M15', SLOT_2055)).toBe(false);
  });

  it('M15 flips to closed exactly on the quarter-hour slot', () => {
    // The 20:45 bar closes at the 21:00 slot, not before.
    expect(isClosedBar(utc(20, 45), 'M15', utc(20, 55))).toBe(false);
    expect(isClosedBar(utc(20, 45), 'M15', utc(21, 0))).toBe(true);
  });
});

describe('forming bar (rule 3) and newest closed bar', () => {
  it('matches the section 1.5 table at the 20:55 slot', () => {
    expect(formingBarOpen('M5', SLOT_2055)).toBe(utc(20, 55));
    expect(lastClosedBarOpen('M5', SLOT_2055)).toBe(utc(20, 50));
    expect(formingBarOpen('M15', SLOT_2055)).toBe(utc(20, 45));
    expect(lastClosedBarOpen('M15', SLOT_2055)).toBe(utc(20, 30));
  });

  it('the M15 part refreshes at :00 :15 :30 :45', () => {
    expect(lastClosedBarOpen('M15', utc(21, 0))).toBe(utc(20, 45));
    expect(lastClosedBarOpen('M15', utc(21, 5))).toBe(utc(20, 45));
    expect(lastClosedBarOpen('M15', utc(21, 10))).toBe(utc(20, 45));
    expect(lastClosedBarOpen('M15', utc(21, 15))).toBe(utc(21, 0));
  });

  it.each(TIMEFRAMES)(
    '%s: across a whole day of slots the newest closed bar is closed and the forming bar is not',
    (timeframe: Timeframe) => {
      const period = TIMEFRAME_SECONDS[timeframe];
      const dayStart = utc(0, 0);
      let checked = 0;
      for (let slot = dayStart; slot < dayStart + 86400; slot += SLOT_SECONDS) {
        const newestClosed = lastClosedBarOpen(timeframe, slot);
        const forming = formingBarOpen(timeframe, slot);
        expect(isClosedBar(newestClosed, timeframe, slot)).toBe(true);
        expect(isClosedBar(forming, timeframe, slot)).toBe(false);
        expect(forming - newestClosed).toBe(period);
        expect(forming <= slot && slot < forming + period).toBe(true);
        checked += 1;
      }
      expect(checked).toBe(288);
    }
  );
});

describe('statistics slot (rule 5): where a timeframe was last collected', () => {
  it('M5 is collected on every slot', () => {
    expect(lastCollectedSlot('M5', SLOT_2055)).toBe(SLOT_2055);
    expect(isRefreshSlot('M5', SLOT_2055)).toBe(true);
  });

  it('M15 at the 20:55 slot was last collected at the 20:45 slot', () => {
    expect(lastCollectedSlot('M15', SLOT_2055)).toBe(utc(20, 45));
    expect(isRefreshSlot('M15', SLOT_2055)).toBe(false);
  });

  it('M15 refreshes only on the quarter hours', () => {
    const refreshing = [];
    for (let m = 0; m < 60; m += 5) {
      if (isRefreshSlot('M15', utc(21, m))) refreshing.push(m);
    }
    expect(refreshing).toEqual([0, 15, 30, 45]);
  });
});

describe('strict inputs: a slot that is not a slot is a bug, not a window', () => {
  it('rejects a raw timestamp where a slot belongs', () => {
    const notASlot = SLOT_2055 + 5;
    expect(() => isClosedBar(utc(20, 50), 'M5', notASlot)).toThrow(RangeError);
    expect(() => formingBarOpen('M5', notASlot)).toThrow(RangeError);
    expect(() => lastClosedBarOpen('M15', notASlot)).toThrow(RangeError);
    expect(() => lastCollectedSlot('M15', notASlot)).toThrow(RangeError);
  });

  it('rejects an unsupported timeframe, including inherited object keys', () => {
    for (const bad of ['M1', 'H1', 'm5', 'toString', '']) {
      expect(isTimeframe(bad)).toBe(false);
      expect(() => formingBarOpen(bad as Timeframe, SLOT_2055)).toThrow(
        RangeError
      );
    }
    expect(isTimeframe('M5')).toBe(true);
    expect(isTimeframe('M15')).toBe(true);
    expect(isTimeframe(undefined)).toBe(false);
  });
});

describe('agreement with the rest of the pipeline', () => {
  it('uses the same bar lengths as the point-in-time snapshot lane', () => {
    expect({ ...TIMEFRAME_SECONDS }).toEqual({ ...WORKER_TIMEFRAME_SECONDS });
  });

  it('uses the same slot and bar lengths as the VPS collector', () => {
    const collector = readCollectorConstants();
    expect(SLOT_SECONDS).toBe(collector.cycleIntervalSec);
    expect(TIMEFRAME_SECONDS.M5).toBe(collector.tfSecondsM5);
    expect(TIMEFRAME_SECONDS.M15).toBe(collector.tfSecondsM15);
  });
});
