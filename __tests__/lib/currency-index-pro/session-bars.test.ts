/**
 * @jest-environment node
 */

/**
 * getTodaysSessionBarsForIndices() (lib/currency-index-pro/queries.ts): the PRO chart, screener and detail routes' read of
 * "every bar from each index's own session open through the latest bar".
 *
 * Ad-hoc order docs/migration-orders/adhoc-pro-session-bars-latest-per-index.migration-order.md (B2). The lookup of the newest
 * bar of each requested index is ONE raw statement (`$queryRaw`) with the requested names bound as one text[] parameter. What it
 * returns against a real PostgreSQL, compared with the Prisma `distinct` read it replaced, is proven by the gated
 * __tests__/lib/currency-index-pro/session-bars.pg.spec.ts. The tests here use mocks, so for the lookup they pin the statement's
 * shape, what is bound, and the mapping into the Map the routes read.
 */
// NOTE: 'jest' is deliberately NOT imported from @jest/globals -- a hoisted mock factory must use the injected global.
import { describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('@/lib/db/market-prisma', () => ({
  marketPrisma: {
    currencyGoldIndex: { findMany: jest.fn() },
    dailyVolatilityCorridor: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));
jest.mock('@/lib/db/prisma', () => ({
  prisma: { userCurrencyIndexPreference: { findUnique: jest.fn() } },
}));

import { marketPrisma } from '@/lib/db/market-prisma';
import { getTodaysSessionBarsForIndices } from '@/lib/currency-index-pro/queries';

const findMany = marketPrisma.currencyGoldIndex
  .findMany as unknown as jest.Mock;
const queryRaw = marketPrisma.$queryRaw as unknown as jest.Mock;

const SESSION_OPEN = 1_800_000_000;

function lookupRow(name: string, sessionOpen = SESSION_OPEN) {
  return { index_name: name, session_open_bar_time: sessionOpen };
}

function barRow(name: string, barTime: number, value: number, change: number) {
  return {
    index_name: name,
    bar_time: barTime,
    value,
    change_pct: change,
  };
}

describe('getTodaysSessionBarsForIndices', () => {
  beforeEach(() => {
    // resetAllMocks, not clearAllMocks: queued once-values must not leak between tests (the bars read is skipped when
    // the lookup finds nothing, so a test that queues one it never consumes would feed the next test's first call).
    jest.resetAllMocks();
  });

  it('looks up the newest bar of each requested index in ONE statement, binding the names as one array', async () => {
    queryRaw.mockResolvedValueOnce([]);
    const names = ['JPYX', 'EURX'];

    await getTodaysSessionBarsForIndices(names);

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const call = queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    // exactly one bound value: the names, as a COPY of the caller's array
    expect(call).toHaveLength(2);
    expect(call[1]).toEqual(['JPYX', 'EURX']);
    expect(call[1]).not.toBe(names);

    const text = call[0].join('?');
    expect(text).toContain('FROM "currency_gold_indices"');
    // the names are a text[] parameter, made distinct, never concatenated into the text
    expect(text).toContain('unnest(?::text[])');
    expect(text).toContain('SELECT DISTINCT n');
    // each name's NEWEST bar: newest first, one row, a seek per name
    expect(text).toContain('CROSS JOIN LATERAL');
    expect(text).toMatch(/ORDER BY c\."bar_time" DESC\s+LIMIT 1/);
    // ordered by index name: the chart route reads the first entry of the Map
    expect(text).toContain('ORDER BY l."index_name" ASC');
    // only the two columns the bars read needs
    expect(text).toContain('SELECT l."index_name", l."session_open_bar_time"');
    // Prisma's `distinct` (every historical row of those indices sent to the application) is gone
    expect(findMany).not.toHaveBeenCalled();
  });

  it('returns an empty Map without touching the database for an empty request', async () => {
    const result = await getTodaysSessionBarsForIndices([]);

    expect(result).toEqual(new Map());
    expect(queryRaw).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it('returns an empty Map and skips the bars read when nothing has been pushed yet', async () => {
    queryRaw.mockResolvedValueOnce([]);

    const result = await getTodaysSessionBarsForIndices(['EURX']);

    expect(result).toEqual(new Map());
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("bounds the bars read by EACH index's own session_open_bar_time", async () => {
    queryRaw.mockResolvedValueOnce([
      lookupRow('EURX', SESSION_OPEN),
      lookupRow('JPYX', SESSION_OPEN + 60),
    ]);
    findMany.mockResolvedValueOnce([]);

    await getTodaysSessionBarsForIndices(['EURX', 'JPYX']);

    expect(findMany).toHaveBeenCalledTimes(1);
    const args = findMany.mock.calls[0]?.[0] as {
      where: { OR: Array<{ index_name: string; bar_time: { gte: number } }> };
      orderBy: unknown;
    };
    expect(args.where.OR).toEqual([
      { index_name: 'EURX', bar_time: { gte: SESSION_OPEN } },
      { index_name: 'JPYX', bar_time: { gte: SESSION_OPEN + 60 } },
    ]);
    expect(args.orderBy).toEqual([{ index_name: 'asc' }, { bar_time: 'asc' }]);
  });

  it('builds one entry per index with its own session open and its bars in time order', async () => {
    queryRaw.mockResolvedValueOnce([lookupRow('EURX'), lookupRow('JPYX')]);
    findMany.mockResolvedValueOnce([
      barRow('EURX', SESSION_OPEN, 100.1, 0.1),
      barRow('EURX', SESSION_OPEN + 300, 100.2, 0.2),
      barRow('JPYX', SESSION_OPEN, 99.9, -0.1),
    ]);

    const result = await getTodaysSessionBarsForIndices(['EURX', 'JPYX']);

    expect(result.get('EURX')).toEqual({
      sessionOpenBarTime: SESSION_OPEN,
      bars: [
        { barTime: SESSION_OPEN, value: 100.1, changePct: 0.1 },
        { barTime: SESSION_OPEN + 300, value: 100.2, changePct: 0.2 },
      ],
    });
    expect(result.get('JPYX')).toEqual({
      sessionOpenBarTime: SESSION_OPEN,
      bars: [{ barTime: SESSION_OPEN, value: 99.9, changePct: -0.1 }],
    });
  });

  it('keeps the entries in the order the lookup returned them (index name ascending)', async () => {
    queryRaw.mockResolvedValueOnce([
      lookupRow('AUDX'),
      lookupRow('EURX'),
      lookupRow('NZDX'),
    ]);
    findMany.mockResolvedValueOnce([]);

    const result = await getTodaysSessionBarsForIndices([
      'NZDX',
      'AUDX',
      'EURX',
    ]);

    expect([...result.keys()]).toEqual(['AUDX', 'EURX', 'NZDX']);
    // an index with a session open and no bars yet is still an entry, with no bars
    expect(result.get('AUDX')?.bars).toEqual([]);
  });

  it('ignores bars of an index the lookup did not return', async () => {
    queryRaw.mockResolvedValueOnce([lookupRow('EURX')]);
    findMany.mockResolvedValueOnce([
      barRow('EURX', SESSION_OPEN, 100.1, 0.1),
      barRow('XAUX', SESSION_OPEN, 100.3, 0.3),
    ]);

    const result = await getTodaysSessionBarsForIndices(['EURX']);

    expect([...result.keys()]).toEqual(['EURX']);
    expect(result.get('EURX')?.bars).toHaveLength(1);
  });

  it('degrades to an empty Map when the table does not exist yet', async () => {
    // The migration is applied separately from the deploy, and the VPS engine may not have pushed anything yet.
    queryRaw.mockRejectedValue(
      new Error('relation "currency_gold_indices" does not exist')
    );

    await expect(getTodaysSessionBarsForIndices(['EURX'])).resolves.toEqual(
      new Map()
    );
    expect(findMany).not.toHaveBeenCalled();
  });

  it('degrades to an empty Map when the bars read fails after the lookup succeeded', async () => {
    queryRaw.mockResolvedValueOnce([lookupRow('EURX')]);
    findMany.mockRejectedValue(new Error('connection terminated'));

    await expect(getTodaysSessionBarsForIndices(['EURX'])).resolves.toEqual(
      new Map()
    );
  });
});
