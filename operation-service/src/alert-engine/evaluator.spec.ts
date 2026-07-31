/**
 * Evaluator tests with an in-memory state store and a recording dispatcher.
 *
 * Ported verbatim from __tests__/alert-engine/evaluator.test.ts (Session
 * 4B-2, File 6/13) — assertions unchanged. Exercises File 4's in-memory
 * AlertStateStore impl (this is the parity proof File 4's own port step
 * deferred to here).
 */

import { evaluatePriceEvent } from './evaluator';
import { createMemoryStateStore } from './state';
import type { AlertWatch, FireEvent, PriceEvent } from './types';

function watch(overrides: Partial<AlertWatch> = {}): AlertWatch {
  return {
    alertId: 'a1',
    drawingAlertId: 'da1',
    userId: 'u1',
    symbol: 'XAUUSD',
    timeframe: 'M10',
    levelId: 'line',
    valueAt: () => 100,
    direction: 'either',
    tolerance: 0,
    cooldownSec: 60,
    oneShot: false,
    ...overrides,
  };
}

function bar(close: number, prev?: number): PriceEvent {
  return {
    symbol: 'XAUUSD',
    timeframe: 'M10',
    time: 1000,
    open: prev ?? close,
    high: Math.max(close, prev ?? close),
    low: Math.min(close, prev ?? close),
    close,
    final: true,
  };
}

async function run(
  watches: AlertWatch[],
  events: PriceEvent[]
): Promise<FireEvent[]> {
  const state = createMemoryStateStore();
  const fires: FireEvent[] = [];
  const dispatch = async (f: FireEvent): Promise<void> => {
    fires.push(f);
  };
  for (const ev of events) {
    await evaluatePriceEvent(ev, watches, state, dispatch);
  }
  return fires;
}

describe('evaluatePriceEvent', () => {
  it('fires once when price crosses the level', async () => {
    const fires = await run(
      [watch()],
      [bar(98), bar(102)] // seed below, then cross up
    );
    expect(fires).toHaveLength(1);
    expect(fires[0]).toMatchObject({
      alertId: 'a1',
      levelPrice: 100,
      touchPrice: 102,
    });
  });

  it('cooldown blocks a second fire', async () => {
    const fires = await run(
      [watch({ cooldownSec: 60 })],
      [bar(98), bar(102), bar(98), bar(102)]
    );
    expect(fires).toHaveLength(1);
  });

  it('re-fires when cooldown is disabled', async () => {
    const fires = await run(
      [watch({ cooldownSec: 0 })],
      [bar(98), bar(102), bar(98), bar(102)]
    );
    expect(fires.length).toBeGreaterThanOrEqual(2);
  });

  it('one-shot fires only once even with no cooldown', async () => {
    const fires = await run(
      [watch({ cooldownSec: 0, oneShot: true })],
      [bar(98), bar(102), bar(98), bar(102)]
    );
    expect(fires).toHaveLength(1);
  });

  it('direction filter: cross_down ignores an upward cross', async () => {
    const fires = await run(
      [watch({ direction: 'cross_down' })],
      [bar(98), bar(102)]
    );
    expect(fires).toHaveLength(0);
  });

  it('skips watches for a different symbol/timeframe', async () => {
    const fires = await run([watch({ symbol: 'EURUSD' })], [bar(98), bar(102)]);
    expect(fires).toHaveLength(0);
  });

  it('skips when the level is undefined at this time (null)', async () => {
    const fires = await run([watch({ valueAt: () => null })], [bar(102)]);
    expect(fires).toHaveLength(0);
  });
});
