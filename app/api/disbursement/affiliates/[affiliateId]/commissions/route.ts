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
 * Returns pending approved commissions for an affiliate that are eligible for disbursement.
 *
 * Query params:
 * - status: Filter by commission status (default: APPROVED)
 * - limit: Max number of commissions to return (default: 100)
 *
 * @param affiliateId - The affiliate profile ID
 * @returns 200 - List of pending commissions with summary
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 404 - Affiliate not found
 * @returns 500 - Server error
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    // Require admin access
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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? 'APPROVED';
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500);

    // Get commissions
    const commissions = await prisma.commission.findMany({
      where: {
        affiliateProfileId: affiliateId,
        status: status as 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED',
        // Only include commissions not already linked to a disbursement
        disbursementTransaction: null,
      },
      include: {
        subscription: {
          select: {
            user: { select: { email: true } },
            tier: true,
            startDate: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Calculate totals
    const totalAmount = commissions.reduce(
      (sum, comm) => sum + Number(comm.commissionAmount),
      0
    );

    // Group by type
    const byType = commissions.reduce((acc, comm) => {
      const type = comm.commissionType;
      if (!acc[type]) {
        acc[type] = { count: 0, amount: 0 };
      }
      acc[type].count++;
      acc[type].amount += Number(comm.commissionAmount);
      return acc;
    }, {} as Record<string, { count: number; amount: number }>);

    return NextResponse.json({
      affiliateId,
      affiliateName: affiliate.fullName,

      commissions: commissions.map((comm) => ({
        id: comm.id,
        amount: Number(comm.commissionAmount),
        currency: 'USD',
        type: comm.commissionType,
        tier: comm.tier ?? 1,
        status: comm.status,
        createdAt: comm.createdAt,
        referredUser: comm.subscription?.user?.email ?? 'Unknown',
        referredTier: comm.subscription?.tier ?? 'Unknown',
        subscriptionStartDate: comm.subscription?.startDate ?? null,
      })),

      summary: {
        count: commissions.length,
        totalAmount,
        byType,
        oldestCommission: commissions.length > 0
          ? commissions[commissions.length - 1].createdAt
          : null,
        newestCommission: commissions.length > 0
          ? commissions[0].createdAt
          : null,
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
      { error: 'Failed to fetch commissions' },
      { status: 500 }
    );
  }
}
