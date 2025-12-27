/**
 * Admin Code Inventory Report API Route
 *
 * GET: Get global code inventory statistics
 *
 * @module app/api/admin/affiliates/reports/code-inventory/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';
import { getReportingPeriod } from '@/lib/admin/pnl-calculator';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION SCHEMAS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const querySchema = z.object({
  period: z.enum(['3months', '6months', '1year']).default('3months'),
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET - Code Inventory Report
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/admin/affiliates/reports/code-inventory
 *
 * Get global code inventory showing:
 * - Total codes distributed
 * - Active, used, expired, cancelled counts
 * - Distribution by reason
 * - Conversion metrics
 *
 * Query params:
 * - period: 3months | 6months | 1year (default: 3months)
 *
 * @returns 200 - Code inventory report
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Require admin access
    await requireAdmin();

    // Parse query params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const validation = querySchema.safeParse(searchParams);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const { period } = validation.data;
    const { start, end } = getReportingPeriod(
      period as '3months' | '6months' | '1year'
    );

    // Get code statistics
    const [
      totalCodes,
      statusCounts,
      reasonCounts,
      periodDistributed,
      periodUsed,
      periodExpired,
      expiringIn7Days,
    ] = await Promise.all([
      // Total codes all time
      prisma.affiliateCode.count(),

      // Codes by status
      prisma.affiliateCode.groupBy({
        by: ['status'],
        _count: true,
      }),

      // Codes by distribution reason
      prisma.affiliateCode.groupBy({
        by: ['distributionReason'],
        _count: true,
      }),

      // Codes distributed in period
      prisma.affiliateCode.count({
        where: {
          distributedAt: {
            gte: start,
            lte: end,
          },
        },
      }),

      // Codes used in period
      prisma.affiliateCode.count({
        where: {
          usedAt: {
            gte: start,
            lte: end,
          },
        },
      }),

      // Codes expired in period
      prisma.affiliateCode.count({
        where: {
          status: 'EXPIRED',
          expiresAt: {
            gte: start,
            lte: end,
          },
        },
      }),

      // Codes expiring in next 7 days
      prisma.affiliateCode.count({
        where: {
          status: 'ACTIVE',
          expiresAt: {
            gte: new Date(),
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Parse status counts
    const getStatusCount = (status: string): number => {
      const found = statusCounts.find((s) => s['status'] === status);
      return (found?.['_count'] as number) ?? 0;
    };

    // Parse reason counts
    const getReasonCount = (reason: string): number => {
      const found = reasonCounts.find(
        (r) => r['distributionReason'] === reason
      );
      return (found?.['_count'] as number) ?? 0;
    };

    const activeCodes = getStatusCount('ACTIVE');
    const usedCodes = getStatusCount('USED');
    const expiredCodes = getStatusCount('EXPIRED');
    const cancelledCodes = getStatusCount('CANCELLED');

    // Calculate conversion rate
    const conversionRate = totalCodes > 0 ? (usedCodes / totalCodes) * 100 : 0;

    return NextResponse.json({
      period: {
        start,
        end,
        name: period,
      },
      allTime: {
        totalCodes,
        byStatus: {
          active: activeCodes,
          used: usedCodes,
          expired: expiredCodes,
          cancelled: cancelledCodes,
        },
        byReason: {
          initial: getReasonCount('INITIAL'),
          monthly: getReasonCount('MONTHLY'),
          adminBonus: getReasonCount('ADMIN_BONUS'),
        },
        conversionRate: Math.round(conversionRate * 10) / 10,
      },
      periodMetrics: {
        distributed: periodDistributed,
        used: periodUsed,
        expired: periodExpired,
        periodConversionRate:
          periodDistributed > 0
            ? Math.round((periodUsed / periodDistributed) * 100 * 10) / 10
            : 0,
      },
      alerts: {
        expiringIn7Days,
        lowActiveCodesWarning: activeCodes < 50,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Admin code inventory report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate code inventory report' },
      { status: 500 }
    );
  }
}
