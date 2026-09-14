import { describe, it, expect } from '@jest/globals';

import {
  classifyZigZagSegments,
  detectZigZagPivots,
  zigzagPctChangeClass,
  zigzagSegmentStarts,
  type ZigZagPivot,
} from '@/lib/currency-index-comparison/zigzag';
import type { IndexCandle } from '@/lib/currency-index-comparison/series';

function bars(hl: [number, number][]): IndexCandle[] {
  return hl.map(([high, low], i) => ({
    time: 1_800_000_000 + i * 300,
    open: (high + low) / 2,
    high,
    low,
    close: (high + low) / 2,
  }));
}

function pivotsFromPrices(prices: number[]): ZigZagPivot[] {
  return prices.map((price, i) => ({
    index: i * 10,
    time: 1_800_000_000 + i * 3000,
    price,
    isPeak: i % 2 === 1,
  }));
}

describe('detectZigZagPivots', () => {
  it('returns nothing with fewer candles than depth (MQL5: rates_total < xInpDepth)', () => {
    expect(
      detectZigZagPivots(
        bars([
          [10, 9],
          [11, 10],
        ]),
        3
      )
    ).toEqual([]);
  });

  it('returns nothing for a depth below 2 (OnInit rejects it)', () => {
    expect(
      detectZigZagPivots(
        bars([
          [10, 9],
          [11, 10],
          [12, 11],
        ]),
        1
      )
    ).toEqual([]);
  });

  it('follows FindExtremes(): pivots on map bars, a lower low moves the bottom, a higher high moves the peak', () => {
    // depth 3. Walked by hand against CalculateHighLowMaps()/FindExtremes():
    // bar 2 first high map -> peak; bar 4 low map -> bottom; bar 5 lower low
    // moves it; bar 6 high map -> peak; bar 7 higher high moves it; bar 9 low
    // map -> bottom.
    const candles = bars([
      [10, 9],
      [11, 10],
      [12, 11],
      [11.5, 10.5],
      [11, 9.5],
      [10, 8.5],
      [13, 9],
      [14, 12],
      [13, 10],
      [12, 8],
    ]);
    expect(
      detectZigZagPivots(candles, 3).map((p) => [p.index, p.isPeak, p.price])
    ).toEqual([
      [2, true, 12],
      [5, false, 8.5],
      [7, true, 14],
      [9, false, 8],
    ]);
  });

  it('prefers the peak when both maps fire on one bar', () => {
    const pivots = detectZigZagPivots(
      bars([
        [10, 9],
        [11, 8],
      ]),
      2
    );
    expect(pivots).toEqual([
      { index: 1, time: 1_800_000_300, price: 11, isPeak: true },
    ]);
  });

  it('is shift-equivariant, so the page can rebase its output', () => {
    const candles = bars([
      [10, 9],
      [12, 11],
      [11, 9.5],
      [10, 8.5],
      [14, 12],
      [12, 8],
    ]);
    const shifted = candles.map((c) => ({
      ...c,
      high: c.high + 7,
      low: c.low + 7,
    }));
    expect(
      detectZigZagPivots(shifted, 3).map((p) => [p.index, p.price - 7])
    ).toEqual(detectZigZagPivots(candles, 3).map((p) => [p.index, p.price]));
  });
});

describe('zigzagPctChangeClass', () => {
  it('includes the segment itself in its population, as the MQL5 loop does', () => {
    // |%chg| = 1, 0.990099.., 1, 0.990099.., 10. With the current segment in a
    // population of 5, z can never exceed (n - 1) / sqrt(n) = 1.789, so this
    // is Large (code 1), not Extreme -- it would be Extreme if excluded.
    const pivots = pivotsFromPrices([100, 101, 100, 101, 100, 110]);
    const values = [1, 1 / 1.01, 1, 1 / 1.01, 10];
    const mean = values.reduce((s, v) => s + v, 0) / 5;
    const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / 4);
    expect((10 - mean) / std).toBeCloseTo(1.7889, 3);
    expect(zigzagPctChangeClass(pivots, 5, 10)).toBe(1);
  });

  it('returns the bullish codes 0/1/2 and bearish codes 3/4/5', () => {
    const calm = Array.from({ length: 21 }, (_, i) => (i % 2 ? 101 : 100));
    const up = pivotsFromPrices([...calm, 120]);
    const down = pivotsFromPrices([...calm, 80]);
    expect(zigzagPctChangeClass(up, 21, 20)).toBe(2);
    expect(zigzagPctChangeClass(down, 21, -20)).toBe(5);
    expect(zigzagPctChangeClass(up, 20, -1 / 1.01)).toBe(3);
  });

  it('caps the population at the trailing zscoreLength segments', () => {
    // The same +20% move is Extreme against 21 calm segments, but a
    // population of 3 caps z at (3 - 1) / sqrt(3) = 1.155, below Large.
    const calm = Array.from({ length: 21 }, (_, i) => (i % 2 ? 101 : 100));
    const pivots = pivotsFromPrices([...calm, 120]);
    expect(zigzagPctChangeClass(pivots, 21, 20)).toBe(2);
    expect(zigzagPctChangeClass(pivots, 21, 20, 3)).toBe(0);
  });
});

describe('classifyZigZagSegments', () => {
  it('has no class for the first pivot and classifies each incoming segment', () => {
    const calm = Array.from({ length: 21 }, (_, i) => (i % 2 ? 101 : 100));
    const classes = classifyZigZagSegments(pivotsFromPrices([...calm, 120]));
    expect(classes[0]).toBeNull();
    expect(classes[21]).toBe('extreme');
    expect(classes.slice(1, 21).every((c) => c === 'normal')).toBe(true);
  });
});

describe('zigzagSegmentStarts', () => {
  it('marks the START of each segment, since a chart line segment takes its start point color', () => {
    const classes = [null, 'normal', 'extreme', 'large', 'extreme'] as const;
    expect(zigzagSegmentStarts(classes, 'extreme')).toEqual([
      false,
      true,
      false,
      true,
      false,
    ]);
    expect(zigzagSegmentStarts(classes, 'normal')).toEqual([
      true,
      false,
      false,
      false,
      false,
    ]);
  });
});
