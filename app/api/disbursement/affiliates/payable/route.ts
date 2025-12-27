/**
 * Payable Affiliates API Route (Part 19B)
 *
 * GET: List all affiliates with pending commissions ready for payout
 *
 * @module app/api/disbursement/affiliates/payable/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';
import { CommissionAggregator } from '@/lib/disbursement/services/commission-aggregator';

/**
 * GET /api/disbursement/affiliates/payable
 *
 * List all affiliates with pending approved commissions that meet payout threshold.
 * Includes RiseWorks account status and payout readiness.
 *
 * @returns 200 - List of payable affiliates with summary
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Require admin access
    await requireAdmin();

    const aggregator = new CommissionAggregator(prisma);
    const aggregates = await aggregator.getAllPayableAffiliates();

    // Enrich with affiliate profile details
    const affiliates = await Promise.all(
      aggregates.map(async (agg) => {
        const profile = await prisma.affiliateProfile.findUnique({
          where: { id: agg.affiliateId },
          include: {
            user: { select: { email: true } },
            riseAccount: true,
          },
        });

        const hasRiseAccount = !!profile?.riseAccount;
        const kycApproved = profile?.riseAccount?.kycStatus === 'APPROVED';
        const canReceivePayments = hasRiseAccount && kycApproved;

        return {
          id: agg.affiliateId,
          fullName: profile?.fullName || 'Unknown',
          email: profile?.user?.email || '',
          country: profile?.country || '',
          pendingAmount: agg.totalAmount,
          paidAmount: Number(profile?.paidCommissions || 0),
          pendingCommissionCount: agg.commissionCount,
          oldestPendingDate: agg.oldestDate,
          readyForPayout: agg.canPayout && canReceivePayments,
          meetsThreshold: agg.canPayout,
          riseAccount: {
            hasAccount: hasRiseAccount,
            riseId: profile?.riseAccount?.riseId,
            kycStatus: profile?.riseAccount?.kycStatus || 'PENDING',
            canReceivePayments,
          },
        };
      })
    );

    // Calculate summary
    const summary = {
      totalAffiliates: affiliates.length,
      totalPendingAmount: aggregates.reduce((sum, a) => sum + a.totalAmount, 0),
      readyForPayout: affiliates.filter((a) => a.readyForPayout).length,
      meetsThreshold: affiliates.filter((a) => a.meetsThreshold).length,
      withRiseAccount: affiliates.filter((a) => a.riseAccount.hasAccount)
        .length,
      withApprovedKyc: affiliates.filter(
        (a) => a.riseAccount.canReceivePayments
      ).length,
    };

    return NextResponse.json({
      affiliates,
      summary,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Error fetching payable affiliates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payable affiliates' },
      { status: 500 }
    );
  }
}
