/**
 * Affiliate Commissions API Route (Part 19B)
 *
 * GET: Get pending approved commissions for an affiliate
 *
 * @module app/api/disbursement/affiliates/[affiliateId]/commissions/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';

interface RouteContext {
  params: Promise<{ affiliateId: string }>;
}

/**
 * GET /api/disbursement/affiliates/[affiliateId]/commissions
 *
 * Get all pending approved commissions for an affiliate that haven't been
 * linked to a disbursement transaction yet.
 *
 * @returns 200 - List of pending commissions
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 404 - Affiliate not found
 * @returns 500 - Server error
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Require admin access
    await requireAdmin();

    const { affiliateId } = await context.params;

    // Verify affiliate exists
    const profile = await prisma.affiliateProfile.findUnique({
      where: { id: affiliateId },
      select: { id: true, fullName: true },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Affiliate not found' },
        { status: 404 }
      );
    }

    // Get pending approved commissions not yet linked to a disbursement
    const commissions = await prisma.commission.findMany({
      where: {
        affiliateProfileId: affiliateId,
        status: 'APPROVED',
        disbursementTransaction: null,
      },
      include: {
        affiliateCode: {
          select: { code: true, discountPercent: true, commissionPercent: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    type CommissionWithCode = (typeof commissions)[number];

    // Calculate totals
    const totalAmount = commissions.reduce(
      (sum: number, comm: CommissionWithCode) => sum + Number(comm.commissionAmount),
      0
    );

    const totalGrossRevenue = commissions.reduce(
      (sum: number, comm: CommissionWithCode) => sum + Number(comm.grossRevenue),
      0
    );

    const totalDiscount = commissions.reduce(
      (sum: number, comm: CommissionWithCode) => sum + Number(comm.discountAmount),
      0
    );

    return NextResponse.json({
      affiliateId,
      affiliateName: profile.fullName,
      commissions: commissions.map((comm: CommissionWithCode) => ({
        id: comm.id,
        affiliateCodeId: comm.affiliateCodeId,
        code: comm.affiliateCode?.code,
        userId: comm.userId,
        subscriptionId: comm.subscriptionId,
        grossRevenue: Number(comm.grossRevenue),
        discountAmount: Number(comm.discountAmount),
        netRevenue: Number(comm.netRevenue),
        commissionAmount: Number(comm.commissionAmount),
        commissionPercent: comm.affiliateCode?.commissionPercent,
        status: comm.status,
        earnedAt: comm.earnedAt,
        approvedAt: comm.approvedAt,
        createdAt: comm.createdAt,
      })),
      summary: {
        count: commissions.length,
        totalAmount,
        totalGrossRevenue,
        totalDiscount,
        averageCommission: commissions.length > 0 ? totalAmount / commissions.length : 0,
        oldestCommission: commissions.length > 0 ? commissions[commissions.length - 1]?.createdAt : null,
        newestCommission: commissions.length > 0 ? commissions[0]?.createdAt : null,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Error fetching affiliate commissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch affiliate commissions' },
      { status: 500 }
    );
  }
}
