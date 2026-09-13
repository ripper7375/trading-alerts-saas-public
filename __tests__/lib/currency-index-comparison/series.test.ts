import { describe, it, expect } from '@jest/globals';

import {
  buildComparisonCandles,
  chainSessions,
  isComparisonIndexName,
  MAX_COMPARISON_CANDLES,
  toTimeframe,
  type RawIndexBar,
} from '@/lib/currency-index-comparison/series';

// 00:00 server-time reopen for an FX index -- on both the 300s and 900s grid.
const DAY1 = 1_800_000_000;
const DAY2 = DAY1 + 86_400;
const DAY3 = DAY2 + 86_400;

function bar(
  barTime: number,
  sessionOpenBarTime: number,
  ohlc: [number, number, number, number] | [null, null, null, number]
): RawIndexBar {
  const [open, high, low, close] = ohlc;
  return { barTime, sessionOpenBarTime, open, high, low, close };
}

describe('chainSessions', () => {
  it('leaves a single session untouched (the latest session is the anchor)', () => {
    const raw = [
      bar(DAY1, DAY1, [99.9, 100.2, 99.8, 100]),
      bar(DAY1 + 300, DAY1, [100, 100.4, 99.95, 100.3]),
    ];
    const out = chainSessions(raw);
    expect(out.map((c) => [c.open, c.high, c.low, c.close])).toEqual([
      [99.9, 100.2, 99.8, 100],
      [100, 100.4, 99.95, 100.3],
    ]);
  });

  it("joins the previous session's last close to the next session's first open, keeping the latest session unscaled", () => {
    const raw = [
      bar(DAY1, DAY1, [100, 100.6, 99.9, 100.5]),
      bar(DAY1 + 300, DAY1, [100.5, 101.2, 100.4, 101.0]),
      bar(DAY2, DAY2, [99.8, 100.1, 99.7, 100]),
      bar(DAY2 + 300, DAY2, [100, 100.35, 99.9, 100.3]),
    ];
    const out = chainSessions(raw);

    // Latest session: exactly its stored values.
    expect(out[2]!.open).toBeCloseTo(99.8, 12);
    expect(out[3]!.close).toBeCloseTo(100.3, 12);
    // Previous session scaled so its last close meets the next first open.
    expect(out[1]!.close).toBeCloseTo(out[2]!.open, 12);
    // ...by one constant factor for the whole session (shape preserved).
    const k = 99.8 / 101.0;
    expect(out[0]!.open).toBeCloseTo(100 * k, 12);
    expect(out[0]!.high).toBeCloseTo(100.6 * k, 12);
    expect(out[1]!.low).toBeCloseTo(100.4 * k, 12);
  });

  it('recovers an underlying continuous series exactly when prices are continuous across session opens', () => {
    // A continuous index C, with each bar's open equal to the previous close
    // (no gap). Lane 4 stores each session as C / C(first close) * 100.
    const continuous: { t: number; o: number; c: number; session: number }[] =
      [];
    let price = 1000;
    for (const session of [DAY1, DAY2, DAY3]) {
      for (let i = 0; i < 20; i++) {
        const o = price;
        const c = price * (1 + Math.sin(session / 1e5 + i) * 0.002);
        continuous.push({ t: session + i * 300, o, c, session });
        price = c;
      }
    }

    const raw: RawIndexBar[] = [];
    for (const session of [DAY1, DAY2, DAY3]) {
      const rows = continuous.filter((r) => r.session === session);
      const inception = rows[0]!.c;
      for (const r of rows) {
        const o = (r.o / inception) * 100;
        const c = (r.c / inception) * 100;
        raw.push(bar(r.t, session, [o, Math.max(o, c), Math.min(o, c), c]));
      }
    }

    const out = chainSessions(raw);
    const lastInception = continuous.filter((r) => r.session === DAY3)[0]!.c;
    out.forEach((candle, i) => {
      const expected = (continuous[i]!.c / lastInception) * 100;
      expect(candle.close).toBeCloseTo(expected, 9);
    });
  });

  it('falls back to the close for a row stored before index OHLC existed (NULL open/high/low)', () => {
    const out = chainSessions([bar(DAY1, DAY1, [null, null, null, 100.25])]);
    expect(out[0]).toMatchObject({
      open: 100.25,
      high: 100.25,
      low: 100.25,
      close: 100.25,
    });
  });

  it('never emits an inverted candle from a malformed row', () => {
    const out = chainSessions([bar(DAY1, DAY1, [100.1, 99.0, 101.0, 100.2])]);
    expect(out[0]!.high).toBeGreaterThanOrEqual(100.2);
    expect(out[0]!.low).toBeLessThanOrEqual(100.1);
  });

  it('returns [] for no rows', () => {
    expect(chainSessions([])).toEqual([]);
  });
});

