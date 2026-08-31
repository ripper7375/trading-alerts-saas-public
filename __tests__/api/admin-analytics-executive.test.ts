/**
 * Admin BI Dashboard 5 (Executive Command Center) API Route Tests
 *
 * @module __tests__/api/admin-analytics-executive.test.ts
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

const mockGetRevenueAnalytics = jest.fn();
const mockGetUsersAnalytics = jest.fn();
const mockGetRegionalAnalytics = jest.fn();
const mockGetAffiliatesAnalytics = jest.fn();

jest.mock('@/lib/admin/analytics/revenue', () => ({
  __esModule: true,
  getRevenueAnalytics: (...args: unknown[]) => mockGetRevenueAnalytics(...args),
}));
jest.mock('@/lib/admin/analytics/users', () => ({
  __esModule: true,
  getUsersAnalytics: (...args: unknown[]) => mockGetUsersAnalytics(...args),
}));
jest.mock('@/lib/admin/analytics/regional', () => ({
  __esModule: true,
  getRegionalAnalytics: (...args: unknown[]) =>
    mockGetRegionalAnalytics(...args),
}));
jest.mock('@/lib/admin/analytics/affiliates', () => ({
  __esModule: true,
  getAffiliatesAnalytics: (...args: unknown[]) =>
    mockGetAffiliatesAnalytics(...args),
}));

describe('GET /api/admin/analytics/executive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new MockAuthError('Unauthorized', 401));

    const { GET } = await import('@/app/api/admin/analytics/executive/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 when not admin', async () => {
    mockRequireAdmin.mockRejectedValue(new MockAuthError('Forbidden', 403));

    const { GET } = await import('@/app/api/admin/analytics/executive/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('should compose the 4 pillar getters without re-deriving numbers -- pillar values match what each getter returned', async () => {
    mockRequireAdmin.mockResolvedValue(undefined);
    mockGetRevenueAnalytics.mockResolvedValue({
      summary: {
        currentMonthSales: 48920,
        prevMonthSales: 42150,
        momGrowthPct: 16.06,
        monthlyYoYGrowthPct: 43.5,
        currentQuarterSales: 134850,
        prevQuarterSales: 118200,
        qoqGrowthPct: 14.09,
        quarterlyYoYGrowthPct: 38.21,
        mrr: 49010,
        arr: 588120,
        arppu: 28.95,
      },
      monthlyTrailing: [],
      quarterlyTrailing: [],
    });
    mockGetUsersAnalytics.mockResolvedValue({
      summary: {
        totalUsers: 14820,
        freeUsers: 13130,
        proUsers: 1690,
        freePercentage: 88.6,
        proPercentage: 11.4,
        conversionRate: 11.4,
        trueChurnRate: 2.15,
        momGrowth: {
          totalUsersPct: 9.13,
          freeUsersPct: 8.33,
          proUsersPct: 15.75,
        },
      },
      historicalTrajectory: [
        {
          month: '2026-07',
          monthLabel: 'Jul 2026',
          totalUsersAtEnd: 13580,
          freeUsers: 12120,
          proUsers: 1460,
          trialStarts: 480,
          newConversions: 218,
          conversionRatePct: 10.75,
          activeStartSubs: 1270,
          churnedSubs: 28,
          trueChurnRatePct: 2.2,
        },
        {
          month: '2026-08',
          monthLabel: 'Aug 2026',
          totalUsersAtEnd: 14820,
          freeUsers: 13130,
          proUsers: 1690,
          trialStarts: 530,
          newConversions: 262,
          conversionRatePct: 11.4,
          activeStartSubs: 1460,
          churnedSubs: 32,
          trueChurnRatePct: 2.15,
        },
      ],
      funnelCohorts: {
        registeredSignups: 14820,
        trialsActivated: 1010,
        paidConversions: 480,
        retainedAfter60Days: 1550,
      },
    });
    mockGetRegionalAnalytics.mockResolvedValue({
      countryRankings: [
        {
          rank: 1,
          countryName: 'United Kingdom',
          isoCode: 'GB',
          totalUsers: 2890,
          allUsersSharePct: 19.5,
          freeUsers: 2480,
          proUsers: 410,
          proUsersSharePct: 24.26,
          trailing12mSalesUsd: 142500,
          salesSharePct: 29.13,
        },
        {
          rank: 2,
          countryName: 'Thailand',
          isoCode: 'TH',
          totalUsers: 3480,
          allUsersSharePct: 23.48,
          freeUsers: 3190,
          proUsers: 290,
          proUsersSharePct: 17.16,
          trailing12mSalesUsd: 68400,
          salesSharePct: 13.98,
        },
      ],
      taxSurveillance: [
        {
          countryName: 'United Kingdom',
          isoCode: 'GB',
          trailing12mSalesUsd: 142500,
          fxRate: 0.78,
          approxLocalSales: 111150,
          statutoryThreshold: 90000,
          statutoryThresholdCurrency: 'GBP',
          utilizationPct: 60.2,
          alertLevel: 'LEVEL_1_WARN',
        },
      ],
      donutMarketShare: { allUsers: [], proUsers: [] },
    });
    mockGetAffiliatesAnalytics.mockResolvedValue({
      summary: {
        totalAffiliates: 485,
        prevMonthAffiliates: 437,
        momGrowthPct: 10.98,
        affiliateFreeCount: 367,
        affiliateProCount: 118,
        tierRatio: '3.11 : 1',
        freePercentage: 75.7,
        proPercentage: 24.3,
        avgMonthlyCommission: 184.5,
        totalCommissionsPaidUsd: 89482.5,
      },
      geographicDistribution: [],
      top20Leaderboard: [
        {
          rank: 1,
          anonymizedPartnerId: 'Partner #TH-8821',
          country: 'Thailand',
          countryIso: 'TH',
          saasTier: 'PRO',
          activeCode: 'SOMCHAI30',
          codesUsed: 68,
          subscribersReferred: 64,
          grossSalesUsd: 5240,
          commissionEarnedUsd: 1572,
          payoutStatus: 'APPROVED',
        },
      ],
    });

    const { GET } = await import('@/app/api/admin/analytics/executive/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.revenuePillar.currentMonthSales).toBe(48920);
    expect(data.revenuePillar.mrr).toBe(49010);
    expect(data.customerPillar.totalUsers).toBe(14820);
    expect(data.customerPillar.conversionRate).toBe(11.4);
    expect(data.regionalPillar.topRevenueCountry).toBe('United Kingdom');
    expect(data.regionalPillar.topUserCountry).toBe('Thailand');
    expect(data.regionalPillar.activeTaxAlertsCount).toBe(1);
    expect(data.affiliatePillar.totalAffiliates).toBe(485);
    expect(data.affiliatePillar.salesInfluencedUsd).toBe(5240);

    // RAG boundary: GB's LEVEL_1_WARN should surface as AMBER in the matrix.
    const taxRow = data.healthStatusMatrix.find(
      (r: { pillar: string }) => r.pillar === 'Regional & Tax'
    );
    expect(taxRow.ragStatus).toBe('AMBER');

    const revenueRow = data.healthStatusMatrix.find(
      (r: { keyMetric: string }) => r.keyMetric === 'Monthly Gross Sales (USD)'
    );
    expect(revenueRow.ragStatus).toBe('GREEN');
  });

  it('should show GREEN RAG with "no active alerts" when no jurisdiction is above LEVEL_0_SAFE', async () => {
    mockRequireAdmin.mockResolvedValue(undefined);
    mockGetRevenueAnalytics.mockResolvedValue({
      summary: {
        currentMonthSales: 0,
        prevMonthSales: null,
        momGrowthPct: null,
        monthlyYoYGrowthPct: null,
        currentQuarterSales: 0,
        prevQuarterSales: null,
        qoqGrowthPct: null,
        quarterlyYoYGrowthPct: null,
        mrr: 0,
        arr: 0,
        arppu: 0,
      },
      monthlyTrailing: [],
      quarterlyTrailing: [],
    });
    mockGetUsersAnalytics.mockResolvedValue({
      summary: {
        totalUsers: 0,
        freeUsers: 0,
        proUsers: 0,
        freePercentage: 0,
        proPercentage: 0,
        conversionRate: 0,
        trueChurnRate: 0,
        momGrowth: {
          totalUsersPct: null,
          freeUsersPct: null,
          proUsersPct: null,
        },
      },
      historicalTrajectory: [],
      funnelCohorts: {
        registeredSignups: 0,
        trialsActivated: 0,
        paidConversions: 0,
        retainedAfter60Days: 0,
      },
    });
    mockGetRegionalAnalytics.mockResolvedValue({
      countryRankings: [],
      taxSurveillance: [
        {
          countryName: 'Thailand',
          isoCode: 'TH',
          trailing12mSalesUsd: 0,
          fxRate: 36.5,
          approxLocalSales: 0,
          statutoryThreshold: 1800000,
          statutoryThresholdCurrency: 'THB',
          utilizationPct: 0,
          alertLevel: 'LEVEL_0_SAFE',
        },
      ],
      donutMarketShare: { allUsers: [], proUsers: [] },
    });
    mockGetAffiliatesAnalytics.mockResolvedValue({
      summary: {
        totalAffiliates: 0,
        prevMonthAffiliates: 0,
        momGrowthPct: 0,
        affiliateFreeCount: 0,
        affiliateProCount: 0,
        tierRatio: '0 : 0',
        freePercentage: 0,
        proPercentage: 0,
        avgMonthlyCommission: 0,
        totalCommissionsPaidUsd: 0,
      },
      geographicDistribution: [],
      top20Leaderboard: [],
    });

    const { GET } = await import('@/app/api/admin/analytics/executive/route');
    const response = await GET();
    const data = await response.json();

    expect(data.regionalPillar.activeTaxAlertsCount).toBe(0);
    expect(data.regionalPillar.taxAlertSummary).toBe(
      'No active tax threshold alerts'
    );
    const taxRow = data.healthStatusMatrix.find(
      (r: { pillar: string }) => r.pillar === 'Regional & Tax'
    );
    expect(taxRow.ragStatus).toBe('GREEN');
  });
});
