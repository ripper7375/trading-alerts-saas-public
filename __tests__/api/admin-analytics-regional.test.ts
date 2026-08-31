/**
 * Admin BI Dashboard 3 (Regional & Tax Surveillance) API Route Tests
 *
 * Boundary-level VAT alert-level and jurisdiction-resolution correctness
 * is covered by __tests__/lib/admin/analytics/jurisdictions.test.ts --
 * these tests focus on the route's own aggregation/assembly of the raw
 * query results into the final ranked response shape.
 *
 * @module __tests__/api/admin-analytics-regional.test.ts
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { getJurisdiction } from '@/lib/admin/analytics/jurisdictions';

jest.mock('next/server', () => ({
  __esModule: true,
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: async () => data,
      status: init?.status || 200,
    }),
  },
}));

const mockRequireAdmin = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  requireAdmin: () => mockRequireAdmin(),
}));

class MockAuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

jest.mock('@/lib/auth/errors', () => ({
  __esModule: true,
  AuthError: MockAuthError,
}));

jest.mock('next/cache', () => ({
  __esModule: true,
  unstable_cache: (fn: unknown) => fn,
}));

const mockQueryRawUnsafe = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    $queryRawUnsafe: (...args: unknown[]) => mockQueryRawUnsafe(...args),
  },
}));

describe('GET /api/admin/analytics/regional', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new MockAuthError('Unauthorized', 401));

    const { GET } = await import('@/app/api/admin/analytics/regional/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 when not admin', async () => {
    mockRequireAdmin.mockRejectedValue(new MockAuthError('Forbidden', 403));

    const { GET } = await import('@/app/api/admin/analytics/regional/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('should collapse mixed non-whitelisted country rows into a single summed OTHERS row and rank real countries by total users', async () => {
    mockRequireAdmin.mockResolvedValue(undefined);
    mockQueryRawUnsafe
      .mockResolvedValueOnce([
        {
          jurisdiction_iso: 'GB',
          total_users: 2890,
          free_users: 2480,
          pro_users: 410,
        },
        {
          jurisdiction_iso: 'TH',
          total_users: 3480,
          free_users: 3190,
          pro_users: 290,
        },
        // Simulates 4 mixed non-whitelisted/null rows already collapsed by
        // the SQL CASE WHEN into one OTHERS bucket (SQL-level correctness
        // itself is unit-tested in jurisdictions.test.ts).
        {
          jurisdiction_iso: 'OTHERS',
          total_users: 400,
          free_users: 400,
          pro_users: 0,
        },
      ])
      .mockResolvedValueOnce([
        { jurisdiction_iso: 'GB', trailing_12m_sales: 142500 },
        { jurisdiction_iso: 'TH', trailing_12m_sales: 68400 },
      ])
      // Deliberately smaller than the #16 merged figure above -- #17 is
      // Invoice-only (Stripe Tax/OSS scope), so it's a subset of #16's
      // Stripe+dLocal total, not the same number. Chosen to land inside
      // the LEVEL_1_WARN band at the live GB FX rate (jurisdictions.ts).
      .mockResolvedValueOnce([
        { jurisdiction_iso: 'GB', trailing_12m_sales: 75000 },
      ]);

    const { GET } = await import('@/app/api/admin/analytics/regional/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    // 17 jurisdictions + OTHERS, every one present even with zero data.
    expect(data.countryRankings).toHaveLength(18);

    const othersRow = data.countryRankings.find(
      (r: { isoCode: string }) => r.isoCode === 'OTHERS'
    );
    expect(othersRow.totalUsers).toBe(400);
    expect(othersRow.freeUsers).toBe(400);
    expect(othersRow.proUsers).toBe(0);

    // Ranked by total users descending: TH (3480) before GB (2890).
    const thIndex = data.countryRankings.findIndex(
      (r: { isoCode: string }) => r.isoCode === 'TH'
    );
    const gbIndex = data.countryRankings.findIndex(
      (r: { isoCode: string }) => r.isoCode === 'GB'
    );
    expect(thIndex).toBeLessThan(gbIndex);
    expect(data.countryRankings[thIndex].rank).toBe(1);

    const gbTax = data.taxSurveillance.find(
      (t: { isoCode: string }) => t.isoCode === 'GB'
    );
    const gbFxRate = getJurisdiction('GB')!.approxUsdFxRate;
    expect(gbTax.utilizationPct).toBeCloseTo(
      ((75000 * gbFxRate) / 90000) * 100,
      1
    );
    expect(gbTax.alertLevel).toBe('LEVEL_1_WARN');
  });

  it('should return an all-zero, non-crashing response on an empty database', async () => {
    mockRequireAdmin.mockResolvedValue(undefined);
    mockQueryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const { GET } = await import('@/app/api/admin/analytics/regional/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.countryRankings).toHaveLength(18);
    expect(
      data.countryRankings.every(
        (r: { totalUsers: number }) => r.totalUsers === 0
      )
    ).toBe(true);
    expect(data.donutMarketShare.allUsers).toHaveLength(18);
  });
});
