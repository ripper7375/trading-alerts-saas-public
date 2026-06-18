/**
 * Unit tests for the pure drawing-geometry module.
 *
 * These functions are shared verbatim by the chart UI (Phase 1) and the
 * server-side alert worker (Phase 4), so correctness here underpins both.
 */

import {
  channelLevels,
  DEFAULT_FIB_EXT_RATIOS,
  DEFAULT_FIB_RETRACE_RATIOS,
  fibExtensionLevels,
  fibRetracementLevels,
  horizontalValue,
  levelsForMark,
  trendlineValueAt,
  type Anchor,
  type DrawingStyle,
  type MarkSnapshot,
} from '@/components/charts/drawing/geometry';

const baseStyle: DrawingStyle = {
  color: '#2962FF',
  lineWidth: 2,
  lineStyle: 'solid',
};

function snap(
  type: MarkSnapshot['type'],
  anchors: Anchor[],
  extra: Record<string, unknown> = {}
): MarkSnapshot {
  return { id: 'd1', type, anchors, style: { ...baseStyle, ...extra } };
}

describe('trendlineValueAt', () => {
  // Line from (t=0, p=100) to (t=10, p=200): slope = 10/unit time.
  const a1: Anchor = { time: 0, price: 100 };
  const a2: Anchor = { time: 10, price: 200 };

  it('interpolates at the midpoint', () => {
    expect(trendlineValueAt(a1, a2, 5)).toBeCloseTo(150);
  });

  it('returns endpoint prices at the anchors', () => {
    expect(trendlineValueAt(a1, a2, 0)).toBeCloseTo(100);
    expect(trendlineValueAt(a1, a2, 10)).toBeCloseTo(200);
  });

  it('works regardless of anchor ordering', () => {
    expect(trendlineValueAt(a2, a1, 5)).toBeCloseTo(150);
  });

  it('returns null outside the span when extensions are disabled', () => {
    expect(trendlineValueAt(a1, a2, -5)).toBeNull();
    expect(trendlineValueAt(a1, a2, 15)).toBeNull();
  });

  it('extrapolates when the matching extension is enabled', () => {
    expect(trendlineValueAt(a1, a2, 15, { extendRight: true })).toBeCloseTo(
      250
    );
    expect(trendlineValueAt(a1, a2, -5, { extendLeft: true })).toBeCloseTo(50);
  });

  it('respects extension direction independently', () => {
    expect(trendlineValueAt(a1, a2, 15, { extendLeft: true })).toBeNull();
    expect(trendlineValueAt(a1, a2, -5, { extendRight: true })).toBeNull();
  });

  it('returns null for a vertical line (equal times)', () => {
    expect(
      trendlineValueAt({ time: 5, price: 1 }, { time: 5, price: 9 }, 5)
    ).toBeNull();
  });

  it('returns null on non-finite inputs', () => {
    expect(trendlineValueAt(a1, a2, Number.NaN)).toBeNull();
  });
});

describe('horizontalValue', () => {
  it('is constant', () => {
    expect(horizontalValue(123.45)).toBe(123.45);
  });
});

describe('channelLevels', () => {
  // Flat base line at price 100; offset of +20.
  const a1: Anchor = { time: 0, price: 100 };
  const a2: Anchor = { time: 10, price: 100 };

  it('computes top/bottom/median with a positive offset', () => {
    const ch = channelLevels(a1, a2, 20);
    expect(ch.top(5)).toBeCloseTo(120);
    expect(ch.bottom(5)).toBeCloseTo(100);
    expect(ch.median(5)).toBeCloseTo(110);
  });

  it('keeps top >= bottom even with a negative offset', () => {
    const ch = channelLevels(a1, a2, -20);
    expect(ch.top(5)).toBeCloseTo(100);
    expect(ch.bottom(5)).toBeCloseTo(80);
    expect(ch.median(5)).toBeCloseTo(90);
  });

  it('follows the base slope', () => {
    const ch = channelLevels(
      { time: 0, price: 100 },
      { time: 10, price: 200 },
      10
    );
    // base at t=5 is 150 → top = 160, bottom = 150
    expect(ch.top(5)).toBeCloseTo(160);
    expect(ch.bottom(5)).toBeCloseTo(150);
  });

  it('returns null for a vertical base line', () => {
    const ch = channelLevels({ time: 5, price: 1 }, { time: 5, price: 9 }, 10);
    expect(ch.top(5)).toBeNull();
    expect(ch.bottom(5)).toBeNull();
    expect(ch.median(5)).toBeNull();
  });
});

