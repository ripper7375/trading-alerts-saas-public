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
    _count: true,
  });

  type DistributionGroup = { distributionReason: string; _count: number };
  const monthlyDistribution =
    additionsByReason.find(
      (a: DistributionGroup) => a.distributionReason === 'MONTHLY'
    )?._count ?? 0;
  const initialDistribution =
    additionsByReason.find(
      (a: DistributionGroup) => a.distributionReason === 'INITIAL'
    )?._count ?? 0;
  const bonusDistribution =
    additionsByReason.find(
      (a: DistributionGroup) => a.distributionReason === 'ADMIN_BONUS'
    )?._count ?? 0;
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
      (b: { status: string; _sum: { commissionAmount: unknown } }) =>
        b.status === status
    );
    return Number(result?._sum.commissionAmount ?? 0);
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
    thisMonth: Number(thisMonth._sum.commissionAmount ?? 0),
    lastMonth: Number(lastMonth._sum.commissionAmount ?? 0),
  };
}
