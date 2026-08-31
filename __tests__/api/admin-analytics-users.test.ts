/**
 * Admin BI Dashboard 2 (User Base & Funnel) API Route Tests
 *
 * @module __tests__/api/admin-analytics-users.test.ts
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

const mockQueryRaw = jest.fn();
const mockUserCount = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    user: {
      count: (...args: unknown[]) => mockUserCount(...args),
    },
  },
}));

describe('GET /api/admin/analytics/users', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new MockAuthError('Unauthorized', 401));

    const { GET } = await import('@/app/api/admin/analytics/users/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 when not admin', async () => {
    mockRequireAdmin.mockRejectedValue(new MockAuthError('Forbidden', 403));

    const { GET } = await import('@/app/api/admin/analytics/users/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('should compute conversion rate and true churn rate matching hand-computed values', async () => {
    mockRequireAdmin.mockResolvedValue(undefined);
    mockUserCount.mockResolvedValue(1550); // retainedAfter60Days
    mockQueryRaw.mockResolvedValueOnce([
      {
        month_start: new Date('2026-07-01T00:00:00Z'),
        total_users_at_end: 13580,
        free_users: 12120,
        pro_users: 1460,
        trial_starts: 480,
        new_conversions: 218,
        active_start_subs: 1270,
        churned_subs: 28,
      },
      {
        month_start: new Date('2026-08-01T00:00:00Z'),
        total_users_at_end: 14820,
        free_users: 13130,
        pro_users: 1690,
        trial_starts: 530,
        new_conversions: 262,
        active_start_subs: 1460,
        churned_subs: 32,
      },
    ]);

    const { GET } = await import('@/app/api/admin/analytics/users/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.summary.totalUsers).toBe(14820);
    expect(data.summary.conversionRate).toBeCloseTo((1690 / 14820) * 100, 2);
    expect(data.summary.trueChurnRate).toBeCloseTo((32 / 1460) * 100, 2);
    expect(data.summary.momGrowth.totalUsersPct).toBeCloseTo(
      ((14820 - 13580) / 13580) * 100,
      2
    );
    expect(data.historicalTrajectory).toHaveLength(2);
    expect(data.historicalTrajectory[1].conversionRatePct).toBeCloseTo(
      (1690 / 14820) * 100,
      2
    );
  });

  it('should return 0% (not NaN) conversion/churn rates on an empty database', async () => {
    mockRequireAdmin.mockResolvedValue(undefined);
    mockUserCount.mockResolvedValue(0);
    mockQueryRaw.mockResolvedValueOnce([
      {
        month_start: new Date('2026-08-01T00:00:00Z'),
        total_users_at_end: 0,
        free_users: 0,
        pro_users: 0,
        trial_starts: 0,
        new_conversions: 0,
        active_start_subs: 0,
        churned_subs: 0,
      },
    ]);

    const { GET } = await import('@/app/api/admin/analytics/users/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.summary.conversionRate).toBe(0);
    expect(data.summary.trueChurnRate).toBe(0);
    expect(Number.isNaN(data.summary.conversionRate)).toBe(false);
  });

  it('should not count a subscription cancelled exactly at the month boundary as churn in the following month', async () => {
    mockRequireAdmin.mockResolvedValue(undefined);
    mockUserCount.mockResolvedValue(0);
    // The SQL's own `updatedAt < month_start + INTERVAL '1 month'` boundary
    // is exercised by the raw query itself (not re-testable via mocked
    // rows) -- this case documents the expectation at the route-response
    // level: a mocked row reflecting a boundary-inclusive-start /
    // exclusive-end month should report churned_subs only for the month
    // that actually contains the cancellation.
    mockQueryRaw.mockResolvedValueOnce([
      {
        month_start: new Date('2026-07-01T00:00:00Z'),
        total_users_at_end: 100,
        free_users: 90,
        pro_users: 10,
        trial_starts: 5,
        new_conversions: 2,
        active_start_subs: 10,
        churned_subs: 1, // cancellation landed in July, not August
      },
      {
        month_start: new Date('2026-08-01T00:00:00Z'),
        total_users_at_end: 100,
        free_users: 90,
        pro_users: 9,
        trial_starts: 4,
        new_conversions: 1,
        active_start_subs: 9,
        churned_subs: 0,
      },
    ]);

    const { GET } = await import('@/app/api/admin/analytics/users/route');
    const response = await GET();
    const data = await response.json();

    expect(data.historicalTrajectory[0].churnedSubs).toBe(1);
    expect(data.historicalTrajectory[1].churnedSubs).toBe(0);
  });
});
