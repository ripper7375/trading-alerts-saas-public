/**
 * BI Dashboard 1 -- Sales Growth Performance & Source of Sales Analysis
 * Metrics #8 (monthly sales), #9 (quarterly sales), #10 (monthly YoY),
 * #11 (quarterly YoY).
 *
 * Revenue scope (explicit product decision, not the spec doc's literal
 * Invoice-only SQL): merges Stripe-billed `Invoice.amountTotal` with
 * completed dLocal `Payment.amountUSD` rows, so "Monthly Sales" reflects
 * true total company revenue across both processors rather than
 * understating it by excluding every dLocal-billed country. VAT/tax
 * surveillance (Metric #17, in regional.ts) intentionally stays
 * Invoice-only -- Stripe Tax/OSS is inherently Stripe-specific and dLocal
 * countries handle local tax differently, so that scope split is correct,
 * not an oversight.
 *
 * `Payment` has no dedicated completion timestamp (only createdAt/updatedAt)
 * -- `createdAt` is used as the revenue-recognition date for dLocal rows,
 * since dLocal payments are created synchronously at completion time
 * (unlike Stripe's async invoice.payment_succeeded webhook flow).
 *
 * @module lib/admin/analytics/revenue
 */

import { unstable_cache } from 'next/cache';

import { prisma } from '@/lib/db/prisma';
import { monthLabel, quarterLabel, growthPct, round2 } from './date-windows';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Matches the already-shipped `/api/admin/analytics` root endpoint's MRR
// estimate -- reused for cross-admin-surface consistency rather than
// introducing a second, divergent PRO-price constant.
const PRO_MONTHLY_PRICE = 29;

export type RevenueTimeframe = '6M' | '12M' | 'YTD' | 'ALL';

const ALL_TIME_MONTHS_CAP = 60; // 5 years -- ALL is capped, not unbounded
const ALL_TIME_QUARTERS_CAP = 20;

function resolveMonthsBack(timeframe: RevenueTimeframe): number {
  switch (timeframe) {
    case '6M':
      return 6;
    case '12M':
      return 12;
    case 'YTD':
      return new Date().getUTCMonth() + 1; // Jan=1 .. current month inclusive
    case 'ALL':
      return ALL_TIME_MONTHS_CAP;
  }
}

