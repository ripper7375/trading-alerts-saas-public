/**
 * Currency & Gold Index Suite (Lane 4): read layer + public API route.
 *
 * Two things are worth protecting here, distinct from the sibling
 * economic-events/indicator-statistics suites (both session + PRO gated):
 * this route is deliberately PUBLIC, so there is no session test here at
 * all -- instead, the thing that can silently go wrong is the cache. A
 * cache-read failure or a genuine cache hit must both still return correct
 * data without ever touching Postgres more than necessary, since this is the
 * one route in the app reachable by anonymous traffic with no auth to bound
 * request volume.
 *
 * The latest-bar-per-index lookup is ONE raw SQL statement (`$queryRaw`); what
 * it returns against a real PostgreSQL, compared with the Prisma `distinct`
 * read it replaced, is proven by the gated
 * __tests__/lib/currency-gold-indices/latest-per-index.pg.spec.ts. The tests
 * here use mocks, so for the lookup they pin the statement's shape and the
 * mapping of what it returns.
 */
// NOTE: 'jest' is deliberately NOT imported from @jest/globals -- see
// __tests__/api/economic-events.test.ts's own header for why (factories are
// hoisted above imports; an imported 'jest' binding is in TDZ when a factory
// runs).
import { describe, it, expect, beforeEach } from '@jest/globals';

