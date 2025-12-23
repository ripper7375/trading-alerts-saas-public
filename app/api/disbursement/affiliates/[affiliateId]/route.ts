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
import { CommissionAggregator } from '@/lib/disbursement/services/commission-aggregator';

interface RouteContext {
  params: Promise<{ affiliateId: string }>;
}

/**
 * GET /api/disbursement/affiliates/[affiliateId]
 *
 * Get detailed affiliate information including pending commissions,
 * RiseWorks account status, and payout history.
 *
 * @returns 200 - Affiliate details
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

    // Get affiliate profile with related data
    const profile = await prisma.affiliateProfile.findUnique({
      where: { id: affiliateId },
      include: {
        user: { select: { email: true, createdAt: true } },
        riseAccount: true,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Affiliate not found' },
        { status: 404 }
      );
    }

    // Get commission aggregate
    const aggregator = new CommissionAggregator(prisma);
    const aggregate = await aggregator.getAggregatesByAffiliate(affiliateId);

    // Get recent disbursement transactions
    const recentTransactions = await prisma.disbursementTransaction.findMany({
      where: {
        commission: {
          affiliateProfileId: affiliateId,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        batch: {
          select: {
            batchNumber: true,
            status: true,
          },
        },
      },
    });

    // Calculate payout readiness
    const hasRiseAccount = !!profile.riseAccount;
    const kycApproved = profile.riseAccount?.kycStatus === 'APPROVED';
    const canReceivePayments = hasRiseAccount && kycApproved;

    type RecentTransaction = (typeof recentTransactions)[number];

    return NextResponse.json({
      affiliate: {
        id: profile.id,
        fullName: profile.fullName,
        email: profile.user.email,
        country: profile.country,
        status: profile.status,
        createdAt: profile.createdAt,
        verifiedAt: profile.verifiedAt,
        stats: {
          totalPending: Number(profile.pendingCommissions),
          totalPaid: Number(profile.paidCommissions),
          totalEarnings: Number(profile.totalEarnings),
          codesDistributed: profile.totalCodesDistributed,
          codesUsed: profile.totalCodesUsed,
        },
        paymentInfo: {
          paymentMethod: profile.paymentMethod,
          paymentDetails: profile.paymentDetails,
        },
      },
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
            canReceivePayments,
          }
        : null,
      pendingCommissions: {
        count: aggregate.commissionCount,
        totalAmount: aggregate.totalAmount,
        oldestDate: aggregate.oldestDate,
        meetsThreshold: aggregate.canPayout,
        commissionIds: aggregate.commissionIds,
      },
      recentTransactions: recentTransactions.map((txn: RecentTransaction) => ({
        id: txn.id,
        transactionId: txn.transactionId,
        amount: Number(txn.amount),
        status: txn.status,
        createdAt: txn.createdAt,
        completedAt: txn.completedAt,
        batchNumber: txn.batch.batchNumber,
        batchStatus: txn.batch.status,
      })),
      readyForPayout: aggregate.canPayout && canReceivePayments,
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