function resolveQuartersBack(timeframe: RevenueTimeframe): number {
  switch (timeframe) {
    case '6M':
    case '12M':
      return 4; // spec always shows trailing 4 quarters regardless of monthly window
    case 'YTD': {
      const currentQuarter = Math.floor(new Date().getUTCMonth() / 3) + 1;
      return currentQuarter;
    }
    case 'ALL':
      return ALL_TIME_QUARTERS_CAP;
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface RevenueAnalyticsResponse {
  summary: {
    currentMonthSales: number;
    prevMonthSales: number | null;
    momGrowthPct: number | null;
    monthlyYoYGrowthPct: number | null;
    currentQuarterSales: number;
    prevQuarterSales: number | null;
    qoqGrowthPct: number | null;
    quarterlyYoYGrowthPct: number | null;
    mrr: number;
    arr: number;
    arppu: number;
  };
  monthlyTrailing: Array<{
    month: string;
    monthLabel: string;
    revenueUsd: number;
    prevMonthUsd: number | null;
    momGrowthUsd: number | null;
    momGrowthPct: number | null;
    prevYearUsd: number | null;
    yoyGrowthPct: number | null;
    transactionCount: number;
  }>;
  quarterlyTrailing: Array<{
    quarter: string;
    quarterLabel: string;
    revenueUsd: number;
    prevQuarterUsd: number | null;
    qoqGrowthUsd: number | null;
    qoqGrowthPct: number | null;
    prevYearUsd: number | null;
    yoyGrowthPct: number | null;
  }>;
}

interface MonthlyRow {
  month_date: Date;
  current_revenue: number;
  transaction_count: number;
  prev_month_revenue: number | null;
  prev_year_revenue: number | null;
}

interface QuarterlyRow {
  quarter_date: Date;
  current_revenue: number;
  prev_quarter_revenue: number | null;
  prev_year_revenue: number | null;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// QUERY
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function fetchRevenueAnalytics(
  timeframe: RevenueTimeframe
): Promise<RevenueAnalyticsResponse> {
  const monthsBack = resolveMonthsBack(timeframe);
  const quartersBack = resolveQuartersBack(timeframe);
  // Data windows fetch further back than what's displayed, so the
  // self-join against "12 months ago" / "1 quarter ago" always has a row
  // to match against for even the oldest displayed period.
  const monthlyDataWindow = monthsBack + 12;
  const quarterlyDataWindow = quartersBack + 4;

  const [monthlyRows, quarterlyRows, proUsers] = await Promise.all([
    prisma.$queryRaw<MonthlyRow[]>`
      WITH unified_sales AS (
        SELECT "paidAt" AS txn_date, "amountTotal"::float8 AS amount_usd
        FROM "Invoice"
        WHERE "paidAt" IS NOT NULL
        UNION ALL
        SELECT "createdAt" AS txn_date, "amountUSD"::float8 AS amount_usd
        FROM "Payment"
        WHERE "provider" = 'DLOCAL' AND "status" = 'COMPLETED'
      ),
      monthly_sales AS (
        SELECT
          DATE_TRUNC('month', txn_date) AS month_date,
          SUM(amount_usd)::float8 AS gross_sales,
          COUNT(*)::int AS transaction_count
        FROM unified_sales
        WHERE txn_date >= DATE_TRUNC('month', NOW()) - (INTERVAL '1 month' * ${monthlyDataWindow})
        GROUP BY DATE_TRUNC('month', txn_date)
      )
      SELECT
        curr.month_date,
        curr.gross_sales AS current_revenue,
        curr.transaction_count,
        prev_month.gross_sales AS prev_month_revenue,
        prev_year.gross_sales AS prev_year_revenue
      FROM monthly_sales curr
      LEFT JOIN monthly_sales prev_month
        ON prev_month.month_date = curr.month_date - INTERVAL '1 month'
      LEFT JOIN monthly_sales prev_year
        ON prev_year.month_date = curr.month_date - INTERVAL '12 months'
      WHERE curr.month_date >= DATE_TRUNC('month', NOW()) - (INTERVAL '1 month' * ${monthsBack - 1})
      ORDER BY curr.month_date DESC
    `,
    prisma.$queryRaw<QuarterlyRow[]>`
      WITH unified_sales AS (
        SELECT "paidAt" AS txn_date, "amountTotal"::float8 AS amount_usd
        FROM "Invoice"
        WHERE "paidAt" IS NOT NULL
        UNION ALL
        SELECT "createdAt" AS txn_date, "amountUSD"::float8 AS amount_usd
        FROM "Payment"
        WHERE "provider" = 'DLOCAL' AND "status" = 'COMPLETED'
      ),
      quarterly_sales AS (
        SELECT
          DATE_TRUNC('quarter', txn_date) AS quarter_date,
          SUM(amount_usd)::float8 AS gross_sales
        FROM unified_sales
        WHERE txn_date >= DATE_TRUNC('quarter', NOW()) - (INTERVAL '3 months' * ${quarterlyDataWindow})
        GROUP BY DATE_TRUNC('quarter', txn_date)
      )
      SELECT
        curr.quarter_date,
        curr.gross_sales AS current_revenue,
        prev_quarter.gross_sales AS prev_quarter_revenue,
        prev_year.gross_sales AS prev_year_revenue
      FROM quarterly_sales curr
      LEFT JOIN quarterly_sales prev_quarter
        ON prev_quarter.quarter_date = curr.quarter_date - INTERVAL '3 months'
      LEFT JOIN quarterly_sales prev_year
        ON prev_year.quarter_date = curr.quarter_date - INTERVAL '12 months'
      WHERE curr.quarter_date >= DATE_TRUNC('quarter', NOW()) - (INTERVAL '3 months' * ${quartersBack - 1})
      ORDER BY curr.quarter_date DESC
    `,
    prisma.user.count({ where: { tier: 'PRO' } }),
  ]);

  const monthlyTrailing = monthlyRows.map((row) => {
    const revenueUsd = round2(row.current_revenue ?? 0);
    const prevMonthUsd =
      row.prev_month_revenue !== null ? round2(row.prev_month_revenue) : null;
    const prevYearUsd =
      row.prev_year_revenue !== null ? round2(row.prev_year_revenue) : null;
    return {
      month: row.month_date.toISOString().slice(0, 7),
      monthLabel: monthLabel(row.month_date),
      revenueUsd,
      prevMonthUsd,
      momGrowthUsd:
        prevMonthUsd !== null ? round2(revenueUsd - prevMonthUsd) : null,
      momGrowthPct: growthPct(revenueUsd, prevMonthUsd),
      prevYearUsd,
      yoyGrowthPct: growthPct(revenueUsd, prevYearUsd),
      transactionCount: row.transaction_count ?? 0,
    };
  });

  const quarterlyTrailing = quarterlyRows.map((row) => {
    const revenueUsd = round2(row.current_revenue ?? 0);
    const prevQuarterUsd =
      row.prev_quarter_revenue !== null
        ? round2(row.prev_quarter_revenue)
        : null;
    const prevYearUsd =
      row.prev_year_revenue !== null ? round2(row.prev_year_revenue) : null;
    return {
      quarter: `${row.quarter_date.getUTCFullYear()}-Q${Math.floor(row.quarter_date.getUTCMonth() / 3) + 1}`,
      quarterLabel: quarterLabel(row.quarter_date),
      revenueUsd,
      prevQuarterUsd,
      qoqGrowthUsd:
        prevQuarterUsd !== null ? round2(revenueUsd - prevQuarterUsd) : null,
      qoqGrowthPct: growthPct(revenueUsd, prevQuarterUsd),
      prevYearUsd,
      yoyGrowthPct: growthPct(revenueUsd, prevYearUsd),
    };
  });

  const currentMonth = monthlyTrailing[0] ?? null;
  const currentQuarter = quarterlyTrailing[0] ?? null;
  const currentMonthSales = currentMonth?.revenueUsd ?? 0;
  const mrr = proUsers * PRO_MONTHLY_PRICE;
  const arr = mrr * 12;
  const arppu = proUsers > 0 ? round2(currentMonthSales / proUsers) : 0;

  return {
    summary: {
      currentMonthSales,
      prevMonthSales: currentMonth?.prevMonthUsd ?? null,
      momGrowthPct: currentMonth?.momGrowthPct ?? null,
      monthlyYoYGrowthPct: currentMonth?.yoyGrowthPct ?? null,
      currentQuarterSales: currentQuarter?.revenueUsd ?? 0,
      prevQuarterSales: currentQuarter?.prevQuarterUsd ?? null,
      qoqGrowthPct: currentQuarter?.qoqGrowthPct ?? null,
      quarterlyYoYGrowthPct: currentQuarter?.yoyGrowthPct ?? null,
      mrr,
      arr,
      arppu,
    },
    monthlyTrailing,
    quarterlyTrailing,
  };
}

/**
 * Cached BI revenue analytics getter -- shared by the API route
 * (`app/api/admin/analytics/revenue/route.ts`) and the Server Component
 * page (`app/admin/dashboards/revenue/page.tsx`), so both hit the same
 * cache entry and can never disagree.
 */
export const getRevenueAnalytics = unstable_cache(
  fetchRevenueAnalytics,
  ['admin-analytics-revenue'],
  { revalidate: 300, tags: ['admin-analytics-revenue'] }
);
