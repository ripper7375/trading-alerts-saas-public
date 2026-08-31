/**
 * Admin BI Dashboard 4 (Affiliate Partner Network) API Route Tests
 *
 * @module __tests__/api/admin-analytics-affiliates.test.ts
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

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

const mockGetReportingPeriod = jest.fn().mockReturnValue({
  start: new Date('2026-05-01T00:00:00Z'),
  end: new Date('2026-08-31T23:59:59Z'),
});
jest.mock('@/lib/admin/pnl-calculator', () => ({
  __esModule: true,
  getReportingPeriod: (...args: unknown[]) => mockGetReportingPeriod(...args),
}));

const mockAffiliateProfileFindMany = jest.fn();
const mockAffiliateCodeFindMany = jest.fn();
const mockCommissionFindMany = jest.fn();
const mockUserFindMany = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    affiliateProfile: {
      findMany: (...args: unknown[]) => mockAffiliateProfileFindMany(...args),
    },
    affiliateCode: {
      findMany: (...args: unknown[]) => mockAffiliateCodeFindMany(...args),
    },
    commission: {
      findMany: (...args: unknown[]) => mockCommissionFindMany(...args),
    },
    user: { findMany: (...args: unknown[]) => mockUserFindMany(...args) },
  },
}));

class MockRequest {
  nextUrl: URL;
  constructor(url: string) {
    this.nextUrl = new URL(url);
  }
}

const REAL_TEST_EMAIL = 'affiliate-partner-real-name@example.com';

describe('GET /api/admin/analytics/affiliates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetReportingPeriod.mockReturnValue({
      start: new Date('2026-05-01T00:00:00Z'),
      end: new Date('2026-08-31T23:59:59Z'),
    });
  });

  it('should return 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new MockAuthError('Unauthorized', 401));

    const { GET } = await import('@/app/api/admin/analytics/affiliates/route');
    const request = new MockRequest(
      'http://localhost/api/admin/analytics/affiliates'
    );
    const response = await GET(request as unknown as Request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 when not admin', async () => {
    mockRequireAdmin.mockRejectedValue(new MockAuthError('Forbidden', 403));

    const { GET } = await import('@/app/api/admin/analytics/affiliates/route');
    const request = new MockRequest(
      'http://localhost/api/admin/analytics/affiliates'
    );
    const response = await GET(request as unknown as Request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('should compute tier ratio, avg commission, and mask all partner PII on the leaderboard', async () => {
    mockRequireAdmin.mockResolvedValue(undefined);
    mockAffiliateProfileFindMany.mockResolvedValue([
      {
        id: 'profile-th-1',
        userId: 'user-1',
        country: 'TH',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        totalCodesUsed: 68,
        totalEarnings: 1572,
      },
      {
        id: 'profile-gb-1',
        userId: 'user-2',
        country: 'GB',
        createdAt: new Date('2026-06-15T00:00:00Z'),
        totalCodesUsed: 54,
        totalEarnings: 1254,
      },
    ]);
    mockAffiliateCodeFindMany.mockResolvedValue([
      { affiliateProfileId: 'profile-th-1', code: 'SOMCHAI30' },
      { affiliateProfileId: 'profile-gb-1', code: 'ALEXFX20' },
    ]);
    mockCommissionFindMany
      .mockResolvedValueOnce([
        {
          affiliateProfileId: 'profile-th-1',
          commissionAmount: 1572,
          grossRevenue: 5240,
          status: 'PAID',
        },
        {
          affiliateProfileId: 'profile-gb-1',
          commissionAmount: 1254,
          grossRevenue: 4180,
          status: 'APPROVED',
        },
      ])
      .mockResolvedValueOnce([
        { affiliateProfileId: 'profile-th-1', commissionAmount: 500 },
        { affiliateProfileId: 'profile-gb-1', commissionAmount: 300 },
      ]);
    mockUserFindMany.mockResolvedValue([
      { id: 'user-1', tier: 'PRO' },
      { id: 'user-2', tier: 'PRO' },
    ]);

    const { GET } = await import('@/app/api/admin/analytics/affiliates/route');
    const request = new MockRequest(
      'http://localhost/api/admin/analytics/affiliates?period=3months'
    );
    const response = await GET(request as unknown as Request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.summary.totalAffiliates).toBe(2);
    expect(data.summary.affiliateProCount).toBe(2);
    expect(data.summary.affiliateFreeCount).toBe(0);
    expect(data.summary.avgMonthlyCommission).toBe(400); // (500+300)/2

    expect(data.top20Leaderboard).toHaveLength(2);
    expect(data.top20Leaderboard[0].anonymizedPartnerId).toMatch(
      /^Partner #TH-\d{4}$/
    );
    expect(data.top20Leaderboard[0].commissionEarnedUsd).toBe(1572);

    const responseText = JSON.stringify(data);
    expect(responseText).not.toContain(REAL_TEST_EMAIL);
    expect(responseText).not.toContain('email');
    expect(responseText).not.toContain('fullName');
    for (const row of data.top20Leaderboard) {
      expect(Object.keys(row)).not.toContain('email');
      expect(Object.keys(row)).not.toContain('fullName');
      expect(Object.keys(row)).not.toContain('userId');
    }
  });

  it('should return avgMonthlyCommission: 0 (not NaN) on an empty database', async () => {
    mockRequireAdmin.mockResolvedValue(undefined);
    mockAffiliateProfileFindMany.mockResolvedValue([]);
    mockAffiliateCodeFindMany.mockResolvedValue([]);
    mockCommissionFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockUserFindMany.mockResolvedValue([]);

    const { GET } = await import('@/app/api/admin/analytics/affiliates/route');
    const request = new MockRequest(
      'http://localhost/api/admin/analytics/affiliates'
    );
    const response = await GET(request as unknown as Request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.summary.avgMonthlyCommission).toBe(0);
    expect(data.summary.totalAffiliates).toBe(0);
    expect(data.top20Leaderboard).toEqual([]);
  });
});
