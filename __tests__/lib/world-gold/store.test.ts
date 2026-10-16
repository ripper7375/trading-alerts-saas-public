/** @jest-environment node */
import {
  insertDerivedClose,
  readDerivedCloses,
  readGoldQuote,
  validDerivedClose,
  type GoldReader,
  type WorldGoldSql,
} from '@/lib/world-gold/store';
import { closeFixture } from './fixtures';
import type { DerivedClose } from '@/lib/world-gold/types';
jest.mock('@/lib/db/market-prisma', () => ({
  marketPrisma: {
    marketDataV6: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  },
}));
describe('World gold database boundaries', () => {
  const now = new Date('2026-10-15T10:35:00Z');
  test('reads the latest CLOSED M5 bar, using its ending time for freshness', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      close: 2650,
      timestamp: Date.parse('2026-10-15T10:25:00Z') / 1000,
    });
    const reader: GoldReader = { marketDataV6: { findFirst } };
    expect(await readGoldQuote(now, reader)).toEqual({
      price: 2650,
      updatedAt: '2026-10-15T10:30:00.000Z',
      stale: false,
    });
    expect(findFirst.mock.calls[0]?.[0].where.timestamp.lte).toBe(
      Date.parse('2026-10-15T10:30:00Z') / 1000
    );
  });
  test.each([
    [{ close: 2650, timestamp: Date.parse('2026-10-15T10:35:00Z') / 1000 }],
    [{ close: 0, timestamp: 1 }],
    [{ close: Infinity, timestamp: 1 }],
    [null],
  ])('refuses forming, nonpositive or missing gold rows', async (row) => {
    expect(
      await readGoldQuote(now, {
        marketDataV6: { findFirst: jest.fn().mockResolvedValue(row) },
      })
    ).toBeNull();
  });
  test('makes old current gold visible with a stale marker', async () => {
    const quote = await readGoldQuote(now, {
      marketDataV6: {
        findFirst: jest.fn().mockResolvedValue({
          close: 2650,
          timestamp: Date.parse('2026-10-14T10:25:00Z') / 1000,
        }),
      },
    });
    expect(quote?.price).toBe(2650);
    expect(quote?.stale).toBe(true);
  });
  test('database failure is unavailable rather than a manufactured gold price', async () => {
    expect(
      await readGoldQuote(now, {
        marketDataV6: {
          findFirst: jest.fn().mockRejectedValue(new Error('offline')),
        },
      })
    ).toBeNull();
  });
  test('derivation rejects future source times, stale gold, wrong units and invalid local dates', () => {
    const valid = closeFixture();
    expect(validDerivedClose(valid)).toBe(true);
    const patches: Partial<DerivedClose>[] = [
      { goldBarClosedAt: '2026-10-14T16:00:01Z' },
      { goldBarClosedAt: '2026-10-14T15:44:59Z' },
      { fxObservedAt: '2026-10-14T16:00:01Z' },
      { fxPublishedAt: '2026-10-14T14:54:59Z' },
      { prices: { oz: 100 } },
      { prices: { oz: 100, sovereign: 0 } },
      { sessionDate: '2026-02-30' },
      { sessionDate: '2026-10-17' },
      { formulaVersion: 'different' },
      { marketId: 'unknown' },
    ];
    for (const patch of patches)
      expect(validDerivedClose({ ...valid, ...patch })).toBe(false);
  });
  test('insertion is parameterized, conflict-safe and stores no raw gold or FX quote', async () => {
    const execute = jest.fn().mockResolvedValue(1);
    const sql: WorldGoldSql = { execute, query: async <T>() => [] as T };
    const close = closeFixture();
    expect(await insertDerivedClose(close, sql)).toBe(true);
    const [parts, ...values] = execute.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    expect(parts.join('')).toContain(
      'ON CONFLICT (market_id, session_date, formula_version) DO NOTHING'
    );
    const json = JSON.parse(values[7] as string) as unknown;
    expect(json).toEqual(close.prices);
    expect(values).not.toContain('rates');
    execute.mockResolvedValue(0);
    expect(await insertDerivedClose(close, sql)).toBe(false);
  });
  test('invalid insert is rejected before touching the database', async () => {
    const execute = jest.fn();
    await expect(
      insertDerivedClose(
        { ...closeFixture(), prices: {} },
        { execute, query: async <T>() => [] as T }
      )
    ).rejects.toThrow('Invalid derived close');
    expect(execute).not.toHaveBeenCalled();
  });
  test('unapplied migration becomes explicit missing history', async () => {
    const sql: WorldGoldSql = {
      query: async () => {
        throw new Error('missing relation');
      },
      execute: async () => 0,
    };
    expect(await readDerivedCloses(now, sql)).toEqual({
      available: false,
      closes: [],
    });
  });
  test('malformed persisted records are filtered rather than becoming a reference price', async () => {
    const valid = closeFixture();
    const seconds = (iso: string) => Date.parse(iso) / 1000;
    const row = {
      market_id: valid.marketId,
      session_date: valid.sessionDate,
      formula_version: valid.formulaVersion,
      closed_at: seconds(valid.closedAt),
      gold_bar_closed_at: seconds(valid.goldBarClosedAt),
      fx_published_at: seconds(valid.fxPublishedAt),
      fx_observed_at: seconds(valid.fxObservedAt),
      prices: valid.prices,
    };
    const sql: WorldGoldSql = {
      query: async <T>() => [row, { ...row, prices: { oz: -1 } }] as T,
      execute: async () => 0,
    };
    expect(await readDerivedCloses(now, sql)).toEqual({
      available: true,
      closes: [valid],
    });
  });
});
