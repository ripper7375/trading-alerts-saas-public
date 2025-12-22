/**
 * Affiliate Details API Route (Part 19B)
 *
 * GET: Get detailed information about a specific affiliate for disbursement
 *
 * @module app/api/disbursement/affiliates/[affiliateId]/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';
import { CommissionAggregator } from '@/lib/disbursement/services/commission-aggregator';

interface RouteParams {
  params: Promise<{ affiliateId: string }>;
}

/**
 * GET /api/disbursement/affiliates/[affiliateId]
 *
 * Returns detailed affiliate information including pending commissions and Rise account status.
 *
 * @param affiliateId - The affiliate profile ID
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
    // Require admin access
    await requireAdmin();

    const { affiliateId } = await params;

    // Get affiliate profile with related data
    const profile = await prisma.affiliateProfile.findUnique({
      where: { id: affiliateId },
      include: {
        user: { select: { email: true, name: true, createdAt: true } },
        riseAccount: true,
        commissions: {
          where: { status: 'APPROVED' },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Affiliate not found' },
        { status: 404 }
      );
    }

    // Get commission aggregates
    const aggregator = new CommissionAggregator(prisma);
    const aggregate = await aggregator.getAggregatesByAffiliate(affiliateId);

    // Get disbursement transaction history
    const disbursementHistory = await prisma.disbursementTransaction.findMany({
      where: {
        commission: {
          affiliateProfileId: affiliateId,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        batch: {
          select: {
            batchNumber: true,
            executedAt: true,
          },
        },
      },
    });

    return NextResponse.json({
      affiliate: {
        id: profile.id,
        fullName: profile.fullName,
        email: profile.user.email,
        country: profile.country,
        status: profile.status,
        memberSince: profile.user.createdAt,

        // Financial summary
        totalPending: Number(profile.totalPending ?? 0),
        totalPaid: Number(profile.paidCommissions ?? 0),
        totalEarned: Number(profile.totalEarnings ?? 0),

        // Payout eligibility
        pendingAmount: aggregate.totalAmount,
        pendingCommissionCount: aggregate.commissionCount,
        canPayout: aggregate.canPayout,
        payoutReason: aggregate.reason,
        oldestPendingDate: aggregate.oldestDate,

        // Rise account
        riseAccount: profile.riseAccount
          ? {
              id: profile.riseAccount.id,
              riseId: profile.riseAccount.riseId,
              email: profile.riseAccount.email,
              kycStatus: profile.riseAccount.kycStatus,
              kycCompletedAt: profile.riseAccount.kycCompletedAt,
              invitationSentAt: profile.riseAccount.invitationSentAt,
              invitationAcceptedAt: profile.riseAccount.invitationAcceptedAt,
              lastSyncAt: profile.riseAccount.lastSyncAt,
              canReceivePayments: profile.riseAccount.kycStatus === 'APPROVED',
            }
          : null,
      },

      // Pending commissions
      pendingCommissions: profile.commissions.map((comm) => ({
        id: comm.id,
        amount: Number(comm.commissionAmount),
        currency: 'USD',
        type: 'REFERRAL', // Commission type - referral-based
        status: comm.status,
        createdAt: comm.createdAt,
        referredUser: comm.userId ?? 'Unknown',
        referredTier: 'PRO', // Upgraded to PRO tier
      })),

      // Recent disbursements
      disbursementHistory: disbursementHistory.map((txn) => ({
        id: txn.id,
        transactionId: txn.transactionId,
        amount: Number(txn.amount),
        currency: txn.currency,
        status: txn.status,
        batchNumber: txn.batch.batchNumber,
        executedAt: txn.batch.executedAt,
        completedAt: txn.completedAt,
        errorMessage: txn.errorMessage,
      })),
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
