import { describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('@/lib/db/market-prisma', () => ({
  marketPrisma: {
    currencyGoldIndex: { findMany: jest.fn() },
    dailyVolatilityCorridor: { findFirst: jest.fn() },
  },
}));
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    userCurrencyIndexPreference: { findUnique: jest.fn() },
  },
}));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/auth/permissions', () => ({ hasPermission: jest.fn() }));

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { marketPrisma } from '@/lib/db/market-prisma';
import { prisma } from '@/lib/db/prisma';
import { hasPermission } from '@/lib/auth/permissions';
import { GET } from '@/app/api/market/currency-index-pro/detail/route';

const findManyCgi = marketPrisma.currencyGoldIndex
  .findMany as unknown as jest.Mock;
const findFirstCorridor = marketPrisma.dailyVolatilityCorridor
  .findFirst as unknown as jest.Mock;
const findUniqueUser = prisma.user.findUnique as unknown as jest.Mock;
const findUniquePreference = prisma.userCurrencyIndexPreference
  .findUnique as unknown as jest.Mock;
const hasPermissionMock = hasPermission as unknown as jest.Mock;
const getServerSessionMock = getServerSession as unknown as jest.Mock;

function makeRequest(query = ''): NextRequest {
  return new NextRequest(
    `http://localhost/api/market/currency-index-pro/detail${query}`
  );
}

describe('GET /api/market/currency-index-pro/detail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findManyCgi.mockResolvedValue([]);
    findFirstCorridor.mockResolvedValue(null);
    findUniquePreference.mockResolvedValue(null);
  });

  it('401s an anonymous caller', async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await GET(makeRequest('?currency=EUR'));
    expect(res.status).toBe(401);
    expect(findManyCgi).not.toHaveBeenCalled();
  });

  it('400s a missing or invalid currency', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', tier: 'PRO' } });
    hasPermissionMock.mockReturnValue(true);

    const missing = await GET(makeRequest());
    expect(missing.status).toBe(400);

    const invalid = await GET(makeRequest('?currency=XAU'));
    expect(invalid.status).toBe(400);
    expect(findManyCgi).not.toHaveBeenCalled();
  });

  it('403s a genuine FREE user', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', tier: 'FREE' },
    });
    hasPermissionMock.mockReturnValue(false);
    findUniqueUser.mockResolvedValue({ tier: 'FREE' });

    const res = await GET(makeRequest('?currency=EUR'));
    expect(res.status).toBe(403);
    expect(findManyCgi).not.toHaveBeenCalled();
  });

  it('serves a user whose token is stale but the DB confirms PRO', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', tier: 'FREE' },
    });
    hasPermissionMock.mockReturnValue(false);
    findUniqueUser.mockResolvedValue({ tier: 'PRO' });

    const res = await GET(makeRequest('?currency=EUR'));
    expect(res.status).toBe(200);
  });

  it('returns an empty series, not a crash, when Lane 4 has no data for this index yet', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', tier: 'PRO' } });
    hasPermissionMock.mockReturnValue(true);

    const res = await GET(makeRequest('?currency=EUR'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.currency).toBe('EUR');
    expect(body.indexName).toBe('EURX');
    expect(body.series).toEqual([]);
    expect(body.signal).toBe('NONE');
    expect(body.corridor).toBeNull();
  });

  it("scopes minBarsForSignal to the requesting user's own periods", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', tier: 'PRO' } });
    hasPermissionMock.mockReturnValue(true);
    findUniquePreference.mockResolvedValue({
      lookbackDays: 20,
      useAutoZones: true,
      customObPct: null,
      customOsPct: null,
      hrmaPeriod: 50,
      smmaPeriod: 20,
      preferredTf: 'M15',
    });

    const res = await GET(makeRequest('?currency=JPY'));
    const body = await res.json();
    expect(body.minBarsForSignal).toBe(50); // max(50, 20)
  });

  it('echoes the exact hrmaPeriod/smmaPeriod used, so the client what-if sliders have a real starting value', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', tier: 'PRO' } });
    hasPermissionMock.mockReturnValue(true);
    findUniquePreference.mockResolvedValue({
      lookbackDays: 20,
      useAutoZones: true,
      customObPct: null,
      customOsPct: null,
      hrmaPeriod: 50,
      smmaPeriod: 20,
      preferredTf: 'M15',
    });

    const res = await GET(makeRequest('?currency=JPY'));
    const body = await res.json();
    expect(body.hrmaPeriod).toBe(50);
    expect(body.smmaPeriod).toBe(20);
  });

  it('does not cache across users', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', tier: 'PRO' } });
    hasPermissionMock.mockReturnValue(true);

    const res = await GET(makeRequest('?currency=EUR'));
    expect(res.headers.get('Cache-Control')).toContain('private');
  });
});
