/**
 * Affiliate Report Builder
 *
 * Generates reports for affiliate dashboard including
 * code inventory and commission tracking.
 *
 * @module lib/affiliate/report-builder
 */

import { prisma } from '@/lib/db/prisma';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Code inventory report structure
 */
export interface CodeInventoryReport {
  period: {
    start: Date;
    end: Date;
  };
  openingBalance: number;
  additions: {
    monthlyDistribution: number;
    initialDistribution: number;
    bonusDistribution: number;
    total: number;
  };
  reductions: {
    used: number;
    expired: number;
    cancelled: number;
    total: number;
  };
  closingBalance: number;
}

/**
 * Dashboard stats structure
 */
export interface DashboardStats {
  activeCodes: number;
  usedCodes: number;
  expiredCodes: number;
  totalEarnings: number;
  pendingBalance: number;
  paidBalance: number;
  conversionRate: number;
}

/**
 * Commission summary structure
 */
export interface CommissionSummary {
  totalEarned: number;
  pending: number;
  approved: number;
  paid: number;
  cancelled: number;
  thisMonth: number;
  lastMonth: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DASHBOARD STATS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Build dashboard statistics for an affiliate
 *
 * @param affiliateProfileId - ID of affiliate profile
 * @returns Dashboard statistics
 */
export async function buildDashboardStats(
  affiliateProfileId: string
): Promise<DashboardStats> {
  const [activeCodes, usedCodes, expiredCodes, profile] = await Promise.all([
    // Count active codes
    prisma.affiliateCode.count({
      where: {
        affiliateProfileId,
        status: 'ACTIVE',
      },
    }),
    // Count used codes
    prisma.affiliateCode.count({
      where: {
        affiliateProfileId,
        status: 'USED',
      },
    }),
    // Count expired codes
    prisma.affiliateCode.count({
      where: {
        affiliateProfileId,
        status: 'EXPIRED',
      },
    }),
    // Get profile for balances
    prisma.affiliateProfile.findUnique({
      where: { id: affiliateProfileId },
      select: {
        totalEarnings: true,
        pendingCommissions: true,
        paidCommissions: true,
        totalCodesDistributed: true,
        totalCodesUsed: true,
      },
    }),
  ]);

  const totalCodesUsed = profile?.totalCodesUsed ?? 0;
  const totalCodesDistributed = profile?.totalCodesDistributed ?? 0;
  const conversionRate =
    totalCodesDistributed > 0
      ? (totalCodesUsed / totalCodesDistributed) * 100
      : 0;

  return {
    activeCodes,
    usedCodes,
    expiredCodes,
    totalEarnings: Number(profile?.totalEarnings ?? 0),
    pendingBalance: Number(profile?.pendingCommissions ?? 0),
    paidBalance: Number(profile?.paidCommissions ?? 0),
    conversionRate: Math.round(conversionRate * 100) / 100,
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CODE INVENTORY REPORT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Global code flows report structure (all affiliates)
 *
 * Same reconciliation shape as CodeInventoryReport, plus the number
 * of affiliates that had code activity during the period.
 */
export interface GlobalCodeFlowsReport extends CodeInventoryReport {
  affiliatesWithActivity: number;
}

/**
 * Build code inventory report for a time period
 *
 * Shows opening balance, additions, reductions, and closing balance.
 *
 * @param affiliateProfileId - ID of affiliate profile
 * @param period - Start and end dates for the report
 * @returns Code inventory report
 */
export async function buildCodeInventoryReport(
  affiliateProfileId: string,
  period: { start: Date; end: Date }
): Promise<CodeInventoryReport> {
  // Count codes that existed before period start and weren't used before period
  const openingBalance = await prisma.affiliateCode.count({
    where: {
      affiliateProfileId,
      distributedAt: { lt: period.start },
      OR: [{ usedAt: null }, { usedAt: { gte: period.start } }],
      status: { not: 'CANCELLED' },
    },
  });

  // Get additions during period
  const additionsByReason = await prisma.affiliateCode.groupBy({
    by: ['distributionReason'],
    where: {
      affiliateProfileId,
      distributedAt: {
        gte: period.start,
        lte: period.end,
      },
    },
    _count: { _all: true },
  });

  const monthlyDistribution =
    (
      additionsByReason.find(
        (a: Record<string, unknown>) => a['distributionReason'] === 'MONTHLY'
      )?.['_count'] as { _all: number } | undefined
    )?.['_all'] ?? 0;
  const initialDistribution =
    (
      additionsByReason.find(
        (a: Record<string, unknown>) => a['distributionReason'] === 'INITIAL'
      )?.['_count'] as { _all: number } | undefined
    )?.['_all'] ?? 0;
  const bonusDistribution =
    (
      additionsByReason.find(
        (a: Record<string, unknown>) =>
          a['distributionReason'] === 'ADMIN_BONUS'
      )?.['_count'] as { _all: number } | undefined
    )?.['_all'] ?? 0;
  const totalAdditions =
    monthlyDistribution + initialDistribution + bonusDistribution;

  // Get reductions during period
  const [usedCount, expiredCount, cancelledCount] = await Promise.all([
    prisma.affiliateCode.count({
      where: {
        affiliateProfileId,
        status: 'USED',
        usedAt: {
          gte: period.start,
          lte: period.end,
        },
      },
    }),
    prisma.affiliateCode.count({
      where: {
        affiliateProfileId,
        status: 'EXPIRED',
        expiresAt: {
          gte: period.start,
          lte: period.end,
        },
      },
    }),
    prisma.affiliateCode.count({
      where: {
        affiliateProfileId,
        status: 'CANCELLED',
        cancelledAt: {
          gte: period.start,
          lte: period.end,
        },
      },
    }),
  ]);

  const totalReductions = usedCount + expiredCount + cancelledCount;
  const closingBalance = openingBalance + totalAdditions - totalReductions;

  return {
    period,
    openingBalance,
    additions: {
      monthlyDistribution,
      initialDistribution,
      bonusDistribution,
      total: totalAdditions,
    },
    reductions: {
      used: usedCount,
      expired: expiredCount,
      cancelled: cancelledCount,
      total: totalReductions,
    },
    closingBalance,
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GLOBAL CODE FLOWS REPORT (ALL AFFILIATES)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Build the GLOBAL code flows report for a time period, across all
 * affiliates. Mirrors buildCodeInventoryReport without the per-affiliate
 * filter: closing = opening + additions − (used + expired + cancelled),
 * where the balance counts ACTIVE (distributed, unused) codes.
 *
 * @param period - Start and end dates for the report
 * @returns Global code flows report
 */
export async function buildGlobalCodeInventoryReport(period: {
  start: Date;
  end: Date;
}): Promise<GlobalCodeFlowsReport> {
  // Codes that existed before period start and weren't used before it
  const openingBalance = await prisma.affiliateCode.count({
    where: {
      distributedAt: { lt: period.start },
      OR: [{ usedAt: null }, { usedAt: { gte: period.start } }],
      status: { not: 'CANCELLED' },
    },
  });

  // Additions during period, grouped by distribution reason
  const additionsByReason = await prisma.affiliateCode.groupBy({
    by: ['distributionReason'],
    where: {
      distributedAt: { gte: period.start, lte: period.end },
    },
    _count: { _all: true },
  });

  const countForReason = (reason: string): number =>
    (
      additionsByReason.find(
        (a: Record<string, unknown>) => a['distributionReason'] === reason
      )?.['_count'] as { _all: number } | undefined
    )?.['_all'] ?? 0;

  const monthlyDistribution = countForReason('MONTHLY');
  const initialDistribution = countForReason('INITIAL');
  const bonusDistribution = countForReason('ADMIN_BONUS');
  const totalAdditions =
    monthlyDistribution + initialDistribution + bonusDistribution;

  // Reductions during period + distinct affiliates with activity
  const [usedCount, expiredCount, cancelledCount, activeAffiliateGroups] =
    await Promise.all([
      prisma.affiliateCode.count({
        where: {
          status: 'USED',
          usedAt: { gte: period.start, lte: period.end },
        },
      }),
      prisma.affiliateCode.count({
        where: {
          status: 'EXPIRED',
          expiresAt: { gte: period.start, lte: period.end },
        },
      }),
      prisma.affiliateCode.count({
        where: {
          status: 'CANCELLED',
          cancelledAt: { gte: period.start, lte: period.end },
        },
      }),
      prisma.affiliateCode.groupBy({
        by: ['affiliateProfileId'],
        where: {
          OR: [
            { distributedAt: { gte: period.start, lte: period.end } },
            { usedAt: { gte: period.start, lte: period.end } },
          ],
        },
      }),
    ]);

  const totalReductions = usedCount + expiredCount + cancelledCount;
  const closingBalance = openingBalance + totalAdditions - totalReductions;

  return {
    period,
    openingBalance,
    additions: {
      monthlyDistribution,
      initialDistribution,
      bonusDistribution,
      total: totalAdditions,
    },
    reductions: {
      used: usedCount,
      expired: expiredCount,
      cancelled: cancelledCount,
      total: totalReductions,
    },
    closingBalance,
    affiliatesWithActivity: activeAffiliateGroups.length,
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMMISSION SUMMARY
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Build commission summary for an affiliate
 *
 * @param affiliateProfileId - ID of affiliate profile
 * @returns Commission summary with totals by status
 */
export async function buildCommissionSummary(
  affiliateProfileId: string
): Promise<CommissionSummary> {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const [byStatus, thisMonth, lastMonth] = await Promise.all([
    // Group by status
    prisma.commission.groupBy({
      by: ['status'],
      where: { affiliateProfileId },
      _sum: { commissionAmount: true },
    }),
    // This month earnings
    prisma.commission.aggregate({
      where: {
        affiliateProfileId,
        earnedAt: { gte: thisMonthStart },
      },
      _sum: { commissionAmount: true },
    }),
    // Last month earnings
    prisma.commission.aggregate({
      where: {
        affiliateProfileId,
        earnedAt: {
          gte: lastMonthStart,
          lte: lastMonthEnd,
        },
      },
      _sum: { commissionAmount: true },
    }),
  ]);

  const getAmountByStatus = (status: string): number => {
    const result = byStatus.find(
      (b: Record<string, unknown>) => b['status'] === status
    );
    return Number(
      (result?.['_sum'] as { commissionAmount?: number } | undefined)
        ?.commissionAmount ?? 0
    );
  };

  const pending = getAmountByStatus('PENDING');
  const approved = getAmountByStatus('APPROVED');
  const paid = getAmountByStatus('PAID');
  const cancelled = getAmountByStatus('CANCELLED');
  const totalEarned = pending + approved + paid;

  return {
    totalEarned,
    pending,
    approved,
    paid,
    cancelled,
    thisMonth: Number(
      (thisMonth['_sum'] as { commissionAmount?: number } | undefined)
        ?.commissionAmount ?? 0
    ),
    lastMonth: Number(
      (lastMonth['_sum'] as { commissionAmount?: number } | undefined)
        ?.commissionAmount ?? 0
    ),
  };
}
