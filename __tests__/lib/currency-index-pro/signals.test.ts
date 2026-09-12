import {
  classifyZone,
  detectStageBSignal,
  buildSignalSeries,
  type SignalBar,
} from '@/lib/currency-index-pro/signals';

const CORRIDOR = { strikeZonePct: 0.78 };

describe('classifyZone', () => {
  it('classifies OVERBOUGHT at or above the strike-zone threshold', () => {
    expect(classifyZone(0.78, CORRIDOR)).toBe('OVERBOUGHT');
    expect(classifyZone(1.2, CORRIDOR)).toBe('OVERBOUGHT');
  });

  it('classifies OVERSOLD at or below the negative strike-zone threshold', () => {
    expect(classifyZone(-0.78, CORRIDOR)).toBe('OVERSOLD');
    expect(classifyZone(-1.2, CORRIDOR)).toBe('OVERSOLD');
  });

  it('classifies NEUTRAL inside the corridor', () => {
    expect(classifyZone(0.5, CORRIDOR)).toBe('NEUTRAL');
    expect(classifyZone(0, CORRIDOR)).toBe('NEUTRAL');
  });

  it('returns NEUTRAL rather than fabricating a boundary when no corridor exists yet', () => {
    expect(classifyZone(5.0, null)).toBe('NEUTRAL');
  });
});

function bar(
  zone: SignalBar['zone'],
  hrma: number,
  smma: number | null
): SignalBar {
  return { zone, hrma, smma };
}

describe('detectStageBSignal', () => {
  it('returns NONE with fewer than 2 bars', () => {
    expect(detectStageBSignal([])).toBe('NONE');
    expect(detectStageBSignal([bar('NEUTRAL', 1, 1)])).toBe('NONE');
  });

  it('returns NONE when SMMA has not warmed up yet', () => {
    const bars = [bar('OVERBOUGHT', 1, null), bar('OVERBOUGHT', 0.5, null)];
    expect(detectStageBSignal(bars)).toBe('NONE');
  });

  it('confirms a bearish reversal: prior overbought zone + a bearish HRMA/SMMA cross on the latest bar', () => {
    const bars = [
      bar('OVERBOUGHT', 1.0, 0.8), // HRMA above SMMA
      bar('NEUTRAL', 0.7, 0.75), // HRMA now below SMMA -- bearish cross
    ];
    expect(detectStageBSignal(bars)).toBe('CONFIRMED_SELL');
  });

  it('confirms a bullish reversal: prior oversold zone + a bullish HRMA/SMMA cross on the latest bar', () => {
    const bars = [
      bar('OVERSOLD', -1.0, -0.8), // HRMA below SMMA
      bar('NEUTRAL', -0.7, -0.75), // HRMA now above SMMA -- bullish cross
    ];
    expect(detectStageBSignal(bars)).toBe('CONFIRMED_BUY');
  });

  it('does NOT confirm a cross with no recent Stage A zone in the lookback window', () => {
    const bars = [
      bar('NEUTRAL', 1.0, 0.8),
      bar('NEUTRAL', 0.7, 0.75), // bearish cross, but never overbought recently
    ];
    expect(detectStageBSignal(bars)).toBe('NONE');
  });

  it('does not confirm a Stage A zone with no cross at all', () => {
    const bars = [
      bar('OVERBOUGHT', 0.5, 0.8), // HRMA already below SMMA
      bar('OVERBOUGHT', 0.6, 0.75), // still below -- no cross
    ];
    expect(detectStageBSignal(bars)).toBe('NONE');
  });

  it('only looks back k bars, not the whole history', () => {
    // Overbought 7 bars ago, outside a k=2 window -- must not confirm.
    const bars = [
      bar('OVERBOUGHT', 2.0, 1.5),
      bar('NEUTRAL', 1.9, 1.6),
      bar('NEUTRAL', 1.0, 0.8),
      bar('NEUTRAL', 0.7, 0.75), // bearish cross here
    ];
    expect(detectStageBSignal(bars, 2)).toBe('NONE');
    // The same series with the default k=6 DOES see the earlier overbought bar.
    expect(detectStageBSignal(bars, 6)).toBe('CONFIRMED_SELL');
  });

  it('suppresses an otherwise-confirmed cross when HRMA has not converged yet (minBarsForSignal)', () => {
    // A genuine confirmed-sell shape (same as the bearish-reversal test
    // above), but only 2 bars exist -- far short of a realistic HRMA
    // period. Without the gate this would return CONFIRMED_SELL.
    const bars = [bar('OVERBOUGHT', 1.0, 0.8), bar('NEUTRAL', 0.7, 0.75)];
    expect(detectStageBSignal(bars, 6, 36)).toBe('NONE');
    // The same series with no minimum (SMMA's own warm-up is the only
    // gate) still confirms -- pins that the new gate is additive, not a
    // replacement for the existing SMMA-null check.
    expect(detectStageBSignal(bars, 6)).toBe('CONFIRMED_SELL');
  });

  it('allows a signal once bars.length reaches minBarsForSignal exactly', () => {
    const bars = [
      bar('NEUTRAL', 0, 0),
      bar('OVERBOUGHT', 1.0, 0.8),
      bar('NEUTRAL', 0.7, 0.75),
    ];
    expect(detectStageBSignal(bars, 6, 3)).toBe('CONFIRMED_SELL');
    expect(detectStageBSignal(bars, 6, 4)).toBe('NONE');
  });
});

describe('buildSignalSeries', () => {
  const bars = [
    { barTime: 100, value: 100.0, changePct: 0.0 },
    { barTime: 200, value: 100.5, changePct: 0.5 },
    { barTime: 300, value: 100.9, changePct: 0.9 },
  ];

  it('carries barTime/changePct through unchanged alongside the computed zone/hrma/smma', () => {
    const series = buildSignalSeries(bars, CORRIDOR, 3, 3);
    expect(series).toHaveLength(3);
    expect(series.map((b) => b.barTime)).toEqual([100, 200, 300]);
    expect(series.map((b) => b.changePct)).toEqual([0.0, 0.5, 0.9]);
  });

  it("classifies each bar's own zone from its own changePct against the corridor", () => {
    const series = buildSignalSeries(bars, CORRIDOR, 3, 3);
    expect(series.map((b) => b.zone)).toEqual([
      'NEUTRAL',
      'NEUTRAL',
      'OVERBOUGHT', // 0.9 >= 0.78
    ]);
  });

  it('every bar has a defined HRMA value, but SMMA stays null before its own seed point', () => {
    const series = buildSignalSeries(bars, CORRIDOR, 3, 3);
    expect(series.every((b) => typeof b.hrma === 'number')).toBe(true);
    expect(series[0]!.smma).toBeNull();
    expect(series[1]!.smma).toBeNull();
    expect(series[2]!.smma).toBe((0.0 + 0.5 + 0.9) / 3); // len=3 seeds at index 2
  });

  it('degrades to NEUTRAL for every bar when no corridor exists yet', () => {
    const series = buildSignalSeries(bars, null, 3, 3);
    expect(series.every((b) => b.zone === 'NEUTRAL')).toBe(true);
  });

  it('returns [] for an empty bar list', () => {
    expect(buildSignalSeries([], CORRIDOR, 3, 3)).toEqual([]);
  });
});
