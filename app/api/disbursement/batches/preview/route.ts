/**
 * Batch Preview API Route (Part 19B)
 *
 * POST: Preview what would be included in a payment batch
 *
 * @module app/api/disbursement/batches/preview/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';
import { CommissionAggregator } from '@/lib/disbursement/services/commission-aggregator';
import type { CommissionAggregate } from '@/types/disbursement';
import { PayoutCalculator } from '@/lib/disbursement/services/payout-calculator';
import { MINIMUM_PAYOUT_USD } from '@/lib/disbursement/constants';

interface PreviewItem {
  affiliateId: string;
  affiliateName: string;
  affiliateEmail: string;
  commissionCount: number;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  eligible: boolean;
  eligibilityIssues: string[];
  riseAccountStatus: {
    riseId: string | undefined;
    kycStatus: string | undefined;
    canReceivePayment: boolean;
  } | null;
}

/**
 * Validation schema for batch preview
 */
const previewSchema = z.object({
  affiliateIds: z.array(z.string()).optional(),
  feePercentage: z.number().min(0).max(100).default(0),
});

/**
 * POST /api/disbursement/batches/preview
 *
 * Previews what affiliates and commissions would be included in a batch.
 * Does not create the batch, just shows what would be included.
 *
 * Body:
 * - affiliateIds: Optional array of affiliate IDs to preview (default: all payable)
 * - feePercentage: Optional fee percentage to apply (default: 0)
 *
 * @returns 200 - Batch preview
 * @returns 400 - Validation error
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  try {
    // Require admin access
    await requireAdmin();

    // Parse and validate body
    const body = await request.json();
    const validation = previewSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { affiliateIds, feePercentage } = validation.data;

    const aggregator = new CommissionAggregator(prisma);

    // Get aggregates
    let aggregates: CommissionAggregate[];
    if (affiliateIds && affiliateIds.length > 0) {
      aggregates = await Promise.all(
        affiliateIds.map((id: string) => aggregator.getAggregatesByAffiliate(id))
      );
    } else {
      aggregates = await aggregator.getAllPayableAffiliates();
    }

    // Get affiliate details for each aggregate
    const preview: PreviewItem[] = await Promise.all(
      aggregates.map(async (agg: CommissionAggregate) => {
        const profile = await prisma.affiliateProfile.findUnique({
          where: { id: agg.affiliateId },
          include: {
            user: { select: { email: true } },
            riseAccount: true,
          },
        });

        // Calculate payout
        const calculation = PayoutCalculator.calculatePayout(agg, feePercentage);

        // Check Rise account status
        const hasRiseAccount = !!profile?.riseAccount;
        const kycApproved = profile?.riseAccount?.kycStatus === 'APPROVED';
        const canReceivePayment = hasRiseAccount && kycApproved;

        // Determine eligibility reasons
        const eligibilityIssues: string[] = [];
        if (!calculation.eligible) {
          eligibilityIssues.push(calculation.reason ?? 'Not eligible for payout');
        }
        if (!hasRiseAccount) {
          eligibilityIssues.push('No RiseWorks account');
        } else if (!kycApproved) {
          eligibilityIssues.push(`KYC status: ${profile?.riseAccount?.kycStatus}`);
        }

        return {
          affiliateId: agg.affiliateId,
          affiliateName: profile?.fullName ?? 'Unknown',
          affiliateEmail: profile?.user?.email ?? 'Unknown',
          commissionCount: agg.commissionCount,
          grossAmount: calculation.grossAmount,
          feeAmount: calculation.feeAmount,
          netAmount: calculation.netAmount,
          eligible: calculation.eligible && canReceivePayment,
          eligibilityIssues,
          riseAccountStatus: hasRiseAccount
            ? {
                riseId: profile?.riseAccount?.riseId,
                kycStatus: profile?.riseAccount?.kycStatus,
                canReceivePayment,
              }
            : null,
        };
      })
    );

    // Calculate summary
    const eligiblePreview = preview.filter((p: PreviewItem) => p.eligible);
    const totalGrossAmount = eligiblePreview.reduce(
      (sum: number, p: PreviewItem) => sum + p.grossAmount,
      0
    );
    const totalFeeAmount = eligiblePreview.reduce(
      (sum: number, p: PreviewItem) => sum + p.feeAmount,
      0
    );
    const totalNetAmount = eligiblePreview.reduce(
      (sum: number, p: PreviewItem) => sum + p.netAmount,
      0
    );
    const totalCommissions = eligiblePreview.reduce(
      (sum: number, p: PreviewItem) => sum + p.commissionCount,
      0
    );

    return NextResponse.json({
      preview,
      summary: {
        totalAffiliates: preview.length,
        eligibleAffiliates: eligiblePreview.length,
        ineligibleAffiliates: preview.length - eligiblePreview.length,
        totalCommissions,
        totalGrossAmount,
        totalFeeAmount,
        totalNetAmount,
        feePercentage,
        minimumPayoutThreshold: MINIMUM_PAYOUT_USD,
      },
      eligibilityBreakdown: {
        eligible: eligiblePreview.length,
        belowMinimum: preview.filter(
          (p: PreviewItem) => p.grossAmount < MINIMUM_PAYOUT_USD
        ).length,
        noRiseAccount: preview.filter(
          (p: PreviewItem) => !p.riseAccountStatus
        ).length,
        kycPending: preview.filter(
          (p: PreviewItem) => p.riseAccountStatus && p.riseAccountStatus.kycStatus !== 'APPROVED'
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

    console.error('Error previewing batch:', error);
    return NextResponse.json(
      { error: 'Failed to preview batch' },
      { status: 500 }
    );
  }
}