describe('fibRetracementLevels', () => {
  // pA (a1) = 200 at r=1, pB (a2) = 100 at r=0.
  const a1: Anchor = { time: 0, price: 200 };
  const a2: Anchor = { time: 10, price: 100 };

  it('anchors r=0 to pB and r=1 to pA', () => {
    const lv = fibRetracementLevels(a1, a2);
    expect(lv['fib_0']).toBeCloseTo(100);
    expect(lv['fib_1']).toBeCloseTo(200);
  });

  it('computes the 0.618 level', () => {
    const lv = fibRetracementLevels(a1, a2);
    expect(lv['fib_0.618']).toBeCloseTo(161.8);
  });

  it('emits one key per default ratio', () => {
    const lv = fibRetracementLevels(a1, a2);
    expect(Object.keys(lv)).toHaveLength(DEFAULT_FIB_RETRACE_RATIOS.length);
  });

  it('honors a custom ratio set', () => {
    const lv = fibRetracementLevels(a1, a2, [0.5]);
    expect(Object.keys(lv)).toEqual(['fib_0.5']);
    expect(lv['fib_0.5']).toBeCloseTo(150);
  });
});

describe('fibExtensionLevels', () => {
  // swing = p1 - p0 = 150 - 100 = 50; base p2 = 120.
  const a0: Anchor = { time: 0, price: 100 };
  const a1: Anchor = { time: 5, price: 150 };
  const a2: Anchor = { time: 8, price: 120 };

  it('projects from p2 by swing * ratio', () => {
    const lv = fibExtensionLevels(a0, a1, a2);
    expect(lv['fib_ext_0']).toBeCloseTo(120);
    expect(lv['fib_ext_1']).toBeCloseTo(170); // 120 + 50*1
    expect(lv['fib_ext_1.618']).toBeCloseTo(200.9); // 120 + 50*1.618
  });

  it('emits one key per default ratio', () => {
    const lv = fibExtensionLevels(a0, a1, a2);
    expect(Object.keys(lv)).toHaveLength(DEFAULT_FIB_EXT_RATIOS.length);
  });
});

describe('levelsForMark', () => {
  it('HLINE → single constant "line" level', () => {
    const levels = levelsForMark(snap('HLINE', [{ time: 0, price: 1980 }]));
    expect(levels.map((l) => l.id)).toEqual(['line']);
    expect(levels[0]?.valueAt(99999)).toBeCloseTo(1980);
  });

  it('TRENDLINE → "line" level honoring extend flags from style', () => {
    const anchors: Anchor[] = [
      { time: 0, price: 100 },
      { time: 10, price: 200 },
    ];
    const noExtend = levelsForMark(snap('TRENDLINE', anchors));
    expect(noExtend[0]?.valueAt(15)).toBeNull();

    const extended = levelsForMark(
      snap('TRENDLINE', anchors, { extendRight: true })
    );
    expect(extended[0]?.valueAt(15)).toBeCloseTo(250);
  });

  it('CHANNEL → top/bottom/median using style.offset', () => {
    const levels = levelsForMark(
      snap(
        'CHANNEL',
        [
          { time: 0, price: 100 },
          { time: 10, price: 100 },
        ],
        { offset: 20 }
      )
    );
    expect(levels.map((l) => l.id)).toEqual([
      'channel_top',
      'channel_bottom',
      'channel_median',
    ]);
    expect(levels[0]?.valueAt(5)).toBeCloseTo(120);
    expect(levels[2]?.valueAt(5)).toBeCloseTo(110);
  });

  it('FIB_RETRACE → constant levels with fib_* ids', () => {
    const levels = levelsForMark(
      snap('FIB_RETRACE', [
        { time: 0, price: 200 },
        { time: 10, price: 100 },
      ])
    );
    const byId = Object.fromEntries(levels.map((l) => [l.id, l.valueAt(0)]));
    expect(byId['fib_0']).toBeCloseTo(100);
    expect(byId['fib_1']).toBeCloseTo(200);
    expect(byId['fib_0.618']).toBeCloseTo(161.8);
  });

  it('FIB_RETRACE → honors style.levels override', () => {
    const levels = levelsForMark(
      snap(
        'FIB_RETRACE',
        [
          { time: 0, price: 200 },
          { time: 10, price: 100 },
        ],
        { levels: [0.5] }
      )
    );
    expect(levels.map((l) => l.id)).toEqual(['fib_0.5']);
  });

  it('FIB_EXT → constant levels with fib_ext_* ids', () => {
    const levels = levelsForMark(
      snap('FIB_EXT', [
        { time: 0, price: 100 },
        { time: 5, price: 150 },
        { time: 8, price: 120 },
      ])
    );
    const byId = Object.fromEntries(levels.map((l) => [l.id, l.valueAt(0)]));
    expect(byId['fib_ext_1']).toBeCloseTo(170);
  });

  it('TEXT → no alert levels', () => {
    expect(levelsForMark(snap('TEXT', [{ time: 0, price: 100 }]))).toEqual([]);
  });

  it('malformed anchor sets → no levels', () => {
    expect(levelsForMark(snap('TRENDLINE', [{ time: 0, price: 100 }]))).toEqual(
      []
    );
    expect(levelsForMark(snap('FIB_EXT', [{ time: 0, price: 1 }]))).toEqual([]);
    expect(levelsForMark(snap('HLINE', []))).toEqual([]);
  });
});
