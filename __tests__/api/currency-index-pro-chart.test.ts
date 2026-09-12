// NOTE: 'jest' is deliberately NOT imported from @jest/globals -- mirrors
// indicator-statistics.test.ts's own header for why (a hoisted mock factory
// must use the injected global, not an imported binding still in TDZ).
import { describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('@/lib/db/market-prisma', () => ({
  marketPrisma: {
    currencyGoldIndex: { findMany: jest.fn() },
    dailyVolatilityCorridor: { findFirst: jest.fn() },
    economicEvent: { findMany: jest.fn() },
  },
}));
jest.mock('@/lib/db/prisma', () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/auth/permissions', () => ({ hasPermission: jest.fn() }));

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { marketPrisma } from '@/lib/db/market-prisma';
import { prisma } from '@/lib/db/prisma';
import { hasPermission } from '@/lib/auth/permissions';
import { GET } from '@/app/api/market/currency-index-pro/chart/route';

const findManyCgi = marketPrisma.currencyGoldIndex
  .findMany as unknown as jest.Mock;
const findFirstCorridor = marketPrisma.dailyVolatilityCorridor
  .findFirst as unknown as jest.Mock;
const findManyEvents = marketPrisma.economicEvent
  .findMany as unknown as jest.Mock;
const findUniqueUser = prisma.user.findUnique as unknown as jest.Mock;
const hasPermissionMock = hasPermission as unknown as jest.Mock;
const getServerSessionMock = getServerSession as unknown as jest.Mock;

function makeRequest(query = ''): NextRequest {
  return new NextRequest(
    `http://localhost/api/market/currency-index-pro/chart${query}`
  );
}

describe('GET /api/market/currency-index-pro/chart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findManyCgi.mockResolvedValue([]); // no Lane 4 data -> empty series, not a crash
    findFirstCorridor.mockResolvedValue(null);
    findManyEvents.mockResolvedValue([]);
  });

  it('401s an anonymous caller', async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(findManyCgi).not.toHaveBeenCalled();
  });

  it('serves a PRO user whose token already says PRO', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', tier: 'PRO' } });
    hasPermissionMock.mockReturnValue(true);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(findUniqueUser).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.timeframe).toBe('M15');
    expect(body.series).toBeDefined();
  });

  it('serves a user who JUST upgraded, whose token is still stale', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', tier: 'FREE' },
    });
    hasPermissionMock.mockReturnValue(false);
    findUniqueUser.mockResolvedValue({ tier: 'PRO' });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(findUniqueUser).toHaveBeenCalled();
  });

  it('403s a genuine FREE user', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', tier: 'FREE' },
    });
    hasPermissionMock.mockReturnValue(false);
    findUniqueUser.mockResolvedValue({ tier: 'FREE' });

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    expect(findManyCgi).not.toHaveBeenCalled();
  });

  it('does not cache across users', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', tier: 'PRO' } });
    hasPermissionMock.mockReturnValue(true);

    const res = await GET(makeRequest());
    expect(res.headers.get('Cache-Control')).toContain('private');
  });

  it('defaults to M15 and respects an explicit ?timeframe=M5', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', tier: 'PRO' } });
    hasPermissionMock.mockReturnValue(true);

    const res = await GET(makeRequest('?timeframe=M5'));
    const body = await res.json();
    expect(body.timeframe).toBe('M5');
  });

  it('degrades to an empty response, not a crash, when Lane 4 has no data pushed yet', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', tier: 'PRO' } });
    hasPermissionMock.mockReturnValue(true);

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.corridor).toBeNull();
    expect(body.todaySessionOpen).toBeNull();
    expect(body.highImpactNews).toEqual([]);
    expect(body.series.USDX).toEqual([]);
  });
});
