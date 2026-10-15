/** @jest-environment node */
import { MARKETS } from '@/lib/world-gold/catalog';
import {
  buildWorldGoldSnapshot,
  captureWorldGoldCloses,
  type CaptureDependencies,
} from '@/lib/world-gold/server';
import { closeFixture, fxFixture } from './fixtures';
jest.mock('@/lib/db/market-prisma', () => ({
  marketPrisma: {
    marketDataV6: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  },
}));
const now = new Date('2026-10-15T10:35:00Z');
const gold = {
  price: 2650,
  updatedAt: '2026-10-15T10:30:00.000Z',
  stale: false,
};
describe('World gold snapshot and autonomous close capture', () => {
  test('returns all ten markets and all formula units even when feeds/history are unavailable', () => {
    const result = buildWorldGoldSnapshot(now, null, null, {
      available: false,
      closes: [],
    });
    expect(result.markets.map((item) => item.id)).toEqual(
      MARKETS.map((item) => item.id)
    );
    expect(result.historyAvailable).toBe(false);
    for (const row of result.markets)
      for (const unit of row.units) {
        expect(unit).toEqual({
          id: unit.id,
          price: null,
          previousClose: null,
          change: null,
          changePercent: null,
        });
      }
  });
  test('compares with yesterday local close and does not replace it with today captured close', () => {
    const previous = closeFixture('th');
    const today = closeFixture('th', '2026-10-15');
    const result = buildWorldGoldSnapshot(now, gold, fxFixture(), {
      available: true,
      closes: [today, previous],
    });
    const th = result.markets.find((item) => item.id === 'th')!;
    expect(th.previousCloseAt).toBe(previous.closedAt);
    expect(th.units[0]?.previousClose).toBe(100);
    expect(th.units[0]?.change).toBeCloseTo((th.units[0]?.price ?? 0) - 100, 8);
    expect(th.units[0]?.changePercent).toBeCloseTo(
      (((th.units[0]?.price ?? 0) - 100) / 100) * 100,
      8
    );
    expect(th.updatedAt).toBe(fxFixture().updatedAt);
  });
  test('does not substitute an older recorded day when expected prior close is missing', () => {
    const older = closeFixture('th', '2026-10-13');
    const result = buildWorldGoldSnapshot(now, gold, fxFixture(), {
      available: true,
      closes: [older],
    });
    expect(
      result.markets.find((item) => item.id === 'th')?.units[0]?.previousClose
    ).toBeNull();
  });
  test('expired raw FX cannot produce current local prices even if gold exists', () => {
    const old = fxFixture('2026-10-15T02:30:00Z', '2026-10-15T02:31:00Z');
    const result = buildWorldGoldSnapshot(now, gold, old, {
      available: true,
      closes: [],
    });
    expect(result.fx).toBeNull();
    expect(
      result.markets.every((row) =>
        row.units.every((unit) => unit.price === null)
      )
    ).toBe(true);
  });
  test('delayed FX and gold have explicit source freshness markers', () => {
    const result = buildWorldGoldSnapshot(
      now,
      { ...gold, stale: true },
      fxFixture('2026-10-15T09:00:00Z', '2026-10-15T09:01:00Z'),
      { available: true, closes: [] }
    );
    expect(result.gold?.stale).toBe(true);
    expect(result.fx?.stale).toBe(true);
  });
  function dependencies(): jest.Mocked<CaptureDependencies> {
    return {
      primeFx: jest.fn().mockResolvedValue(null),
      history: jest.fn().mockResolvedValue({ available: true, closes: [] }),
      goldAtClose: jest.fn(async (cutoff: Date) => ({
        price: 2650,
        updatedAt: cutoff.toISOString(),
        stale: false,
      })),
      fxAtClose: jest.fn(async (cutoff: Date, _now: Date) =>
        fxFixture(
          new Date(cutoff.getTime() - 30 * 60000).toISOString(),
          new Date(cutoff.getTime() - 29 * 60000).toISOString()
        )
      ),
      insert: jest.fn().mockResolvedValue(true),
    };
  }
  test('captures due local closes without requiring a page view, storing derived prices only', async () => {
    const deps = dependencies();
    const result = await captureWorldGoldCloses(now, deps);
    expect(deps.primeFx).toHaveBeenCalledWith(now);
    expect(result.stored).toContain('th:2026-10-15');
    const th = deps.insert.mock.calls
      .map((call) => call[0])
      .find((close) => close.marketId === 'th')!;
    expect(th.closedAt).toBe('2026-10-15T10:30:00.000Z');
    expect(Object.keys(th).sort()).toEqual(
      [
        'closedAt',
        'formulaVersion',
        'fxObservedAt',
        'fxPublishedAt',
        'goldBarClosedAt',
        'marketId',
        'prices',
        'sessionDate',
      ].sort()
    );
  });
  test('existing immutable close is not recalculated', async () => {
    const deps = dependencies();
    const existing = closeFixture('th', '2026-10-15');
    deps.history.mockResolvedValue({ available: true, closes: [existing] });
    const result = await captureWorldGoldCloses(now, deps);
    expect(result.alreadyPresent).toContain('th:2026-10-15');
    expect(
      deps.insert.mock.calls.every((call) => call[0].marketId !== 'th')
    ).toBe(true);
  });
  test.each(['missing', 'late', 'staleGold'])(
    'does not fabricate close with %s input',
    async (kind) => {
      const deps = dependencies();
      if (kind === 'missing') deps.fxAtClose.mockResolvedValue(null);
      if (kind === 'late')
        deps.fxAtClose.mockImplementation(async (cutoff) =>
          fxFixture(
            new Date(cutoff.getTime() - 30000).toISOString(),
            new Date(cutoff.getTime() + 1000).toISOString()
          )
        );
      if (kind === 'staleGold')
        deps.goldAtClose.mockResolvedValue({ ...gold, stale: true });
      const result = await captureWorldGoldCloses(now, deps);
      expect(result.stored).toEqual([]);
      expect(deps.insert).not.toHaveBeenCalled();
      expect(result.unavailable).toContain('th:2026-10-15');
    }
  );
  test('database conflict reports already present and never overwrites the prior record', async () => {
    const deps = dependencies();
    deps.insert.mockResolvedValue(false);
    const result = await captureWorldGoldCloses(now, deps);
    expect(result.stored).toEqual([]);
    expect(result.alreadyPresent).toContain('th:2026-10-15');
  });
  test('unavailable migration still primes observations and exposes unavailable persistence', async () => {
    const deps = dependencies();
    deps.history.mockResolvedValue({ available: false, closes: [] });
    const result = await captureWorldGoldCloses(now, deps);
    expect(deps.primeFx).toHaveBeenCalled();
    expect(deps.insert).not.toHaveBeenCalled();
    expect(result.historyAvailable).toBe(false);
  });
  test('write failure cannot be reported as successful capture', async () => {
    const deps = dependencies();
    deps.insert.mockRejectedValue(new Error('offline'));
    const result = await captureWorldGoldCloses(now, deps);
    expect(result.historyAvailable).toBe(false);
    expect(result.stored).toEqual([]);
  });
});