describe('toTimeframe', () => {
  const session = DAY1;
  const m5 = chainSessions([
    bar(session, session, [100, 100.3, 99.9, 100.1]),
    bar(session + 300, session, [100.1, 100.5, 100.0, 100.4]),
    bar(session + 600, session, [100.4, 100.45, 99.7, 99.8]),
    bar(session + 900, session, [99.8, 99.9, 99.6, 99.65]),
  ]);

  it('passes M5 through, one candle per bar', () => {
    const out = toTimeframe(m5, 'M5');
    expect(out).toHaveLength(4);
    expect(out[0]).toEqual({
      time: session,
      open: 100,
      high: 100.3,
      low: 99.9,
      close: 100.1,
    });
  });

  it('builds clock-aligned M15 candles: first open, max high, min low, last close', () => {
    const out = toTimeframe(m5, 'M15');
    expect(out).toEqual([
      { time: session, open: 100, high: 100.5, low: 99.7, close: 99.8 },
      { time: session + 900, open: 99.8, high: 99.9, low: 99.6, close: 99.65 },
    ]);
  });

  it("buckets REAL XAUX bars (on the 5-minute grid) under a 01:01 anchor into MT5's own M15 slots", () => {
    const xauxAnchor = DAY1 + 3660; // 01:01 server time
    const firstGridBar = DAY1 + 3600; // 01:00
    const raw = [5, 10, 15, 20].map((min) =>
      bar(firstGridBar + min * 60, xauxAnchor, [100, 100.2, 99.9, 100.1])
    );
    const out = toTimeframe(chainSessions(raw), 'M15');
    expect(out.map((c) => c.time)).toEqual([
      firstGridBar, // 01:05 + 01:10 (the 01:00 bucket, first bar not emitted by the engine)
      firstGridBar + 900, // 01:15 + 01:20
    ]);
  });

  it('never emits two candles with the same time, even if a session boundary falls inside a bucket', () => {
    const raw = [
      bar(DAY1 + 300, DAY1, [100, 100.2, 99.9, 100.1]),
      bar(DAY1 + 600, DAY1 + 600, [100.1, 100.3, 100.0, 100.2]),
    ];
    const out = toTimeframe(chainSessions(raw), 'M15');
    expect(out).toHaveLength(1);
    expect(out[0]!.time).toBe(DAY1);
  });
});

describe('buildComparisonCandles', () => {
  it(`caps output at ${MAX_COMPARISON_CANDLES} candles, keeping the newest`, () => {
    const raw = Array.from({ length: MAX_COMPARISON_CANDLES + 500 }, (_, i) =>
      bar(DAY1 + i * 300, DAY1, [100, 100.1, 99.9, 100 + i * 1e-4])
    );
    const out = buildComparisonCandles(raw, 'M5');
    expect(out).toHaveLength(MAX_COMPARISON_CANDLES);
    expect(out[out.length - 1]!.time).toBe(raw[raw.length - 1]!.barTime);
  });
});

describe('isComparisonIndexName', () => {
  it('accepts all 9 Lane 4 indices and nothing else', () => {
    for (const name of [
      'XAUX',
      'USDX',
      'EURX',
      'JPYX',
      'GBPX',
      'AUDX',
      'NZDX',
      'CADX',
      'CHFX',
    ]) {
      expect(isComparisonIndexName(name)).toBe(true);
    }
    expect(isComparisonIndexName('DXY')).toBe(false);
    expect(isComparisonIndexName('eurx')).toBe(false);
  });
});
