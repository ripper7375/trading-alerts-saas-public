/**
 * BI Dashboard 3 -- Regional Markets & Multi-Jurisdiction Tax Surveillance
 * Metrics #13-#19: country rankings (users/FREE/PRO/sales), VAT/tax
 * threshold surveillance, and all-user/PRO-user market-share donuts.
 *
 * Country resolution (no `User.country` field exists): two-tier priority
 * per user -- most recent `Invoice.taxCountry` (reliable today, covers
 * Stripe-billed PRO users) falling back to most recent `user_sessions
 * .country` (IP-geolocated, but currently never written by any live code
 * path -- `trackSession()` in lib/auth/session-tracker.ts never persists
 * it despite the column existing). Until that's fixed elsewhere, expect
 * FREE-tier-only users (no billing trail) to render mostly under "Other
 * Countries" here -- documented behavior, not a bug in this route.
 *
 * Metric #16 (country revenue) uses the same merged Stripe+dLocal source
 * as revenue.ts. Metric #17 (VAT/tax surveillance) stays Invoice-only via
 * the existing `v_country_trailing_12m_sales` view -- Stripe Tax/OSS is
 * inherently Stripe-specific, so that scope split is intentional.
 *
 * @module lib/admin/analytics/regional
 */

import { unstable_cache } from 'next/cache';

import { prisma } from '@/lib/db/prisma';
import {
  JURISDICTIONS,
  OTHERS_ISO,
  OTHERS_NAME,
  jurisdictionCaseSql,
  classifyAlertLevel,
  type AlertLevel,
} from './jurisdictions';
import { round2 } from './date-windows';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface RegionalAnalyticsResponse {
  countryRankings: Array<{
    rank: number;
    countryName: string;
    isoCode: string;
    totalUsers: number;
    allUsersSharePct: number;
    freeUsers: number;
    proUsers: number;
    proUsersSharePct: number;
    trailing12mSalesUsd: number;
    salesSharePct: number;
  }>;
  taxSurveillance: Array<{
    countryName: string;
    isoCode: string;
    trailing12mSalesUsd: number;
    fxRate: number;
    approxLocalSales: number | null;
    statutoryThreshold: number | null;
    statutoryThresholdCurrency: string;
    utilizationPct: number | null;
    alertLevel: AlertLevel;
  }>;
  donutMarketShare: {
    allUsers: Array<{
      country: string;
      iso: string;
      count: number;
      percentage: number;
    }>;
    proUsers: Array<{
      country: string;
      iso: string;
      count: number;
      percentage: number;
    }>;
  };
}

interface UserCountRow {
  jurisdiction_iso: string;
  total_users: number;
  free_users: number;
  pro_users: number;
}

