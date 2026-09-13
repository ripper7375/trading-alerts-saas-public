/**
 * XAUX vs USDX Comparison Chart: read layer + public API route.
 *
 * Mirrors __tests__/api/currency-gold-indices.test.ts's own structure
 * (public route, no session test, cache hit/miss/outage coverage) for this
 * lane's second public route.
 */
// NOTE: 'jest' is deliberately NOT imported from @jest/globals -- see
// __tests__/api/economic-events.test.ts's own header for why (factories are
// hoisted above imports; an imported 'jest' binding is in TDZ when a factory
// runs).
jest.mock('@/lib/db/market-prisma', () => ({
  marketPrisma: { currencyGoldIndex: { findMany: jest.fn() } },
}));
jest.mock('@/lib/cache/cache-manager', () => ({
  getCachedCurrencyGoldIndexHistory: jest.fn(),
  cacheCurrencyGoldIndexHistory: jest.fn(),
}));

import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

import { marketPrisma } from '@/lib/db/market-prisma';
import {
  getCachedCurrencyGoldIndexHistory,
  cacheCurrencyGoldIndexHistory,
} from '@/lib/cache/cache-manager';
import { getCurrencyGoldIndexHistory } from '@/lib/currency-gold-indices/queries';
import { GET } from '@/app/api/market/currency-gold-indices/history/route';

const findMany = marketPrisma.currencyGoldIndex
  .findMany as unknown as jest.Mock;
const getCachedMock = getCachedCurrencyGoldIndexHistory as unknown as jest.Mock;
const cacheSetMock = cacheCurrencyGoldIndexHistory as unknown as jest.Mock;

const SESSION_OPEN = 1_800_000_000;

function row(barTime: number, value: number) {
  return { bar_time: barTime, value, session_open_bar_time: SESSION_OPEN };
}

function makeRequest(timeframe?: string): NextRequest {
  const url = timeframe
    ? `http://localhost/api/market/currency-gold-indices/history?timeframe=${timeframe}`
    : 'http://localhost/api/market/currency-gold-indices/history';
  return new NextRequest(url);
}

describe('getCurrencyGoldIndexHistory', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('queries both XAUX and USDX independently', async () => {
    findMany.mockResolvedValue([]);
    await getCurrencyGoldIndexHistory('M5');

    expect(findMany).toHaveBeenCalledTimes(2);
    const indexNames = findMany.mock.calls.map(
      (call) => (call[0] as { where: { index_name: string } }).where.index_name
    );
    expect(indexNames.sort()).toEqual(['USDX', 'XAUX']);
  });

  it('reads rows newest-first and returns them ascending by time (M5)', async () => {
    findMany.mockResolvedValue([
      row(SESSION_OPEN + 600, 100.2),
      row(SESSION_OPEN + 300, 100.1),
      row(SESSION_OPEN, 100.0),
    ]);

    const [series] = await getCurrencyGoldIndexHistory('M5');
    expect(series?.bars.map((b) => b.barTime)).toEqual([
      SESSION_OPEN,
      SESSION_OPEN + 300,
      SESSION_OPEN + 600,
    ]);
  });

  it('filters down to M15-close bars only when timeframe is M15', async () => {
    // Prisma returns newest-first (orderBy bar_time desc); the query
    // function reverses this to ascending -- so the mock must supply
    // DESCENDING order, matching what a real query would return.
    findMany.mockResolvedValue(
      [1500, 1200, 900, 600, 300, 0].map((offset) =>
        row(SESSION_OPEN + offset, 100 + offset / 1000)
      )
    );

    const [series] = await getCurrencyGoldIndexHistory('M15');
    // Only offsets 600 and 1500 are M15-close bars (see history.test.ts).
    expect(series?.bars).toHaveLength(2);
    expect(series?.bars.map((b) => b.barTime)).toEqual([
      SESSION_OPEN + 600,
      SESSION_OPEN + 1500,
    ]);
  });

  it("requests roughly 3x the raw M5 row limit when the timeframe is M15 (there's no OHLC to resample)", async () => {
    findMany.mockResolvedValue([]);
    await getCurrencyGoldIndexHistory('M15');

    const takeValues = findMany.mock.calls.map(
      (call) => (call[0] as { take: number }).take
    );
    expect(takeValues).toEqual([9000, 9000]);
  });

  it('caps M5 requests at the 3000-bar limit', async () => {
    findMany.mockResolvedValue([]);
    await getCurrencyGoldIndexHistory('M5');

    const takeValues = findMany.mock.calls.map(
      (call) => (call[0] as { take: number }).take
    );
    expect(takeValues).toEqual([3000, 3000]);
  });

  it('degrades one index to an empty series on a query failure without affecting the other', async () => {
    findMany
      .mockRejectedValueOnce(new Error('relation does not exist'))
      .mockResolvedValueOnce([row(SESSION_OPEN, 100.0)]);

    const series = await getCurrencyGoldIndexHistory('M5');
    const bySymbol = new Map(series.map((s) => [s.symbol, s.bars]));

    // Whichever index the mock rejected for is empty; the other still has data.
    const emptyCount = [...bySymbol.values()].filter(
      (bars) => bars.length === 0
    ).length;
    const nonEmptyCount = [...bySymbol.values()].filter(
      (bars) => bars.length > 0
    ).length;
    expect(emptyCount).toBe(1);
    expect(nonEmptyCount).toBe(1);
  });
});

