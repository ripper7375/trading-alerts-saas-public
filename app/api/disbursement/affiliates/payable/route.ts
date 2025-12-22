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
 * Returns all affiliates with pending approved commissions that meet the minimum payout threshold.
 *
 * @returns 200 - List of payable affiliates with summary
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

    const aggregator = new CommissionAggregator(prisma);
    const aggregates = await aggregator.getAllPayableAffiliates();

    // Build detailed affiliate info
    const affiliates = await Promise.all(
      aggregates.map(async (agg) => {
        const profile = await prisma.affiliateProfile.findUnique({
          where: { id: agg.affiliateId },
          include: {
            user: { select: { email: true } },
            riseAccount: true,
          },
        });

        if (!profile) {
          return null;
        }

        return {
          id: agg.affiliateId,
          fullName: profile.fullName,
          email: profile.user.email,
          country: profile.country,
          pendingAmount: agg.totalAmount,
          paidAmount: Number(profile.paidCommissions ?? 0),
          pendingCommissionCount: agg.commissionCount,
          oldestPendingDate: agg.oldestDate,
          readyForPayout: agg.canPayout,
          riseAccount: {
            hasAccount: !!profile.riseAccount,
            riseId: profile.riseAccount?.riseId ?? null,
            kycStatus: profile.riseAccount?.kycStatus ?? 'none',
            canReceivePayments: profile.riseAccount?.kycStatus === 'APPROVED',
          },
        };
      })
    );

    // Filter out null entries
    const validAffiliates = affiliates.filter((a) => a !== null);

    return NextResponse.json({
      affiliates: validAffiliates,
      summary: {
        totalAffiliates: validAffiliates.length,
        totalPendingAmount: aggregates.reduce(
          (sum, a) => sum + a.totalAmount,
          0
        ),
        readyForPayout: validAffiliates.filter((a) => a?.readyForPayout).length,
        awaitingRiseAccount: validAffiliates.filter(
          (a) => !a?.riseAccount.hasAccount
        ).length,
        awaitingKyc: validAffiliates.filter(
          (a) => a?.riseAccount.hasAccount && a.riseAccount.kycStatus !== 'APPROVED'
        ).length,
      },
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
