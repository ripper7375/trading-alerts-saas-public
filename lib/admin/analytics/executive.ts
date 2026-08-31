/**
 * BI Dashboard 5 -- Executive Business Command Center. Unified C-suite
 * summary synthesizing all 4 pillars (Revenue, Customer, Regional,
 * Affiliate) plus a cross-functional RAG health-status matrix.
 *
 * Composes the other 4 cached getters rather than re-deriving its own
 * SQL, so this summary can never drift from the detail dashboards' own
 * numbers -- calling it after the other 4 have already been requested in
 * the same 5-minute cache window is a cache hit on all four.
 *
 * RAG thresholds below are a documented first-pass heuristic -- no
 * cutoffs are defined anywhere in the spec doc or the reference workbook.
 * Tune with Davin once real trend data exists; not presented as
 * authoritative business rules.
 *
 * @module lib/admin/analytics/executive
 */

import { unstable_cache } from 'next/cache';

import { getRevenueAnalytics } from './revenue';
import { getUsersAnalytics } from './users';
import { getRegionalAnalytics } from './regional';
import { getAffiliatesAnalytics } from './affiliates';
import { OTHERS_ISO, type AlertLevel } from './jurisdictions';
import { round2 } from './date-windows';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type RagStatus = 'GREEN' | 'AMBER' | 'RED';

