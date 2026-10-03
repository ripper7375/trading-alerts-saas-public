import {
  CHANNEL_LENGTH_FIELDS,
  M15_COVER_MARGIN_BARS,
  channelLength,
  closedBarsToSupply,
} from '../src/sensors/inputs/closed-channel';
import { MAX_CLOSED_BARS_PER_READ } from '../src/cycle/read/read-types';
import { ONE_DAY_CLOSED_BARS } from '../src/cycle/windows';

/**
 * How many closed bars the loader hands over (ADR-083): the whole closed channel, no
 * window arithmetic. The windows themselves (MCD2 `min(T_EDT - 1, 288)`, MCD1
 * `N_micro`, MCD3 `T_EDT - 1`) are in the evaluators and are exercised by the gated
 * parity spec at their boundaries.
 */

describe('channelLength: the largest of containment_n, visual_window_bars, window_bars', () => {
  it('lists the three fields in the evaluators’ order (T_EDT_FIELDS)', () => {
    expect([...CHANNEL_LENGTH_FIELDS]).toEqual([
      'containment_n',
      'visual_window_bars',
      'window_bars',
    ]);
  });

  it.each([
    [{ containment_n: 755, visual_window_bars: 755, window_bars: 545 }, 755],
    [{ containment_n: 500, visual_window_bars: 500, window_bars: 900 }, 900],
    [{ containment_n: null, visual_window_bars: 323, window_bars: 305 }, 323],
    [{ containment_n: null, visual_window_bars: null, window_bars: 305 }, 305],
    [{ containment_n: 336.9 }, 336],
    [{ containment_n: 1 }, 1],
  ])('%p is %p', (row, expected) => {
    expect(channelLength(row)).toBe(expected);
  });

  it.each([
    [{}],
    [{ containment_n: null, visual_window_bars: null, window_bars: null }],
    [{ containment_n: 0 }],
    [{ containment_n: -5 }],
    [{ containment_n: 'many' }],
    [{ containment_n: NaN }],
    [{ containment_n: true }],
    [undefined],
    [null],
  ])('%p holds none', (row) => {
    expect(channelLength(row as never)).toBeNull();
  });
});

describe('closedBarsToSupply', () => {
  const row = (length: number) => ({ containment_n: length });

  it('asks for the channel’s length, not the length minus the open bar row (that subtraction is the evaluators’)', () => {
    // v1: the M5 channel has 755 rows, the last of them the forming bar
    expect(closedBarsToSupply({ M5: row(755), M15: row(1808) })).toEqual({
      M5: 755,
      M15: 1808,
    });
  });

  it('caps each timeframe at what one read can ask for (3,000, the export window)', () => {
    expect(MAX_CLOSED_BARS_PER_READ).toBe(3000);
    expect(closedBarsToSupply({ M5: row(100001), M15: row(5000) })).toEqual({
      M5: 3000,
      M15: 3000,
    });
  });

  it('with no channel length it sends one day, which is what the evaluators fall back to', () => {
    expect(ONE_DAY_CLOSED_BARS).toEqual({ M5: 288, M15: 96 });
    expect(closedBarsToSupply({})).toEqual({ M5: 288, M15: 96 });
    expect(closedBarsToSupply({ M5: undefined, M15: {} })).toEqual({
      M5: 288,
      M15: 96,
    });
  });

  it('is per timeframe: a missing M15 row does not change the M5 count', () => {
    expect(closedBarsToSupply({ M5: row(1038) }).M5).toBe(1038);
    expect(closedBarsToSupply({ M15: row(500) }).M15).toBe(500);
  });

  describe('MCD3 needs a closed M15 bar at or before the first bar of the M5 channel window', () => {
    it('a short M15 channel next to a long M5 one gets enough M15 bars to cover it in time', () => {
      // 3,000 M5 bars are 1,000 M15 bars; M15 own channel 500 would leave MCD3 INSUFFICIENT_BARS
      const out = closedBarsToSupply({ M5: row(3000), M15: row(500) });
      expect(out.M5).toBe(3000);
      expect(out.M15).toBe(1000 + M15_COVER_MARGIN_BARS);
    });

    it('is the larger of the two: a long M15 channel is left as it is', () => {
      expect(closedBarsToSupply({ M5: row(1038), M15: row(1529) }).M15).toBe(
        1529
      );
    });

    it('rounds up (755 M5 bars span 251.67 M15 bars)', () => {
      expect(closedBarsToSupply({ M5: row(755), M15: row(10) }).M15).toBe(
        252 + M15_COVER_MARGIN_BARS
      );
    });

    it('does not apply without an M5 channel length, and never changes M5', () => {
      expect(closedBarsToSupply({ M15: row(10) }).M15).toBe(10);
      expect(closedBarsToSupply({ M5: row(100), M15: row(5000) }).M5).toBe(100);
    });

    it('the margin is two bars', () => {
      expect(M15_COVER_MARGIN_BARS).toBe(2);
    });
  });

  it('a one-bar channel asks for one M5 bar, and for the M15 bar that covers it plus the margin', () => {
    expect(closedBarsToSupply({ M5: row(1), M15: row(1) })).toEqual({
      M5: 1,
      M15: 1 + M15_COVER_MARGIN_BARS,
    });
  });
});
