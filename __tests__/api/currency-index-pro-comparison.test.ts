/**
 * Currency Index Comparison (PRO): read layer + API route.
 *
 * PRO-gate cases mirror currency-index-pro-detail.test.ts; cache cases mirror
 * currency-gold-indices-history.test.ts.
 */
// NOTE: 'jest' is deliberately NOT imported from @jest/globals -- see
// __tests__/api/economic-events.test.ts's own header (hoisted factories run
// while an imported binding is still in TDZ).
jest.mock('@/lib/db/market-prisma', () => ({
  marketPrisma: { currencyGoldIndex: { findMany: jest.fn() } },
}));
jest.mock('@/lib/db/prisma', () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/auth/permissions', () => ({ hasPermission: jest.fn() }));
jest.mock('@/lib/cache/cache-manager', () => ({
  getCachedCurrencyIndexComparison: jest.fn(),
  cacheCurrencyIndexComparison: jest.fn(),
}));

import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { marketPrisma } from '@/lib/db/market-prisma';
import { prisma } from '@/lib/db/prisma';
import { hasPermission } from '@/lib/auth/permissions';
import {
  cacheCurrencyIndexComparison,
  getCachedCurrencyIndexComparison,
} from '@/lib/cache/cache-manager';
import { getComparisonCandles } from '@/lib/currency-index-comparison/queries';
import { GET } from '@/app/api/market/currency-index-pro/comparison/route';

const findMany = marketPrisma.currencyGoldIndex
  .findMany as unknown as jest.Mock;
const findUniqueUser = prisma.user.findUnique as unknown as jest.Mock;
const hasPermissionMock = hasPermission as unknown as jest.Mock;
const getServerSessionMock = getServerSession as unknown as jest.Mock;
const getCachedMock = getCachedCurrencyIndexComparison as unknown as jest.Mock;
const cacheSetMock = cacheCurrencyIndexComparison as unknown as jest.Mock;

const SESSION = 1_800_000_000;

/** A stored row, newest-first order is the caller's job. */
function row(
  barTime: number,
  value: number,
  ohlc: { open: number | null; high: number | null; low: number | null } = {
    open: value - 0.05,
    high: value + 0.1,
    low: value - 0.1,
  }
) {
  return {
    bar_time: barTime,
    session_open_bar_time: SESSION,
    value,
    ...ohlc,
  };
}

function makeRequest(query: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/market/currency-index-pro/comparison${query}`
  );
}

function asPro(): void {
  getServerSessionMock.mockResolvedValue({ user: { id: 'u1', tier: 'PRO' } });
  hasPermissionMock.mockReturnValue(true);
}

describe('getComparisonCandles', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('reads one index newest-first, returns ascending candles with OHLC from the row', async () => {
    findMany.mockResolvedValue([row(SESSION + 300, 100.2), row(SESSION, 100)]);

    const candles = await getComparisonCandles('EURX', 'M5');

    const args = findMany.mock.calls[0]![0] as {
      where: { index_name: string };
      orderBy: { bar_time: string };
      take: number;
    };
    expect(args.where.index_name).toBe('EURX');
    expect(args.orderBy.bar_time).toBe('desc');
    expect(args.take).toBe(3000);
    expect(candles.map((c) => c.time)).toEqual([SESSION, SESSION + 300]);
    expect(candles[1]!.close).toBeCloseTo(100.2, 10);
    expect(candles[1]!.high).toBeCloseTo(100.3, 10);
    expect(candles[1]!.low).toBeCloseTo(100.1, 10);
  });

  it('reads 3x the candle cap (+3 spare) for M15', async () => {
    findMany.mockResolvedValue([]);
    await getComparisonCandles('XAUX', 'M15');
    expect((findMany.mock.calls[0]![0] as { take: number }).take).toBe(9003);
  });

  it('degrades to [] on a query failure', async () => {
    findMany.mockRejectedValue(new Error('relation does not exist'));
    await expect(getComparisonCandles('USDX', 'M5')).resolves.toEqual([]);
  });
});

describe('GET /api/market/currency-index-pro/comparison', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    findMany.mockResolvedValue([]);
    getCachedMock.mockResolvedValue(null);
  });

  it('401s an anonymous caller without touching the database', async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await GET(makeRequest('?indices=EURX'));
    expect(res.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('403s a genuine FREE user', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', tier: 'FREE' },
    });
    hasPermissionMock.mockReturnValue(false);
    findUniqueUser.mockResolvedValue({ tier: 'FREE' });

    const res = await GET(makeRequest('?indices=EURX'));
    expect(res.status).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('serves a user whose token is stale but the DB confirms PRO', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', tier: 'FREE' },
    });
    hasPermissionMock.mockReturnValue(false);
    findUniqueUser.mockResolvedValue({ tier: 'PRO' });

    const res = await GET(makeRequest('?indices=EURX'));
    expect(res.status).toBe(200);
  });

  it.each([
    ['missing', ''],
    ['empty', '?indices='],
    ['unknown index', '?indices=DXY'],
    ['more than 2', '?indices=EURX,JPYX,GBPX'],
    ['one valid, one unknown', '?indices=EURX,BTCX'],
  ])('400s %s indices', async (_label, query) => {
    asPro();
    const res = await GET(makeRequest(query));
    expect(res.status).toBe(400);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('accepts any mix of 2 of the 9 indices, in the requested order, case-insensitively', async () => {
    asPro();
    const res = await GET(makeRequest('?indices=audx,XAUX&timeframe=M5'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.timeframe).toBe('M5');
    expect(body.series.map((s: { symbol: string }) => s.symbol)).toEqual([
      'AUDX',
      'XAUX',
    ]);
  });

  it('collapses a duplicated index to one series', async () => {
    asPro();
    const body = await (await GET(makeRequest('?indices=EURX,EURX'))).json();
    expect(body.series).toHaveLength(1);
  });

  it('defaults to M15', async () => {
    asPro();
    const body = await (await GET(makeRequest('?indices=EURX'))).json();
    expect(body.timeframe).toBe('M15');
  });

  it('serves from cache without touching Postgres', async () => {
    asPro();
    const cached = [{ time: 1, open: 1, high: 1, low: 1, close: 1 }];
    getCachedMock.mockResolvedValue(cached);

    const body = await (
      await GET(makeRequest('?indices=EURX&timeframe=M5'))
    ).json();
    expect(body.series[0].candles).toEqual(cached);
    expect(findMany).not.toHaveBeenCalled();
    expect(getCachedMock).toHaveBeenCalledWith('EURX', 'M5');
  });

  it('on a miss, reads Postgres, rounds to 4 decimals, and writes the cache', async () => {
    asPro();
    findMany.mockResolvedValue([
      row(SESSION, 100.123456789, {
        open: 100.1,
        high: 100.2000049,
        low: 99.99999,
      }),
    ]);

    const body = await (
      await GET(makeRequest('?indices=JPYX&timeframe=M5'))
    ).json();
    expect(body.series[0].candles[0]).toEqual({
      time: SESSION,
      open: 100.1,
      high: 100.2,
      low: 100,
      close: 100.1235,
    });
    expect(cacheSetMock).toHaveBeenCalledWith(
      'JPYX',
      'M5',
      body.series[0].candles
    );
  });

  it('falls back to Postgres when Redis is down, for both read and write', async () => {
    asPro();
    getCachedMock.mockRejectedValue(new Error('ECONNREFUSED'));
    cacheSetMock.mockRejectedValue(new Error('ECONNREFUSED'));
    findMany.mockResolvedValue([row(SESSION, 100)]);

    const res = await GET(makeRequest('?indices=EURX&timeframe=M5'));
    expect(res.status).toBe(200);
    expect((await res.json()).series[0].candles).toHaveLength(1);
  });

  it('is private, never publicly cached', async () => {
    asPro();
    const res = await GET(makeRequest('?indices=EURX'));
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=30');
  });
});
