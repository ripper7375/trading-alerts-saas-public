/**
 * Affiliate Commissions API Route (Part 19B)
 *
 * GET: Get pending commissions for a specific affiliate
 *
 * @module app/api/disbursement/affiliates/[affiliateId]/commissions/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';

interface RouteParams {
  params: Promise<{ affiliateId: string }>;
}

/**
 * GET /api/disbursement/affiliates/[affiliateId]/commissions
 *
 * Returns all pending approved commissions for a specific affiliate
 * that are eligible for disbursement (not yet linked to a transaction).
 *
 * @returns 200 - List of commissions with summary
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 404 - Affiliate not found
 * @returns 500 - Server error
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    await requireAdmin();

    const { affiliateId } = await params;

    // Verify affiliate exists
    const affiliate = await prisma.affiliateProfile.findUnique({
      where: { id: affiliateId },
      select: { id: true, fullName: true },
    });

    if (!affiliate) {
      return NextResponse.json(
        { error: 'Affiliate not found' },
        { status: 404 }
      );
    }

    // Get pending commissions
    const commissions = await prisma.commission.findMany({
      where: {
        affiliateProfileId: affiliateId,
        status: 'APPROVED',
        disbursementTransaction: null,
      },
      include: {
        subscription: {
          select: {
            user: {
              select: {
                email: true,
                name: true,
              },
            },
            tier: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate summary
    const totalAmount = commissions.reduce(
      (sum, comm) => sum + Number(comm.commissionAmount),
      0
    );

    // Group by type
    const byType: Record<string, { count: number; amount: number }> = {};
    for (const comm of commissions) {
      const type = comm.commissionType;
      if (!byType[type]) {
        byType[type] = { count: 0, amount: 0 };
      }
      byType[type].count++;
      byType[type].amount += Number(comm.commissionAmount);
    }

    return NextResponse.json({
      affiliateId,
      affiliateName: affiliate.fullName,
      commissions: commissions.map((c) => ({
        id: c.id,
        amount: Number(c.commissionAmount),
        type: c.commissionType,
        status: c.status,
        createdAt: c.createdAt,
        referredUser: c.subscription?.user
          ? {
              email: c.subscription.user.email,
              name: c.subscription.user.name,
            }
          : null,
        subscriptionTier: c.subscription?.tier,
      })),
      summary: {
        count: commissions.length,
        totalAmount,
        byType,
        oldestCommission:
          commissions.length > 0
            ? commissions[commissions.length - 1]?.createdAt
            : null,
        newestCommission:
          commissions.length > 0 ? commissions[0]?.createdAt : null,
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