export interface ExecutiveAnalyticsResponse {
  revenuePillar: {
    mrr: number;
    arr: number;
    currentMonthSales: number;
    momGrowthPct: number | null;
    yoyGrowthPct: number | null;
  };
  customerPillar: {
    totalUsers: number;
    proUsers: number;
    conversionRate: number;
    trueChurnRate: number;
    momGrowthPct: number | null;
  };
  regionalPillar: {
    topRevenueCountry: string;
    topUserCountry: string;
    activeTaxAlertsCount: number;
    taxAlertSummary: string;
  };
  affiliatePillar: {
    totalAffiliates: number;
    salesInfluencedUsd: number;
    avgCommission: number;
    momGrowthPct: number | null;
  };
  healthStatusMatrix: Array<{
    pillar: string;
    keyMetric: string;
    currentValue: string;
    priorValue: string;
    momTrend: string;
    yoyBenchmark: string;
    ragStatus: RagStatus;
    notes: string;
  }>;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RAG HEURISTICS (first-pass, see module header)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ragForGrowth(momGrowthPct: number | null): RagStatus {
  if (momGrowthPct === null) return 'AMBER'; // no prior-period baseline yet
  if (momGrowthPct >= 0) return 'GREEN';
  if (momGrowthPct >= -10) return 'AMBER';
  return 'RED';
}

function ragForChurn(trueChurnRatePct: number): RagStatus {
  if (trueChurnRatePct < 3) return 'GREEN';
  if (trueChurnRatePct <= 5) return 'AMBER';
  return 'RED';
}

function ragForAlertLevel(level: AlertLevel): RagStatus {
  switch (level) {
    case 'LEVEL_3_CRITICAL':
      return 'RED';
    case 'LEVEL_1_WARN':
    case 'LEVEL_2_ACTION':
      return 'AMBER';
    default:
      return 'GREEN'; // LEVEL_0_SAFE, ACTIVE_COLLECTING, NOT_APPLICABLE
  }
}

function fmtPct(value: number | null, suffix = '%'): string {
  if (value === null) return 'New — no prior data';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${round2(value)}${suffix}`;
}

function fmtUsd(value: number): string {
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPOSITION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function fetchExecutiveAnalytics(): Promise<ExecutiveAnalyticsResponse> {
  const [revenue, users, regional, affiliates] = await Promise.all([
    getRevenueAnalytics('6M'),
    getUsersAnalytics(),
    getRegionalAnalytics(),
    getAffiliatesAnalytics('3months'),
  ]);

  const realCountryRankings = regional.countryRankings.filter(
    (r) => r.isoCode !== OTHERS_ISO
  );
  const topRevenueCountry =
    [...realCountryRankings].sort(
      (a, b) => b.trailing12mSalesUsd - a.trailing12mSalesUsd
    )[0] ?? null;
  const topUserCountry =
    [...realCountryRankings].sort((a, b) => b.totalUsers - a.totalUsers)[0] ??
    null;

  const activeAlerts = regional.taxSurveillance
    .filter(
      (t) =>
        t.alertLevel === 'LEVEL_1_WARN' ||
        t.alertLevel === 'LEVEL_2_ACTION' ||
        t.alertLevel === 'LEVEL_3_CRITICAL'
    )
    .sort((a, b) => (b.utilizationPct ?? 0) - (a.utilizationPct ?? 0));
  const topAlert = activeAlerts[0] ?? null;

  const salesInfluencedUsd = round2(
    affiliates.top20Leaderboard.reduce((sum, row) => sum + row.grossSalesUsd, 0)
  );

  const previousMonthUsers =
    users.historicalTrajectory.length > 1
      ? users.historicalTrajectory[users.historicalTrajectory.length - 2]!
      : null;

  const healthStatusMatrix: ExecutiveAnalyticsResponse['healthStatusMatrix'] = [
    {
      pillar: 'Revenue & Growth',
      keyMetric: 'Monthly Gross Sales (USD)',
      currentValue: fmtUsd(revenue.summary.currentMonthSales),
      priorValue:
        revenue.summary.prevMonthSales !== null
          ? fmtUsd(revenue.summary.prevMonthSales)
          : 'N/A',
      momTrend: fmtPct(revenue.summary.momGrowthPct),
      yoyBenchmark: fmtPct(revenue.summary.monthlyYoYGrowthPct),
      ragStatus: ragForGrowth(revenue.summary.momGrowthPct),
      notes: 'Merged Stripe + dLocal revenue',
    },
    {
      pillar: 'Revenue & Growth',
      keyMetric: 'Quarterly Gross Sales (USD)',
      currentValue: fmtUsd(revenue.summary.currentQuarterSales),
      priorValue:
        revenue.summary.prevQuarterSales !== null
          ? fmtUsd(revenue.summary.prevQuarterSales)
          : 'N/A',
      momTrend: fmtPct(revenue.summary.qoqGrowthPct),
      yoyBenchmark: fmtPct(revenue.summary.quarterlyYoYGrowthPct),
      ragStatus: ragForGrowth(revenue.summary.qoqGrowthPct),
      notes: 'Trailing 4-quarter run-rate',
    },
    {
      pillar: 'Customer Base',
      keyMetric: 'Total Registered User Base',
      currentValue: users.summary.totalUsers.toLocaleString(),
      priorValue: previousMonthUsers
        ? previousMonthUsers.totalUsersAtEnd.toLocaleString()
        : 'N/A',
      momTrend: fmtPct(users.summary.momGrowth.totalUsersPct),
      yoyBenchmark: 'N/A',
      ragStatus: ragForGrowth(users.summary.momGrowth.totalUsersPct),
      notes: `${users.summary.proUsers.toLocaleString()} PRO / ${users.summary.freeUsers.toLocaleString()} FREE`,
    },
    {
      pillar: 'Customer Base',
      keyMetric: 'Paid Conversion Rate (PRO %)',
      currentValue: `${users.summary.conversionRate}%`,
      priorValue: previousMonthUsers
        ? `${previousMonthUsers.conversionRatePct}%`
        : 'N/A',
      momTrend: previousMonthUsers
        ? fmtPct(
            round2(
              users.summary.conversionRate -
                previousMonthUsers.conversionRatePct
            ),
            ' pt'
          )
        : 'N/A',
      yoyBenchmark: 'N/A',
      ragStatus:
        users.summary.conversionRate >=
        (previousMonthUsers?.conversionRatePct ?? 0)
          ? 'GREEN'
          : 'AMBER',
      notes: 'FREE-to-PRO conversion, trailing 6-month trajectory',
    },
    {
      pillar: 'Customer Base',
      keyMetric: 'Monthly True Churn Rate (%)',
      currentValue: `${users.summary.trueChurnRate}%`,
      priorValue: previousMonthUsers
        ? `${previousMonthUsers.trueChurnRatePct}%`
        : 'N/A',
      momTrend: previousMonthUsers
        ? fmtPct(
            round2(
              users.summary.trueChurnRate - previousMonthUsers.trueChurnRatePct
            ),
            ' pt'
          )
        : 'N/A',
      yoyBenchmark: 'N/A',
      ragStatus: ragForChurn(users.summary.trueChurnRate),
      notes: 'Excludes un-converted trial expirations',
    },
    {
      pillar: 'Regional & Tax',
      keyMetric: topAlert
        ? `${topAlert.countryName} VAT/Tax Threshold Progress`
        : 'VAT/Tax Threshold Surveillance',
      currentValue:
        topAlert && topAlert.utilizationPct !== null
          ? `${round2(topAlert.utilizationPct)}%`
          : 'No active alerts',
      priorValue: 'N/A',
      momTrend: 'N/A',
      yoyBenchmark: 'N/A',
      ragStatus: topAlert ? ragForAlertLevel(topAlert.alertLevel) : 'GREEN',
      notes: topAlert
        ? `${activeAlerts.length} jurisdiction(s) at Level 1+ -- highest: ${topAlert.alertLevel}`
        : 'All monitored jurisdictions within safe thresholds',
    },
    {
      pillar: 'Affiliate Network',
      keyMetric: 'Total Active Partners',
      currentValue: affiliates.summary.totalAffiliates.toLocaleString(),
      priorValue:
        affiliates.summary.prevMonthAffiliates !== null
          ? affiliates.summary.prevMonthAffiliates.toLocaleString()
          : 'N/A',
      momTrend: fmtPct(affiliates.summary.momGrowthPct),
      yoyBenchmark: 'N/A',
      ragStatus: ragForGrowth(affiliates.summary.momGrowthPct),
      notes: `Tier ratio ${affiliates.summary.tierRatio} (Free:PRO)`,
    },
    {
      pillar: 'Affiliate Network',
      keyMetric: 'Avg Monthly Commission per Affiliate',
      currentValue: fmtUsd(affiliates.summary.avgMonthlyCommission),
      priorValue: 'N/A',
      momTrend: 'N/A',
      yoyBenchmark: 'N/A',
      ragStatus: 'GREEN',
      notes: `Top 20 driving ${fmtUsd(salesInfluencedUsd)} in gross sales this period`,
    },
  ];

  return {
    revenuePillar: {
      mrr: revenue.summary.mrr,
      arr: revenue.summary.arr,
      currentMonthSales: revenue.summary.currentMonthSales,
      momGrowthPct: revenue.summary.momGrowthPct,
      yoyGrowthPct: revenue.summary.monthlyYoYGrowthPct,
    },
    customerPillar: {
      totalUsers: users.summary.totalUsers,
      proUsers: users.summary.proUsers,
      conversionRate: users.summary.conversionRate,
      trueChurnRate: users.summary.trueChurnRate,
      momGrowthPct: users.summary.momGrowth.totalUsersPct,
    },
    regionalPillar: {
      topRevenueCountry: topRevenueCountry?.countryName ?? 'No data yet',
      topUserCountry: topUserCountry?.countryName ?? 'No data yet',
      activeTaxAlertsCount: activeAlerts.length,
      taxAlertSummary: topAlert
        ? `${topAlert.countryName}: ${round2(topAlert.utilizationPct ?? 0)}% of threshold (${topAlert.alertLevel})`
        : 'No active tax threshold alerts',
    },
    affiliatePillar: {
      totalAffiliates: affiliates.summary.totalAffiliates,
      salesInfluencedUsd,
      avgCommission: affiliates.summary.avgMonthlyCommission,
      momGrowthPct: affiliates.summary.momGrowthPct,
    },
    healthStatusMatrix,
  };
}

/**
 * Cached BI executive analytics getter -- shared by the API route and the
 * Server Component dashboard page.
 */
export const getExecutiveAnalytics = unstable_cache(
  fetchExecutiveAnalytics,
  ['admin-analytics-executive'],
  { revalidate: 300, tags: ['admin-analytics-executive'] }
);
