/**
 * Affiliate Details API Route (Part 19B)
 *
 * GET: Get detailed affiliate information for disbursement
 *
 * @module app/api/disbursement/affiliates/[affiliateId]/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';
import type { RiseWorksKycStatus } from '@/types/disbursement';

interface RouteParams {
  params: Promise<{ affiliateId: string }>;
}

/**
 * GET /api/disbursement/affiliates/[affiliateId]
 *
 * Returns detailed affiliate information including:
 * - Profile details
 * - RiseWorks account status
 * - Pending commissions summary
 * - Payment history
 *
 * @returns 200 - Affiliate details
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

    const profile = await prisma.affiliateProfile.findUnique({
      where: { id: affiliateId },
      include: {
        user: {
          select: {
            email: true,
            name: true,
            createdAt: true,
          },
        },
        riseAccount: true,
        commissions: {
          where: {
            status: 'APPROVED',
            disbursementTransaction: null,
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Affiliate not found' },
        { status: 404 }
      );
    }

    // Calculate totals
    const pendingAmount = profile.commissions.reduce(
      (sum, c) => sum + Number(c.commissionAmount),
      0
    );

    const hasRiseAccount = !!profile.riseAccount;
    const kycApproved =
      hasRiseAccount && profile.riseAccount?.kycStatus === 'APPROVED';
    const canReceivePayments = hasRiseAccount && kycApproved;

    return NextResponse.json({
      affiliate: {
        id: profile.id,
        fullName: profile.fullName,
        email: profile.user.email,
        country: profile.country,
        status: profile.status,
        paymentMethod: profile.paymentMethod,
        totalPending: pendingAmount,
        totalPaid: Number(profile.paidCommissions),
        pendingCommissionCount: profile.commissions.length,
        createdAt: profile.createdAt,
        riseAccount: hasRiseAccount
          ? {
              id: profile.riseAccount!.id,
              riseId: profile.riseAccount!.riseId,
              email: profile.riseAccount!.email,
              kycStatus: profile.riseAccount!.kycStatus as RiseWorksKycStatus,
              canReceivePayments,
              lastSyncAt: profile.riseAccount!.lastSyncAt,
            }
          : null,
        pendingCommissions: profile.commissions.map((c) => ({
          id: c.id,
          amount: Number(c.commissionAmount),
          type: c.commissionType,
          createdAt: c.createdAt,
        })),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Error fetching affiliate details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch affiliate details' },
      { status: 500 }
    );
  }
}
