/**
 * BI Dashboard 2 -- Customer Base, Conversion Funnel & 6-Month Historical
 * Trajectory. Metrics #1-#6 (user/tier counts + MoM growth), #7 (Overall
 * Conversion Rate + 6M history), #12 (True Churn Rate + 6M history).
 *
 * True-churn definition note: only `Subscription.status = 'CANCELED'`
 * (one L, per the live enum -- SubscriptionStatus has no double-L variant)
 * with an in-month `updatedAt` counts as churn. This correctly excludes
 * trial expirations, which never had an ACTIVE paid Subscription row to
 * cancel from in the first place -- so "true churn" (paid -> cancelled)
 * is naturally distinct from trial drop-off without extra filtering.
 *
 * The trailing window is fixed at 6 months (not timeframe-selectable) --
 * the "+6M History" is baked into Metrics #7/#12's own definitions, and
 * the prototype's DB2 tab has no timeframe selector, unlike DB1.
 *
 * @module lib/admin/analytics/users
 */

import { unstable_cache } from 'next/cache';

import { prisma } from '@/lib/db/prisma';
import { monthLabel, growthPct, round2 } from './date-windows';

const TRAILING_MONTHS = 6;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface UsersAnalyticsResponse {
  summary: {
    totalUsers: number;
    freeUsers: number;
    proUsers: number;
    freePercentage: number;
    proPercentage: number;
    conversionRate: number;
    trueChurnRate: number;
    momGrowth: {
      totalUsersPct: number | null;
      freeUsersPct: number | null;
      proUsersPct: number | null;
    };
  };
  historicalTrajectory: Array<{
    month: string;
    monthLabel: string;
    totalUsersAtEnd: number;
    freeUsers: number;
    proUsers: number;
    trialStarts: number;
    newConversions: number;
    conversionRatePct: number;
    activeStartSubs: number;
    churnedSubs: number;
    trueChurnRatePct: number;
  }>;
  funnelCohorts: {
    registeredSignups: number;
    trialsActivated: number;
    paidConversions: number;
    retainedAfter60Days: number;
  };
}

interface MonthlySeriesRow {
  month_start: Date;
  total_users_at_end: number;
  free_users: number;
  pro_users: number;
  trial_starts: number;
  new_conversions: number;
  active_start_subs: number;
  churned_subs: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// QUERY
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function fetchUsersAnalytics(): Promise<UsersAnalyticsResponse> {
  const [rows, retainedAfter60Days] = await Promise.all([
    prisma.$queryRaw<MonthlySeriesRow[]>`
      WITH monthly_series AS (
        SELECT generate_series(
          DATE_TRUNC('month', NOW()) - (INTERVAL '1 month' * ${TRAILING_MONTHS - 1}),
          DATE_TRUNC('month', NOW()),
          INTERVAL '1 month'
        ) AS month_start
      )
      SELECT
        ms.month_start,
        (SELECT COUNT(u.id)::int FROM "User" u
          WHERE u."createdAt" < (ms.month_start + INTERVAL '1 month')) AS total_users_at_end,
        (SELECT COUNT(u.id)::int FROM "User" u
          WHERE u."createdAt" < (ms.month_start + INTERVAL '1 month') AND u.tier = 'FREE') AS free_users,
        (SELECT COUNT(u.id)::int FROM "User" u
          WHERE u."createdAt" < (ms.month_start + INTERVAL '1 month') AND u.tier = 'PRO') AS pro_users,
        (SELECT COUNT(u.id)::int FROM "User" u
          WHERE u."trialStartDate" >= ms.month_start
            AND u."trialStartDate" < (ms.month_start + INTERVAL '1 month')) AS trial_starts,
        (SELECT COUNT(u.id)::int FROM "User" u
          WHERE u."trialConvertedAt" >= ms.month_start
            AND u."trialConvertedAt" < (ms.month_start + INTERVAL '1 month')) AS new_conversions,
        (SELECT COUNT(s.id)::int FROM "Subscription" s
          WHERE s."createdAt" < ms.month_start
            AND (s."status" = 'ACTIVE' OR s."updatedAt" >= ms.month_start)) AS active_start_subs,
        (SELECT COUNT(s.id)::int FROM "Subscription" s
          WHERE s."status" = 'CANCELED'
            AND s."updatedAt" >= ms.month_start
            AND s."updatedAt" < (ms.month_start + INTERVAL '1 month')) AS churned_subs
      FROM monthly_series ms
      ORDER BY ms.month_start ASC
    `,
    // Retained-after-60-days cohort: PRO users whose trial converted more
    // than 60 days ago and are still PRO today (a simple point-in-time
    // retention proxy -- no dedicated retention-cohort table exists).
    prisma.user.count({
      where: {
        tier: 'PRO',
        trialConvertedAt: {
          lte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  const historicalTrajectory = rows.map((row) => {
    const totalUsersAtEnd = row.total_users_at_end ?? 0;
    const freeUsers = row.free_users ?? 0;
    const proUsers = row.pro_users ?? 0;
    const activeStartSubs = row.active_start_subs ?? 0;
    const churnedSubs = row.churned_subs ?? 0;

    return {
      month: row.month_start.toISOString().slice(0, 7),
      monthLabel: monthLabel(row.month_start),
      totalUsersAtEnd,
      freeUsers,
      proUsers,
      trialStarts: row.trial_starts ?? 0,
      newConversions: row.new_conversions ?? 0,
      conversionRatePct:
        totalUsersAtEnd > 0 ? round2((proUsers / totalUsersAtEnd) * 100) : 0,
      activeStartSubs,
      churnedSubs,
      trueChurnRatePct:
        activeStartSubs > 0 ? round2((churnedSubs / activeStartSubs) * 100) : 0,
    };
  });

  const current = historicalTrajectory[historicalTrajectory.length - 1] ?? null;
  const previous =
    historicalTrajectory.length > 1
      ? historicalTrajectory[historicalTrajectory.length - 2]!
      : null;

  const totalUsers = current?.totalUsersAtEnd ?? 0;
  const freeUsers = current?.freeUsers ?? 0;
  const proUsers = current?.proUsers ?? 0;

  return {
    summary: {
      totalUsers,
      freeUsers,
      proUsers,
      freePercentage:
        totalUsers > 0 ? round2((freeUsers / totalUsers) * 100) : 0,
      proPercentage: totalUsers > 0 ? round2((proUsers / totalUsers) * 100) : 0,
      conversionRate: current?.conversionRatePct ?? 0,
      trueChurnRate: current?.trueChurnRatePct ?? 0,
      momGrowth: {
        totalUsersPct: growthPct(totalUsers, previous?.totalUsersAtEnd ?? null),
        freeUsersPct: growthPct(freeUsers, previous?.freeUsers ?? null),
        proUsersPct: growthPct(proUsers, previous?.proUsers ?? null),
      },
    },
    historicalTrajectory,
    funnelCohorts: {
      registeredSignups: totalUsers,
      trialsActivated: historicalTrajectory.reduce(
        (sum, r) => sum + r.trialStarts,
        0
      ),
      paidConversions: historicalTrajectory.reduce(
        (sum, r) => sum + r.newConversions,
        0
      ),
      retainedAfter60Days,
    },
  };
}

/**
 * Cached BI users analytics getter -- shared by the API route and the
 * Server Component dashboard page.
 */
export const getUsersAnalytics = unstable_cache(
  fetchUsersAnalytics,
  ['admin-analytics-users'],
  { revalidate: 300, tags: ['admin-analytics-users'] }
);
