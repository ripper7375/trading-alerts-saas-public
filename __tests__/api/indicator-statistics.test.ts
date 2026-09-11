/**
 * Indicator statistics (Containment Rate): read layer + API route.
 *
 * Two things are worth protecting here, mirroring economic-events.test.ts.
 * The read layer must collapse an append-only table to the NEWEST
 * observation per (symbol, timeframe, source) -- without that, a stale
 * capture from hours ago can outrank a fresh one. And the route must not
 * refuse a user who has just paid for PRO, which is what a JWT-only tier
 * check does.
 */
// NOTE: 'jest' is deliberately NOT imported from @jest/globals -- see
// economic-events.test.ts's own header for why.
import { describe, it, expect, beforeEach } from '@jest/globals';

// Factories must not reference out-of-scope variables, or babel-jest declines
// to hoist them -- the mock then registers AFTER the imports and the REAL
// Prisma client runs, which would attempt a genuine TLS connection.
jest.mock('@/lib/db/market-prisma', () => ({
  marketPrisma: { indicatorStatistic: { findMany: jest.fn() } },
}));
jest.mock('@/lib/db/prisma', () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/auth/permissions', () => ({ hasPermission: jest.fn() }));

import { getServerSession } from 'next-auth';

import { marketPrisma } from '@/lib/db/market-prisma';
import { prisma } from '@/lib/db/prisma';
import { hasPermission } from '@/lib/auth/permissions';
import { getLatestContainmentRates } from '@/lib/indicator-statistics/queries';
import { GET } from '@/app/api/market/indicator-statistics/route';

const findMany = marketPrisma.indicatorStatistic
  .findMany as unknown as jest.Mock;
const findUniqueUser = prisma.user.findUnique as unknown as jest.Mock;
const hasPermissionMock = hasPermission as unknown as jest.Mock;
// next-auth is already mocked globally in jest.setup.js; reuse that handle
// rather than registering a competing mock for the same module.
const getServerSessionMock = getServerSession as unknown as jest.Mock;

function dbRow(overrides: Record<string, unknown> = {}) {
  return {
    symbol: 'XAUUSD',
    timeframe: 'M15',
    source: 'best_fit_a',
    captured_at: 1768392000,
    containment_rate: 94.2,
    containment_count: 47,
    containment_n: 50,
    ...overrides,
  };
}

describe('getLatestContainmentRates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('asks the database to collapse to the newest observation per group', async () => {
    findMany.mockResolvedValue([]);
    await getLatestContainmentRates();

    const args = findMany.mock.calls[0]?.[0] as Record<string, unknown>;
    // Without distinct on this key, a stale capture from hours ago can
    // outrank a fresh one.
    expect(args['distinct']).toEqual(['symbol', 'timeframe', 'source']);
    expect(args['orderBy']).toEqual([
      { symbol: 'asc' },
      { timeframe: 'asc' },
      { source: 'asc' },
      { captured_at: 'desc' },
    ]);
  });

  it('maps a real row through, containment_rate included', async () => {
    findMany.mockResolvedValue([dbRow()]);
    const [rate] = await getLatestContainmentRates();

    expect(rate).toEqual({
      symbol: 'XAUUSD',
      timeframe: 'M15',
      source: 'best_fit_a',
      capturedAt: 1768392000,
      containmentRate: 94.2,
      containmentCount: 47,
      containmentN: 50,
    });
  });

  it('keeps a genuinely missing containment_rate as null, not 0', async () => {
    // A source whose capture predates the EDT Channel block, or whose
    // fields simply were not populated this cycle -- must not read as
    // "0% contained", which would be a fabricated reading.
    findMany.mockResolvedValue([
      dbRow({ containment_rate: null, containment_count: null }),
    ]);
    const [rate] = await getLatestContainmentRates();
    expect(rate?.containmentRate).toBeNull();
  });

  it('degrades to empty when the table does not exist yet', async () => {
    // The migration is applied separately from the deploy, same as
    // economic_events; an unbuilt or not-yet-flowing lane must render as
    // "nothing yet", not as a broken panel.
    findMany.mockRejectedValue(
      new Error('relation "indicator_statistics" does not exist')
    );
    await expect(getLatestContainmentRates()).resolves.toEqual([]);
  });
});

describe('GET /api/market/indicator-statistics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([dbRow()]);
  });

  it('401s an anonymous caller', async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('serves a PRO user whose token already says PRO', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', tier: 'PRO' } });
    hasPermissionMock.mockReturnValue(true);

    const res = await GET();
    expect(res.status).toBe(200);
    // The token sufficed, so no database round trip was needed.
    expect(findUniqueUser).not.toHaveBeenCalled();
    expect((await res.json()).rates).toHaveLength(1);
  });

  it('serves a user who JUST upgraded, whose token is still stale', async () => {
    // The whole reason this route re-checks the database instead of using
    // requirePro(): a JWT-only check refuses a feature the user has paid for.
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', tier: 'FREE' },
    });
    hasPermissionMock.mockReturnValue(false);
    findUniqueUser.mockResolvedValue({ tier: 'PRO' });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(findUniqueUser).toHaveBeenCalled();
  });

  it('403s a genuine FREE user', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', tier: 'FREE' },
    });
    hasPermissionMock.mockReturnValue(false);
    findUniqueUser.mockResolvedValue({ tier: 'FREE' });

    const res = await GET();
    expect(res.status).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('does not cache across users', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', tier: 'PRO' } });
    hasPermissionMock.mockReturnValue(true);

    const res = await GET();
    expect(res.headers.get('Cache-Control')).toContain('private');
  });
});