// Factories must not reference out-of-scope variables, or babel-jest declines
// to hoist them -- the mock then registers AFTER the imports and the REAL
// Prisma client runs, which would attempt a genuine TLS connection.
jest.mock('@/lib/db/market-prisma', () => ({
  marketPrisma: {
    currencyGoldIndex: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));
jest.mock('@/lib/cache/cache-manager', () => ({
  getCachedCurrencyGoldIndices: jest.fn(),
  cacheCurrencyGoldIndices: jest.fn(),
}));

import { marketPrisma } from '@/lib/db/market-prisma';
import {
  getCachedCurrencyGoldIndices,
  cacheCurrencyGoldIndices,
} from '@/lib/cache/cache-manager';
import { getCurrencyGoldIndexSnapshots } from '@/lib/currency-gold-indices/queries';
import { GET } from '@/app/api/market/currency-gold-indices/route';

import { deferred, flushPromises } from '../helpers/async-helpers';

const findMany = marketPrisma.currencyGoldIndex
  .findMany as unknown as jest.Mock;
const queryRaw = marketPrisma.$queryRaw as unknown as jest.Mock;
const getCachedMock = getCachedCurrencyGoldIndices as unknown as jest.Mock;
const cacheSetMock = cacheCurrencyGoldIndices as unknown as jest.Mock;

const SESSION_OPEN = 1788994800;
const BAR_TIME = 1789000200;

function latestRow(overrides: Record<string, unknown> = {}) {
  return {
    index_name: 'USDX',
    bar_time: BAR_TIME,
    value: 100.14,
    change_pct: 0.14,
    session_open_bar_time: SESSION_OPEN,
    ...overrides,
  };
}

describe('getCurrencyGoldIndexSnapshots', () => {
  beforeEach(() => {
    // resetAllMocks, not clearAllMocks: this function runs the lookup
    // (`$queryRaw`) and then, only if that found something, the sparkline read
    // (`findMany`). clearAllMocks() only clears call history, not queued
    // mockResolvedValueOnce() values, so a test that queues a sparkline value
    // it never consumes (the early-return case) would leak it into the next
    // test's first call.
    jest.resetAllMocks();
  });

  it('asks the database for the newest bar of every index in ONE statement, with no bound values', async () => {
    queryRaw.mockResolvedValueOnce([]);
    await getCurrencyGoldIndexSnapshots();

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const call = queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    // a constant text: the template strings only, nothing interpolated
    expect(call).toHaveLength(1);
    const text = call[0].join('');

    expect(text).toContain('FROM "currency_gold_indices"');
    // every index name in the table is discovered, listed or not ...
    expect(text).toContain('WITH RECURSIVE names');
    expect(text).toContain('WHERE "index_name" > names."index_name"');
    // ... and each one's NEWEST bar is taken: newest first, one row
    expect(text).toMatch(/ORDER BY c\."bar_time" DESC\s+LIMIT 1/);
    // the result comes back ordered by index name
    expect(text).toContain('ORDER BY l."index_name" ASC');
    // the five fields the snapshot needs, and no other
    expect(text).toContain(
      'SELECT l."index_name", l."bar_time", l."value", l."change_pct", l."session_open_bar_time"'
    );
    // Prisma's `distinct` (the whole history sent to the application) is gone
    expect(findMany).not.toHaveBeenCalled();
  });

  it('skips the sparkline query entirely when nothing has been pushed yet', async () => {
    queryRaw.mockResolvedValueOnce([]);
    const result = await getCurrencyGoldIndexSnapshots();

    expect(result).toEqual([]);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("bounds the sparkline query by EACH index's own session_open_bar_time", async () => {
    queryRaw.mockResolvedValueOnce([
      latestRow({ index_name: 'USDX', session_open_bar_time: SESSION_OPEN }),
      // XAUX has an independent, later daily inception (01:01 vs 00:00
      // server time) -- confirmed distinct in a real push, per
      // currency_gold_index_engine.py's compute_cycle().
      latestRow({
        index_name: 'XAUX',
        session_open_bar_time: SESSION_OPEN + 60,
      }),
    ]);
    findMany.mockResolvedValueOnce([]);

    await getCurrencyGoldIndexSnapshots();

    expect(findMany).toHaveBeenCalledTimes(1);
    const sparklineArgs = findMany.mock.calls[0]?.[0] as {
      where: { OR: Array<{ index_name: string; bar_time: { gte: number } }> };
    };
    expect(sparklineArgs.where.OR).toEqual([
      { index_name: 'USDX', bar_time: { gte: SESSION_OPEN } },
      { index_name: 'XAUX', bar_time: { gte: SESSION_OPEN + 60 } },
    ]);
  });

  it('maps a real row through, previousClose always exactly 100 regardless of value', async () => {
    queryRaw.mockResolvedValueOnce([latestRow()]);
    findMany.mockResolvedValueOnce([
      { index_name: 'USDX', value: 99.8 },
      { index_name: 'USDX', value: 100.14 },
    ]);

    const [snapshot] = await getCurrencyGoldIndexSnapshots();

    expect(snapshot).toEqual({
      symbol: 'USDX',
      price: 100.14,
      changePct: 0.14,
      previousClose: 100.0,
      sparkline: [99.8, 100.14],
      barTime: BAR_TIME,
    });
  });

  it('falls back to a single-point sparkline if the range query somehow returns nothing for an index', async () => {
    queryRaw.mockResolvedValueOnce([latestRow()]);
    findMany.mockResolvedValueOnce([]);
    const [snapshot] = await getCurrencyGoldIndexSnapshots();
    expect(snapshot?.sparkline).toEqual([100.14]);
  });

  it('groups sparkline rows by index_name correctly across multiple indices', async () => {
    queryRaw.mockResolvedValueOnce([
      latestRow({ index_name: 'USDX', value: 100.1 }),
      latestRow({ index_name: 'EURX', value: 99.9 }),
    ]);
    findMany.mockResolvedValueOnce([
      { index_name: 'USDX', value: 100.0 },
      { index_name: 'EURX', value: 99.95 },
      { index_name: 'USDX', value: 100.1 },
      { index_name: 'EURX', value: 99.9 },
    ]);

    const snapshots = await getCurrencyGoldIndexSnapshots();
    const usdx = snapshots.find((s) => s.symbol === 'USDX');
    const eurx = snapshots.find((s) => s.symbol === 'EURX');

    expect(usdx?.sparkline).toEqual([100.0, 100.1]);
    expect(eurx?.sparkline).toEqual([99.95, 99.9]);
  });

  it('returns the snapshots in the order the lookup returned them', async () => {
    queryRaw.mockResolvedValueOnce([
      latestRow({ index_name: 'AUDX' }),
      latestRow({ index_name: 'EURX' }),
      latestRow({ index_name: 'XAUX' }),
    ]);
    findMany.mockResolvedValueOnce([]);

    const snapshots = await getCurrencyGoldIndexSnapshots();
    expect(snapshots.map((s) => s.symbol)).toEqual(['AUDX', 'EURX', 'XAUX']);
  });

  it('degrades to empty when the table does not exist yet', async () => {
    // The migration is applied separately from the deploy, and the VPS
    // engine may not have pushed anything yet -- both must degrade to
    // "nothing to show", not a broken widget.
    queryRaw.mockRejectedValue(
      new Error('relation "currency_gold_indices" does not exist')
    );
    await expect(getCurrencyGoldIndexSnapshots()).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('degrades to empty when the sparkline read fails after the lookup succeeded', async () => {
    queryRaw.mockResolvedValueOnce([latestRow()]);
    findMany.mockRejectedValue(new Error('connection terminated'));
    await expect(getCurrencyGoldIndexSnapshots()).resolves.toEqual([]);
  });
});

describe('GET /api/market/currency-gold-indices', () => {
  beforeEach(() => {
    // resetAllMocks, not clearAllMocks -- see the sibling describe block's
    // own comment. A cache-HIT test never calls the database at all, which
    // would otherwise leave this beforeEach's two queued values unconsumed and
    // leaking into the next test (masked here only because every test
    // queues byte-identical fixture values, so the leak is invisible until
    // someone varies them).
    jest.resetAllMocks();
    queryRaw.mockResolvedValueOnce([latestRow()]);
    findMany.mockResolvedValueOnce([{ index_name: 'USDX', value: 100.14 }]);
  });

  it('requires no authentication (public route)', async () => {
    getCachedMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it('serves from cache on a hit without touching Postgres', async () => {
    const cachedPayload = [
      {
        symbol: 'USDX',
        price: 100.14,
        changePct: 0.14,
        previousClose: 100,
        sparkline: [100.14],
        barTime: BAR_TIME,
      },
    ];
    getCachedMock.mockResolvedValue(cachedPayload);

    const res = await GET();
    const body = (await res.json()) as { indices: unknown };

    expect(res.status).toBe(200);
    expect(body.indices).toEqual(cachedPayload);
    expect(queryRaw).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it('queries Postgres and populates the cache on a miss', async () => {
    getCachedMock.mockResolvedValue(null);

    const res = await GET();
    const body = (await res.json()) as { indices: unknown[] };

    expect(res.status).toBe(200);
    expect(body.indices).toHaveLength(1);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(cacheSetMock).toHaveBeenCalledWith(body.indices);
  });

  it('falls back to Postgres when the cache read itself throws (Redis outage)', async () => {
    getCachedMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await GET();
    const body = (await res.json()) as { indices: unknown[] };

    expect(res.status).toBe(200);
    expect(body.indices).toHaveLength(1);
  });

  it('still returns a correct response even if the cache WRITE fails', async () => {
    getCachedMock.mockResolvedValue(null);
    cacheSetMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await GET();
    expect(res.status).toBe(200);
  });

  it('uses a public, CDN-cacheable Cache-Control (no session, same response for everyone)', async () => {
    getCachedMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.headers.get('Cache-Control')).toContain('public');
    expect(res.headers.get('Cache-Control')).not.toContain('private');
  });

  describe('concurrent requests (one in-flight fill per process)', () => {
    it('shares one Postgres fill between requests that all miss the cache', async () => {
      getCachedMock.mockResolvedValue(null);
      queryRaw.mockReset();
      findMany.mockReset();
      const latest = deferred<unknown[]>();
      queryRaw.mockReturnValueOnce(latest.promise);
      findMany.mockResolvedValueOnce([{ index_name: 'USDX', value: 100.14 }]);

      const pending = [GET(), GET(), GET()];
      await flushPromises();
      latest.resolve([latestRow()]);
      const responses = await Promise.all(pending);
      const bodies = await Promise.all(responses.map((r) => r.json()));

      // one fill = the latest-bar lookup plus the sparkline read, once for all three
      expect(queryRaw).toHaveBeenCalledTimes(1);
      expect(findMany).toHaveBeenCalledTimes(1);
      expect(getCachedMock).toHaveBeenCalledTimes(1);
      expect(cacheSetMock).toHaveBeenCalledTimes(1);
      expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
      expect(bodies[1]).toEqual(bodies[0]);
      expect(bodies[2]).toEqual(bodies[0]);
      expect((bodies[0] as { indices: unknown[] }).indices).toHaveLength(1);
    });

    it('still shares one fill when Redis is down (one bounded cache wait, one Postgres read)', async () => {
      getCachedMock.mockRejectedValue(new Error('ECONNREFUSED'));
      queryRaw.mockReset();
      findMany.mockReset();
      const latest = deferred<unknown[]>();
      queryRaw.mockReturnValueOnce(latest.promise);
      findMany.mockResolvedValueOnce([{ index_name: 'USDX', value: 100.14 }]);

      const pending = [GET(), GET()];
      await flushPromises();
      latest.resolve([latestRow()]);
      const responses = await Promise.all(pending);

      expect(responses.map((r) => r.status)).toEqual([200, 200]);
      expect(getCachedMock).toHaveBeenCalledTimes(1);
      expect(queryRaw).toHaveBeenCalledTimes(1);
      expect(findMany).toHaveBeenCalledTimes(1);
    });

    it('keeps nothing after a fill: the next request starts its own', async () => {
      getCachedMock.mockResolvedValue(null);
      // beforeEach queued one full fill; queue a second one
      queryRaw.mockResolvedValueOnce([latestRow()]);
      findMany.mockResolvedValueOnce([{ index_name: 'USDX', value: 100.14 }]);

      await GET();
      await GET();

      expect(queryRaw).toHaveBeenCalledTimes(2);
      expect(findMany).toHaveBeenCalledTimes(2);
      expect(cacheSetMock).toHaveBeenCalledTimes(2);
    });
  });
});