describe('GET /api/market/currency-gold-indices/history', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    findMany.mockResolvedValue([row(SESSION_OPEN, 100.0)]);
  });

  it('requires no authentication (public route)', async () => {
    getCachedMock.mockResolvedValue(null);
    const res = await GET(makeRequest('M5'));
    expect(res.status).toBe(200);
  });

  it('defaults to M15 when no timeframe query param is given', async () => {
    getCachedMock.mockResolvedValue(null);
    const res = await GET(makeRequest());
    const body = (await res.json()) as { timeframe: string };
    expect(body.timeframe).toBe('M15');
  });

  it('rejects an invalid timeframe value by falling back to M15', async () => {
    getCachedMock.mockResolvedValue(null);
    const res = await GET(makeRequest('bogus'));
    const body = (await res.json()) as { timeframe: string };
    expect(body.timeframe).toBe('M15');
  });

  it('serves from cache on a hit without touching Postgres', async () => {
    const cachedPayload = [{ symbol: 'XAUX', bars: [] }];
    getCachedMock.mockResolvedValue(cachedPayload);

    const res = await GET(makeRequest('M5'));
    const body = (await res.json()) as { series: unknown };

    expect(res.status).toBe(200);
    expect(body.series).toEqual(cachedPayload);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('queries Postgres and populates the cache on a miss', async () => {
    getCachedMock.mockResolvedValue(null);

    const res = await GET(makeRequest('M15'));
    const body = (await res.json()) as { series: unknown[] };

    expect(res.status).toBe(200);
    expect(findMany).toHaveBeenCalled();
    expect(cacheSetMock).toHaveBeenCalledWith('M15', body.series);
  });

  it('falls back to Postgres when the cache read itself throws (Redis outage)', async () => {
    getCachedMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await GET(makeRequest('M5'));
    expect(res.status).toBe(200);
    expect(findMany).toHaveBeenCalled();
  });

  it('still returns a correct response even if the cache WRITE fails', async () => {
    getCachedMock.mockResolvedValue(null);
    cacheSetMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await GET(makeRequest('M5'));
    expect(res.status).toBe(200);
  });

  it('uses a public, CDN-cacheable Cache-Control (no session, same response for everyone)', async () => {
    getCachedMock.mockResolvedValue(null);
    const res = await GET(makeRequest('M5'));
    expect(res.headers.get('Cache-Control')).toContain('public');
    expect(res.headers.get('Cache-Control')).not.toContain('private');
  });
});
