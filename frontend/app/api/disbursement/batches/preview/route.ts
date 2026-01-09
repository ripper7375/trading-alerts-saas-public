/**
 * Batch Preview API Route (Part 19B)
 *
 * POST: Preview a payment batch before creation
 *
 * @module app/api/disbursement/batches/preview/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';
import { CommissionAggregator } from '@/lib/disbursement/services/commission-aggregator';
import { PayoutCalculator } from '@/lib/disbursement/services/payout-calculator';
import { MINIMUM_PAYOUT_USD } from '@/lib/disbursement/constants';

/**
 * Request body schema
 */
const previewSchema = z.object({
  affiliateIds: z.array(z.string()).optional(),
  feePercentage: z.number().min(0).max(100).default(0),
});

/**
 * POST /api/disbursement/batches/preview
 *
 * Preview a payment batch without creating it.
 * Shows which affiliates would be included and calculated amounts.
 *
 * @returns 200 - Preview data
 * @returns 400 - Invalid request body
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Require admin access
    await requireAdmin();

    // Parse and validate body
    const body = await request.json();
    const validation = previewSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { affiliateIds, feePercentage } = validation.data;

    const aggregator = new CommissionAggregator(prisma);

    // Get aggregates for specified affiliates or all payable affiliates
    let aggregates;
    if (affiliateIds && affiliateIds.length > 0) {
      aggregates = await Promise.all(
        affiliateIds.map((id: string) =>
          aggregator.getAggregatesByAffiliate(id)
        )
      );
    } else {
      aggregates = await aggregator.getAllPayableAffiliates();
    }

    type CommissionAgg = (typeof aggregates)[number];

    // Calculate payout for all aggregates
    const batchSummary = PayoutCalculator.calculateBatchTotal(
      aggregates,
      feePercentage
    );

    // Get affiliate details for preview
    const previewItems = await Promise.all(
      aggregates.map(async (agg: CommissionAgg) => {
        const profile = await prisma.affiliateProfile.findUnique({
          where: { id: agg.affiliateId },
          include: {
            user: { select: { email: true } },
            riseAccount: true,
          },
        });

        const calculation = PayoutCalculator.calculatePayout(
          agg,
          feePercentage
        );
        const hasRiseAccount = !!profile?.riseAccount;
        const kycApproved = profile?.riseAccount?.kycStatus === 'APPROVED';
        const canReceivePayments = hasRiseAccount && kycApproved;

        let status:
          | 'ready'
          | 'below_threshold'
          | 'no_rise_account'
          | 'kyc_pending';
        let statusReason: string;

        if (!calculation.eligible) {
          status = 'below_threshold';
          statusReason = `Below minimum of $${MINIMUM_PAYOUT_USD}`;
        } else if (!hasRiseAccount) {
          status = 'no_rise_account';
          statusReason = 'No RiseWorks account linked';
        } else if (!kycApproved) {
          status = 'kyc_pending';
          statusReason = `KYC status: ${profile?.riseAccount?.kycStatus}`;
        } else {
          status = 'ready';
          statusReason = 'Ready for payout';
        }

        return {
          affiliateId: agg.affiliateId,
          affiliateName: profile?.fullName || 'Unknown',
          affiliateEmail: profile?.user?.email || '',
          country: profile?.country || '',
          commissionCount: agg.commissionCount,
          grossAmount: agg.totalAmount,
          feeAmount: calculation.feeAmount,
          netAmount: calculation.netAmount,
          eligible: calculation.eligible && canReceivePayments,
          status,
          statusReason,
          riseAccount: {
            hasAccount: hasRiseAccount,
            riseId: profile?.riseAccount?.riseId,
            kycStatus: profile?.riseAccount?.kycStatus,
          },
        };
      })
    );

    type PreviewItem = (typeof previewItems)[number];

    // Separate into eligible and ineligible
    const eligibleItems = previewItems.filter(
      (item: PreviewItem) => item.eligible
    );
    const ineligibleItems = previewItems.filter(
      (item: PreviewItem) => !item.eligible
    );

    // Calculate totals for eligible only
    const eligibleTotal = eligibleItems.reduce(
      (sum: number, item: PreviewItem) => sum + item.netAmount,
      0
    );

    return NextResponse.json({
      preview: previewItems,
      eligible: eligibleItems,
      ineligible: ineligibleItems,
      summary: {
        totalAffiliates: previewItems.length,
        eligibleAffiliates: eligibleItems.length,
        ineligibleAffiliates: ineligibleItems.length,
        totalGrossAmount: batchSummary.totalGrossAmount,
        totalFeeAmount: batchSummary.totalFeeAmount,
        totalNetAmount: batchSummary.totalNetAmount,
        eligibleNetAmount: PayoutCalculator.roundUsd(eligibleTotal),
        feePercentage,
        minimumThreshold: MINIMUM_PAYOUT_USD,
      },
      canCreate: eligibleItems.length > 0,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Error previewing batch:', error);
    return NextResponse.json(
      { error: 'Failed to preview batch' },
      { status: 500 }
    );
  }
}
