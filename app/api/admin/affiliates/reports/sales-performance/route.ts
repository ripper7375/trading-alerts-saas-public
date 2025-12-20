/**
 * Admin Sales Performance Report API Route
 *
 * GET: Generate sales performance report by affiliate
 *
 * @module app/api/admin/affiliates/reports/sales-performance/route
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
  limit: z.coerce.number().min(10).max(100).default(20),
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET - Sales Performance Report
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/admin/affiliates/reports/sales-performance
 *
 * Generate sales performance report showing top affiliates by:
 * - Conversion count
 * - Total commissions earned
 * - Conversion rate
 *
 * Query params:
 * - period: 3months | 6months | 1year (default: 3months)
 * - limit: Number of top affiliates to return (default: 20)
 *
 * @returns 200 - Sales performance report
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse> {
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

    const { period, limit } = validation.data;
    const { start, end } = getReportingPeriod(period as '3months' | '6months' | '1year');

    // Get affiliate performance grouped by affiliate
    const affiliatePerformance = await prisma.affiliateProfile.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        id: true,
        fullName: true,
        country: true,
        totalCodesDistributed: true,
        totalCodesUsed: true,
        commissions: {
          where: {
            earnedAt: {
              gte: start,
              lte: end,
            },
          },
          select: {
            commissionAmount: true,
            status: true,
          },
        },
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        totalCodesUsed: 'desc',
      },
      take: limit,
    });

    // Transform data
    const topPerformers = affiliatePerformance.map((affiliate) => {
      const totalCommissions = affiliate.commissions.reduce(
        (sum, c) => sum + Number(c.commissionAmount),
        0
      );
      const conversionCount = affiliate.commissions.length;
      const conversionRate =
        affiliate.totalCodesDistributed > 0
          ? (affiliate.totalCodesUsed / affiliate.totalCodesDistributed) * 100
          : 0;

      return {
        id: affiliate.id,
        fullName: affiliate.fullName,
        email: affiliate.user.email,
        country: affiliate.country,
        metrics: {
          codesDistributed: affiliate.totalCodesDistributed,
          codesUsed: affiliate.totalCodesUsed,
          conversionsPeriod: conversionCount,
          totalCommissions: Math.round(totalCommissions * 100) / 100,
          conversionRate: Math.round(conversionRate * 10) / 10,
        },
      };
    });

    // Sort by conversions in period
    topPerformers.sort(
      (a, b) => b.metrics.conversionsPeriod - a.metrics.conversionsPeriod
    );

    // Calculate totals
    const totalConversions = topPerformers.reduce(
      (sum, a) => sum + a.metrics.conversionsPeriod,
      0
    );
    const totalCommissionsEarned = topPerformers.reduce(
      (sum, a) => sum + a.metrics.totalCommissions,
      0
    );

    return NextResponse.json({
      period: {
        start,
        end,
        name: period,
      },
      summary: {
        totalAffiliates: topPerformers.length,
        totalConversions,
        totalCommissionsEarned: Math.round(totalCommissionsEarned * 100) / 100,
        averageConversionsPerAffiliate:
          topPerformers.length > 0
            ? Math.round((totalConversions / topPerformers.length) * 10) / 10
            : 0,
      },
      topPerformers,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Admin sales performance report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate sales performance report' },
      { status: 500 }
    );
  }
}
