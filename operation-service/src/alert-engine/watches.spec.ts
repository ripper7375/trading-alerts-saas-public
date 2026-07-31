/**
 * buildWatch tests — confirms watches derive their level from the shared
 * geometry and that unknown target levels are rejected.
 *
 * Ported verbatim from __tests__/alert-engine/watches.test.ts (Session 4B-2,
 * File 5/13) — assertions unchanged.
 */

import { buildWatch, type DrawingAlertRow } from './watches';

function row(overrides: Partial<DrawingAlertRow> = {}): DrawingAlertRow {
  return {
    id: 'da1',
    alertId: 'a1',
    targetLevel: 'line',
    direction: 'either',
    tolerance: 0,
    cooldownSec: 60,
    oneShot: false,
    drawing: {
      id: 'd1',
      userId: 'u1',
      symbol: 'XAUUSD',
      timeframe: 'M10',
      type: 'HLINE',
      anchors: [{ time: 0, price: 1980 }],
      style: { color: '#2962FF', lineWidth: 2, lineStyle: 'solid' },
    },
    ...overrides,
  };
}

describe('buildWatch', () => {
  it('builds a watch whose valueAt matches the drawing geometry', () => {
    const w = buildWatch(row());
    expect(w).not.toBeNull();
    expect(w?.levelId).toBe('line');
    expect(w?.valueAt(12345)).toBeCloseTo(1980);
    expect(w?.symbol).toBe('XAUUSD');
  });

  it('returns null for a target level the drawing does not expose', () => {
    const w = buildWatch(row({ targetLevel: 'fib_0.618' })); // not on an HLINE
    expect(w).toBeNull();
  });

  it('resolves a channel edge level', () => {
    const w = buildWatch(
      row({
        targetLevel: 'channel_top',
        drawing: {
          id: 'd2',
          userId: 'u1',
          symbol: 'XAUUSD',
          timeframe: 'M10',
          type: 'CHANNEL',
          anchors: [
            { time: 0, price: 100 },
            { time: 10, price: 100 },
            { time: 5, price: 130 },
          ],
          style: { color: '#2962FF', lineWidth: 2, lineStyle: 'solid' },
        },
      })
    );
    expect(w?.valueAt(5)).toBeCloseTo(130);
  });

  it('normalizes an unknown direction to either', () => {
    const w = buildWatch(row({ direction: 'sideways' }));
    expect(w?.direction).toBe('either');
  });
});
