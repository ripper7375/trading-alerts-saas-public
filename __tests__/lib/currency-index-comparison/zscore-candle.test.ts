import { describe, it, expect } from '@jest/globals';

import {
  isHighlightedZScoreClass,
  zscoreBarsNeeded,
  zscoreCandleClasses,
} from '@/lib/currency-index-comparison/zscore-candle';
import type { IndexCandle } from '@/lib/currency-index-comparison/series';

/** Candles from signed bodies: positive = bullish (close > open). */
function fromBodies(bodies: number[]): IndexCandle[] {
  return bodies.map((b, i) => ({
    time: 1_800_000_000 + i * 300,
    open: 100,
    high: 100 + Math.max(b, 0) + 0.1,
    low: 100 + Math.min(b, 0) - 0.1,
    close: 100 + b,
  }));
}

describe('zscoreCandleClasses', () => {
  it('classifies nothing with fewer candles than the length (MQL5: rates_total < InpZScoreLength)', () => {
    expect(
      zscoreCandleClasses(fromBodies([1, 1]), {
        length: 3,
        thresholdZ1: 1,
        thresholdZ2: 2,
      })
    ).toEqual([null, null]);
  });

  it('starts at bar `length`, as OnCalculate() does -- one bar later than zscore_candle.py', () => {
    const classes = zscoreCandleClasses(fromBodies([1, 1, 1, 4]), {
      length: 3,
      thresholdZ1: 1,
      thresholdZ2: 2,
    });
    expect(classes.slice(0, 3)).toEqual([null, null, null]);
    expect(classes[3]).not.toBeNull();
  });

  it('uses a sample z-score over the length bars ending at the bar, thresholds inclusive', () => {
    // Window bodies 4, 1, 1: mean 2, sample variance 3, z = 2 / sqrt(3) = 1.1547.
    const candles = fromBodies([9, 1, 1, 4]);
    const z = 2 / Math.sqrt(3);
    const at = (z1: number, z2: number) =>
      zscoreCandleClasses(candles, {
        length: 3,
        thresholdZ1: z1,
        thresholdZ2: z2,
      })[3];

    expect(at(1.1, 2)).toBe('up-large');
    expect(at(1.2, 2)).toBe('up-normal');
    expect(at(1, z)).toBe('up-extreme');
    // Bar 0's body of 9 is outside bar 3's window, so it changes nothing.
    expect(
      zscoreCandleClasses(fromBodies([0, 1, 1, 4]), {
        length: 3,
        thresholdZ1: 1.1,
        thresholdZ2: 2,
      })[3]
    ).toBe('up-large');
  });

  it('classifies bearish candles 3/4/5 and a doji (close == open) as bullish', () => {
    const params = { length: 3, thresholdZ1: 1.1, thresholdZ2: 5 };
    expect(zscoreCandleClasses(fromBodies([1, 1, 1, -4]), params)[3]).toBe(
      'down-large'
    );
    expect(zscoreCandleClasses(fromBodies([1, 1, 1, 0]), params)[3]).toBe(
      'up-normal'
    );
  });

  it('gives Normal for a zero stddev', () => {
    const classes = zscoreCandleClasses(fromBodies([2, 2, 2, 2, -2]), {
      length: 3,
      thresholdZ1: 0.1,
      thresholdZ2: 0.2,
    });
    expect(classes.slice(3)).toEqual(['up-normal', 'down-normal']);
  });

  it('tests Extreme first, so a second threshold below the first leaves Large empty', () => {
    const classes = zscoreCandleClasses(fromBodies([1, 1, 1, 4]), {
      length: 3,
      thresholdZ1: 1.1,
      thresholdZ2: 0.5,
    });
    expect(classes[3]).toBe('up-extreme');
  });
});

describe('helpers', () => {
  it('needs length + 1 candles for the first class', () => {
    expect(zscoreBarsNeeded(54)).toBe(55);
  });

  it('highlights only Large and Extreme', () => {
    expect(isHighlightedZScoreClass('up-large')).toBe(true);
    expect(isHighlightedZScoreClass('down-extreme')).toBe(true);
    expect(isHighlightedZScoreClass('up-normal')).toBe(false);
    expect(isHighlightedZScoreClass('down-normal')).toBe(false);
    expect(isHighlightedZScoreClass(null)).toBe(false);
  });
});
