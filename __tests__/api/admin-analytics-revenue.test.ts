/**
 * Admin BI Dashboard 1 (Revenue & Growth) API Route Tests
 *
 * @module __tests__/api/admin-analytics-revenue.test.ts
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

// unstable_cache is transparent in tests -- the underlying fetch function
// runs directly, no cache-store dependency on a live Next.js request scope.
jest.mock('next/cache', () => ({
  __esModule: true,
  unstable_cache: (fn: unknown) => fn,
}));

const mockQueryRaw = jest.fn();
const mockUserCount = jest.fn();
const mockSubscriptionFindMany = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    user: {
      count: (...args: unknown[]) => mockUserCount(...args),
    },
    subscription: {
      findMany: (...args: unknown[]) => mockSubscriptionFindMany(...args),
    },
  },
}));

// SystemConfig prices (monthly $29, annual $290)
jest.mock('@/lib/affiliate/db', () => ({
  __esModule: true,
  getBasePriceUsd: jest.fn().mockResolvedValue(29),
  getAnnualPriceUsd: jest.fn().mockResolvedValue(290),
}));

class MockRequest {
  nextUrl: URL;
  constructor(url: string) {
    this.nextUrl = new URL(url);
  }
}

describe('GET /api/admin/analytics/revenue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // No annual subscribers unless a test says otherwise
    mockSubscriptionFindMany.mockResolvedValue([]);
  });

  it('should return 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new MockAuthError('Unauthorized', 401));

    const { GET } = await import('@/app/api/admin/analytics/revenue/route');
    const request = new MockRequest(
      'http://localhost/api/admin/analytics/revenue'
    );
    const response = await GET(request as unknown as Request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 when not admin', async () => {
    mockRequireAdmin.mockRejectedValue(new MockAuthError('Forbidden', 403));

    const { GET } = await import('@/app/api/admin/analytics/revenue/route');
    const request = new MockRequest(
      'http://localhost/api/admin/analytics/revenue'
    );
    const response = await GET(request as unknown as Request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('should compute MoM/YoY growth from merged Stripe+dLocal revenue', async () => {
    mockRequireAdmin.mockResolvedValue(undefined);
    mockUserCount.mockResolvedValue(1690);
    mockQueryRaw
      .mockResolvedValueOnce([
        {
          month_date: new Date('2026-08-01T00:00:00Z'),
          current_revenue: 48920,
          transaction_count: 612,
          prev_month_revenue: 42150,
          prev_year_revenue: 34090,
        },
        {
          month_date: new Date('2026-07-01T00:00:00Z'),
          current_revenue: 42150,
          transaction_count: 528,
          prev_month_revenue: 38400,
          prev_year_revenue: 30120,
        },
      ])
      .mockResolvedValueOnce([
        {
          quarter_date: new Date('2026-07-01T00:00:00Z'),
          current_revenue: 134850,
          prev_quarter_revenue: 118200,
          prev_year_revenue: 97570,
        },
      ]);

    const { GET } = await import('@/app/api/admin/analytics/revenue/route');
    const request = new MockRequest(
      'http://localhost/api/admin/analytics/revenue?timeframe=6M'
    );
    const response = await GET(request as unknown as Request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.summary.currentMonthSales).toBe(48920);
    expect(data.summary.momGrowthPct).toBeCloseTo(16.06, 1);
    expect(data.summary.monthlyYoYGrowthPct).toBeCloseTo(43.5, 1);
    expect(data.summary.currentQuarterSales).toBe(134850);
    expect(data.summary.qoqGrowthPct).toBeCloseTo(14.09, 1);
    expect(data.summary.mrr).toBe(1690 * 29);
    expect(data.summary.arr).toBe(1690 * 29 * 12);
    expect(data.monthlyTrailing).toHaveLength(2);
  });

  it('weights annual subscribers at the annual price / 12', async () => {
    mockRequireAdmin.mockResolvedValue(undefined);
    mockSubscriptionFindMany.mockResolvedValue([
      { userId: 'u1' },
      { userId: 'u2' },
      { userId: 'u3' },
    ]);
    // 10 PRO users in total; 3 of them are on the annual plan
    mockUserCount.mockImplementation(
      async (args?: { where?: { id?: unknown } }) => (args?.where?.id ? 3 : 10)
    );
    mockQueryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const { GET } = await import('@/app/api/admin/analytics/revenue/route');
    const request = new MockRequest(
      'http://localhost/api/admin/analytics/revenue'
    );
    const response = await GET(request as unknown as Request);
    const data = await response.json();

    // 7 x $29 + 3 x $290 / 12 = 203 + 72.5
    expect(data.summary.mrr).toBe(275.5);
    expect(data.summary.arr).toBe(3306);
    expect(mockSubscriptionFindMany).toHaveBeenCalledWith({
      where: { planType: 'YEARLY' },
      select: { userId: true },
    });
    expect(mockUserCount).toHaveBeenCalledWith({
      where: { tier: 'PRO', id: { in: ['u1', 'u2', 'u3'] } },
    });
  });

  it('should return null deltas (not crash or NaN) on an empty database', async () => {
    mockRequireAdmin.mockResolvedValue(undefined);
    mockUserCount.mockResolvedValue(0);
    mockQueryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const { GET } = await import('@/app/api/admin/analytics/revenue/route');
    const request = new MockRequest(
      'http://localhost/api/admin/analytics/revenue'
    );
    const response = await GET(request as unknown as Request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.summary.currentMonthSales).toBe(0);
    expect(data.summary.momGrowthPct).toBeNull();
    expect(data.summary.monthlyYoYGrowthPct).toBeNull();
    expect(data.summary.mrr).toBe(0);
    expect(data.monthlyTrailing).toEqual([]);
  });
});
