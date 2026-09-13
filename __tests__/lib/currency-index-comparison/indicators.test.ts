import { describe, it, expect } from '@jest/globals';

import {
  heikinAshi,
  hrmaSeries,
  shiftCandle,
  smmaSeries,
  typicalPrice,
} from '@/lib/currency-index-comparison/indicators';
import { computeHrma } from '@/lib/currency-index-pro/math';
import type { IndexCandle } from '@/lib/currency-index-comparison/series';

function candles(n: number): IndexCandle[] {
  return Array.from({ length: n }, (_, i) => {
    const close = 100 + Math.sin(i / 3) * 0.8;
    const open = 100 + Math.sin((i - 1) / 3) * 0.8;
    return {
      time: 1_800_000_000 + i * 300,
      open,
      high: Math.max(open, close) + 0.15,
      low: Math.min(open, close) - 0.1,
      close,
    };
  });
}

describe('typicalPrice', () => {
  it('is PRICE_TYPICAL: (high + low + close) / 3', () => {
    expect(
      typicalPrice({ time: 0, open: 1, high: 102, low: 99, close: 102 })
    ).toBeCloseTo(101, 12);
  });
});

describe('hrmaSeries', () => {
  it('draws nothing with fewer candles than the period (MQL5: rates_total < len_hrma -> return 0)', () => {
    expect(hrmaSeries(candles(35), 36)).toEqual([]);
  });

  it('is computeHrma on TYPICAL price, one point per candle', () => {
    const cs = candles(60);
    const out = hrmaSeries(cs, 36);
    const expected = computeHrma(cs.map(typicalPrice), 36);
    expect(out).toHaveLength(60);
    out.forEach((p, i) => {
      expect(p.time).toBe(cs[i]!.time);
      expect(p.value).toBeCloseTo(expected[i]!, 12);
    });
  });
});

describe('smmaSeries', () => {
  it('is on CLOSE, seeded with the plain average of the first N closes, and omits points before the seed', () => {
    const cs = candles(20);
    const out = smmaSeries(cs, 13);
    const seed = cs.slice(0, 13).reduce((s, c) => s + c.close, 0) / 13;

    expect(out).toHaveLength(20 - 12);
    expect(out[0]!.time).toBe(cs[12]!.time);
    expect(out[0]!.value).toBeCloseTo(seed, 12);
    expect(out[1]!.value).toBeCloseTo((seed * 12 + cs[13]!.close) / 13, 12);
  });
});

describe('heikinAshi', () => {
  it('matches *_H1_HA Candles.mq5 by hand for three candles', () => {
    const cs: IndexCandle[] = [
      { time: 1, open: 100, high: 101, low: 99, close: 100.5 },
      { time: 2, open: 100.5, high: 102, low: 100, close: 101.5 },
      { time: 3, open: 101.5, high: 101.6, low: 100.2, close: 100.4 },
    ];
    const ha = heikinAshi(cs);

    // Bar 0: ha_open seeds from the real open.
    const c0 = (100 + 101 + 99 + 100.5) / 4;
    expect(ha[0]).toEqual({
      time: 1,
      open: 100,
      high: Math.max(101, 100, c0),
      low: Math.min(99, 100, c0),
      close: c0,
    });

    const o1 = (100 + c0) / 2;
    const c1 = (100.5 + 102 + 100 + 101.5) / 4;
    expect(ha[1]!.open).toBeCloseTo(o1, 12);
    expect(ha[1]!.close).toBeCloseTo(c1, 12);

    const o2 = (o1 + c1) / 2;
    const c2 = (101.5 + 101.6 + 100.2 + 100.4) / 4;
    expect(ha[2]!.open).toBeCloseTo(o2, 12);
    expect(ha[2]!.high).toBeCloseTo(Math.max(101.6, o2, c2), 12);
    expect(ha[2]!.low).toBeCloseTo(Math.min(100.2, o2, c2), 12);
  });
});

describe('display rebase shift', () => {
  // The page shifts AFTER computing indicators instead of recomputing them on
  // shifted candles. That is only valid because all three are equivariant
  // under a constant shift -- pinned here so a future indicator that is not
  // (e.g. a percentage-based one) cannot be added without noticing.
  const cs = candles(50);
  const offset = 17;
  const shifted = cs.map((c) => shiftCandle(c, offset));

  it('HRMA of shifted candles == HRMA shifted', () => {
    const a = hrmaSeries(shifted, 20);
    const b = hrmaSeries(cs, 20);
    a.forEach((p, i) => expect(p.value).toBeCloseTo(b[i]!.value + offset, 9));
  });

  it('SMMA of shifted candles == SMMA shifted', () => {
    const a = smmaSeries(shifted, 13);
    const b = smmaSeries(cs, 13);
    a.forEach((p, i) => expect(p.value).toBeCloseTo(b[i]!.value + offset, 9));
  });

  it('Heiken Ashi of shifted candles == Heiken Ashi shifted', () => {
    const a = heikinAshi(shifted);
    const b = heikinAshi(cs).map((c) => shiftCandle(c, offset));
    a.forEach((c, i) => {
      expect(c.open).toBeCloseTo(b[i]!.open, 9);
      expect(c.high).toBeCloseTo(b[i]!.high, 9);
      expect(c.low).toBeCloseTo(b[i]!.low, 9);
      expect(c.close).toBeCloseTo(b[i]!.close, 9);
    });
  });

  it('a zero shift returns the same object', () => {
    expect(shiftCandle(cs[0]!, 0)).toBe(cs[0]);
  });
});