interface RevenueRow {
  jurisdiction_iso: string;
  trailing_12m_sales: number | null;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// QUERY
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function fetchRegionalAnalytics(): Promise<RegionalAnalyticsResponse> {
  const resolvedCountryCase = jurisdictionCaseSql('resolved_country');
  const mergedRevenueCase = jurisdictionCaseSql('country');
  const invoiceOnlyCase = jurisdictionCaseSql('"taxCountry"');

  const [userCountRows, mergedRevenueRows, invoiceOnlyRevenueRows] =
    await Promise.all([
      prisma.$queryRawUnsafe<UserCountRow[]>(`
      WITH latest_invoice_country AS (
        SELECT DISTINCT ON ("userId") "userId", "taxCountry" AS country
        FROM "Invoice"
        WHERE "paidAt" IS NOT NULL
        ORDER BY "userId", "paidAt" DESC
      ),
      latest_session_country AS (
        SELECT DISTINCT ON ("userId") "userId", "country"
        FROM "user_sessions"
        WHERE "country" IS NOT NULL
        ORDER BY "userId", "lastActiveAt" DESC
      ),
      user_country AS (
        SELECT
          u.id AS "userId",
          u.tier,
          COALESCE(li.country, ls.country) AS resolved_country
        FROM "User" u
        LEFT JOIN latest_invoice_country li ON li."userId" = u.id
        LEFT JOIN latest_session_country ls ON ls."userId" = u.id
      )
      SELECT
        ${resolvedCountryCase} AS jurisdiction_iso,
        COUNT(*)::int AS total_users,
        COUNT(*) FILTER (WHERE tier = 'FREE')::int AS free_users,
        COUNT(*) FILTER (WHERE tier = 'PRO')::int AS pro_users
      FROM user_country
      GROUP BY jurisdiction_iso
    `),
      prisma.$queryRawUnsafe<RevenueRow[]>(`
      WITH unified_sales AS (
        SELECT "taxCountry" AS country, "amountTotal"::float8 AS amount_usd
        FROM "Invoice"
        WHERE "paidAt" IS NOT NULL AND "paidAt" >= NOW() - INTERVAL '12 months'
        UNION ALL
        SELECT "country", "amountUSD"::float8 AS amount_usd
        FROM "Payment"
        WHERE "provider" = 'DLOCAL' AND "status" = 'COMPLETED'
          AND "createdAt" >= NOW() - INTERVAL '12 months'
      )
      SELECT
        ${mergedRevenueCase} AS jurisdiction_iso,
        SUM(amount_usd)::float8 AS trailing_12m_sales
      FROM unified_sales
      GROUP BY jurisdiction_iso
    `),
      prisma.$queryRawUnsafe<RevenueRow[]>(`
      SELECT
        ${invoiceOnlyCase} AS jurisdiction_iso,
        SUM("gross_sales_12m")::float8 AS trailing_12m_sales
      FROM "v_country_trailing_12m_sales"
      GROUP BY jurisdiction_iso
    `),
    ]);

  const userCountByIso = new Map(
    userCountRows.map((r) => [r.jurisdiction_iso, r])
  );
  const mergedRevenueByIso = new Map(
    mergedRevenueRows.map((r) => [
      r.jurisdiction_iso,
      r.trailing_12m_sales ?? 0,
    ])
  );
  const invoiceOnlyRevenueByIso = new Map(
    invoiceOnlyRevenueRows.map((r) => [
      r.jurisdiction_iso,
      r.trailing_12m_sales ?? 0,
    ])
  );

  const allIsoCodes = [...JURISDICTIONS.map((j) => j.iso), OTHERS_ISO];

  const rankingRowsUnsorted = allIsoCodes.map((iso) => {
    const jurisdiction = JURISDICTIONS.find((j) => j.iso === iso);
    const counts = userCountByIso.get(iso);
    return {
      countryName: jurisdiction?.name ?? OTHERS_NAME,
      isoCode: iso,
      totalUsers: counts?.total_users ?? 0,
      freeUsers: counts?.free_users ?? 0,
      proUsers: counts?.pro_users ?? 0,
      trailing12mSalesUsd: round2(mergedRevenueByIso.get(iso) ?? 0),
    };
  });

  const globalTotalUsers = rankingRowsUnsorted.reduce(
    (sum, r) => sum + r.totalUsers,
    0
  );
  const globalProUsers = rankingRowsUnsorted.reduce(
    (sum, r) => sum + r.proUsers,
    0
  );
  const globalSales = rankingRowsUnsorted.reduce(
    (sum, r) => sum + r.trailing12mSalesUsd,
    0
  );

  const countryRankings = rankingRowsUnsorted
    .map((r) => ({
      ...r,
      allUsersSharePct:
        globalTotalUsers > 0
          ? round2((r.totalUsers / globalTotalUsers) * 100)
          : 0,
      proUsersSharePct:
        globalProUsers > 0 ? round2((r.proUsers / globalProUsers) * 100) : 0,
      salesSharePct:
        globalSales > 0
          ? round2((r.trailing12mSalesUsd / globalSales) * 100)
          : 0,
    }))
    .sort((a, b) => b.totalUsers - a.totalUsers)
    .map((r, index) => ({ rank: index + 1, ...r }));

  const taxSurveillance = JURISDICTIONS.map((jurisdiction) => {
    const trailing12mSalesUsd = round2(
      invoiceOnlyRevenueByIso.get(jurisdiction.iso) ?? 0
    );
    const classification = classifyAlertLevel(
      jurisdiction,
      trailing12mSalesUsd
    );
    return {
      countryName: jurisdiction.name,
      isoCode: jurisdiction.iso,
      trailing12mSalesUsd,
      fxRate: jurisdiction.approxUsdFxRate,
      approxLocalSales:
        classification.approxLocalSales !== null
          ? round2(classification.approxLocalSales)
          : null,
      statutoryThreshold: jurisdiction.thresholdLocalAmount,
      statutoryThresholdCurrency: jurisdiction.thresholdCurrency,
      utilizationPct:
        classification.utilizationPct !== null
          ? round2(classification.utilizationPct)
          : null,
      alertLevel: classification.level,
    };
  });

  const donutAllUsers = countryRankings
    .filter((r) => r.isoCode !== OTHERS_ISO)
    .sort((a, b) => b.totalUsers - a.totalUsers)
    .map((r) => ({
      country: r.countryName,
      iso: r.isoCode,
      count: r.totalUsers,
      percentage: r.allUsersSharePct,
    }));
  const othersAllUsers = countryRankings.find((r) => r.isoCode === OTHERS_ISO)!;
  donutAllUsers.push({
    country: othersAllUsers.countryName,
    iso: othersAllUsers.isoCode,
    count: othersAllUsers.totalUsers,
    percentage: othersAllUsers.allUsersSharePct,
  });

  const donutProUsers = countryRankings
    .filter((r) => r.isoCode !== OTHERS_ISO)
    .sort((a, b) => b.proUsers - a.proUsers)
    .map((r) => ({
      country: r.countryName,
      iso: r.isoCode,
      count: r.proUsers,
      percentage: r.proUsersSharePct,
    }));
  const othersProUsers = countryRankings.find((r) => r.isoCode === OTHERS_ISO)!;
  donutProUsers.push({
    country: othersProUsers.countryName,
    iso: othersProUsers.isoCode,
    count: othersProUsers.proUsers,
    percentage: othersProUsers.proUsersSharePct,
  });

  return {
    countryRankings,
    taxSurveillance,
    donutMarketShare: {
      allUsers: donutAllUsers,
      proUsers: donutProUsers,
    },
  };
}

/**
 * Cached BI regional analytics getter -- shared by the API route and the
 * Server Component dashboard page.
 */
export const getRegionalAnalytics = unstable_cache(
  fetchRegionalAnalytics,
  ['admin-analytics-regional'],
  { revalidate: 300, tags: ['admin-analytics-regional'] }
);
