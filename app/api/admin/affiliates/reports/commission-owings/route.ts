/**
 * Admin Commission Owings Report API Route
 *
 * GET: Get affiliates with pending commissions ready for payout
 *
 * @module app/api/admin/affiliates/reports/commission-owings/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';
import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION SCHEMAS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(10).max(100).default(20),
  minBalance: z.coerce.number().min(0).optional(),
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET - Commission Owings Report
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/admin/affiliates/reports/commission-owings
 *
 * Get affiliates with pending commissions that meet the minimum payout threshold.
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 * - minBalance: Minimum pending balance filter (default: MINIMUM_PAYOUT)
 *
 * @returns 200 - Commission owings report
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

    const { page, limit, minBalance } = validation.data;
    const minimumPayout = minBalance ?? AFFILIATE_CONFIG.MINIMUM_PAYOUT;

    // Get affiliates with pending commissions
    const affiliatesWithPending = await prisma.affiliateProfile.findMany({
      where: {
        status: 'ACTIVE',
        pendingCommissions: {
          gte: minimumPayout,
        },
      },
      select: {
        id: true,
        fullName: true,
        country: true,
        paymentMethod: true,
        paymentDetails: true,
        pendingCommissions: true,
        paidCommissions: true,
        totalEarnings: true,
        user: {
          select: {
            email: true,
          },
        },
        commissions: {
          where: {
            status: 'PENDING',
          },
          select: {
            id: true,
            commissionAmount: true,
            earnedAt: true,
          },
          orderBy: {
            earnedAt: 'asc',
          },
        },
      },
      orderBy: {
        pendingCommissions: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Get total count
    const totalCount = await prisma.affiliateProfile.count({
      where: {
        status: 'ACTIVE',
        pendingCommissions: {
          gte: minimumPayout,
        },
      },
    });

    // Transform data
    const affiliatesOwed = affiliatesWithPending.map((affiliate) => {
      // Get oldest pending commission date
      const oldestPending =
        affiliate.commissions.length > 0
          ? affiliate.commissions[0].earnedAt
          : null;

      return {
        id: affiliate.id,
        fullName: affiliate.fullName,
        email: affiliate.user.email,
        country: affiliate.country,
        paymentMethod: affiliate.paymentMethod,
        paymentDetails: affiliate.paymentDetails,
        balance: {
          pending: Number(affiliate.pendingCommissions),
          paid: Number(affiliate.paidCommissions),
          total: Number(affiliate.totalEarnings),
        },
        pendingCount: affiliate.commissions.length,
        oldestPendingDate: oldestPending,
        readyForPayout: Number(affiliate.pendingCommissions) >= AFFILIATE_CONFIG.MINIMUM_PAYOUT,
      };
    });

    // Calculate totals
    const totalOwed = affiliatesOwed.reduce(
      (sum, a) => sum + a.balance.pending,
      0
    );
    const affiliatesReadyCount = affiliatesOwed.filter(
      (a) => a.readyForPayout
    ).length;

    return NextResponse.json({
      summary: {
        totalAffiliatesOwed: totalCount,
        affiliatesReadyForPayout: affiliatesReadyCount,
        totalOwed: Math.round(totalOwed * 100) / 100,
        minimumPayoutThreshold: AFFILIATE_CONFIG.MINIMUM_PAYOUT,
      },
      affiliates: affiliatesOwed,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Admin commission owings report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate commission owings report' },
      { status: 500 }
    );
  }
}
