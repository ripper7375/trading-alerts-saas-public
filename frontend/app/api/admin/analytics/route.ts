import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PRO_MONTHLY_PRICE = 29;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AnalyticsResponse {
  overview: {
    totalUsers: number;
    freeUsers: number;
    proUsers: number;
    freePercentage: number;
    proPercentage: number;
  };
  revenue: {
    mrr: number;
    arr: number;
    conversionRate: number;
    pricePerUser: number;
  };
  growth: {
    newUsersThisMonth: number;
    churnedThisMonth: number;
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET HANDLER - Fetch analytics data (admin only)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/admin/analytics - Fetch analytics data
 *
 * Returns:
 * - User overview (total, FREE, PRO counts and percentages)
 * - Revenue metrics (MRR, ARR, conversion rate)
 * - Growth metrics (new users, churn)
 *
 * @returns 200: Analytics data
 * @returns 401: Unauthorized (not logged in)
 * @returns 403: Forbidden (not admin)
 * @returns 500: Internal server error
 */
export async function GET(): Promise<
  NextResponse<AnalyticsResponse | { error: string }>
> {
  try {
    // Auth check
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin role check
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Get user counts by tier
    const [totalUsers, freeUsers, proUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { tier: 'FREE' } }),
      prisma.user.count({ where: { tier: 'PRO' } }),
    ]);

    // Calculate percentages
    const freePercentage = totalUsers > 0 ? (freeUsers / totalUsers) * 100 : 0;
    const proPercentage = totalUsers > 0 ? (proUsers / totalUsers) * 100 : 0;

    // Calculate revenue
    const mrr = proUsers * PRO_MONTHLY_PRICE;
    const arr = mrr * 12;

    // Calculate conversion rate
    const conversionRate = totalUsers > 0 ? (proUsers / totalUsers) * 100 : 0;

    // Get new users this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const newUsersThisMonth = await prisma.user.count({
      where: {
        createdAt: { gte: startOfMonth },
      },
    });

    // Churn calculation would require subscription history tracking
    // For now, return 0 as placeholder
    const churnedThisMonth = 0;

    return NextResponse.json({
      overview: {
        totalUsers,
        freeUsers,
        proUsers,
        freePercentage: Math.round(freePercentage * 100) / 100,
        proPercentage: Math.round(proPercentage * 100) / 100,
      },
      revenue: {
        mrr,
        arr,
        conversionRate: Math.round(conversionRate * 100) / 100,
        pricePerUser: PRO_MONTHLY_PRICE,
      },
      growth: {
        newUsersThisMonth,
        churnedThisMonth,
      },
    });
  } catch (error) {
    console.error('Admin analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
