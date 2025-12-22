/**
 * Batch Preview API Route (Part 19B)
 *
 * POST: Preview a batch before creation
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

/**
 * Request schema for preview
 */
const previewSchema = z.object({
  affiliateIds: z.array(z.string()).optional(),
  feePercentage: z.number().min(0).max(100).default(0),
});

/**
 * POST /api/disbursement/batches/preview
 *
 * Returns a preview of what a batch would contain without actually creating it.
 * Useful for showing admins the totals before committing to a batch.
 *
 * @returns 200 - Preview details
 * @returns 400 - Invalid request
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();

    const body = await request.json();
    const validation = previewSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { affiliateIds, feePercentage } = validation.data;

    const aggregator = new CommissionAggregator(prisma);

    // Get commission aggregates
    let aggregates;
    if (affiliateIds && affiliateIds.length > 0) {
      const aggregatePromises = affiliateIds.map((id) =>
        aggregator.getAggregatesByAffiliate(id)
      );
      aggregates = await Promise.all(aggregatePromises);
    } else {
      aggregates = await aggregator.getAllPayableAffiliates();
    }

    // Calculate payout details for each affiliate
    const preview = aggregates.map((agg) => {
      const calculation = PayoutCalculator.calculatePayout(agg, feePercentage);
      return {
        affiliateId: agg.affiliateId,
        commissionCount: agg.commissionCount,
        commissionIds: agg.commissionIds,
        grossAmount: calculation.grossAmount,
        feeAmount: calculation.feeAmount,
        netAmount: calculation.netAmount,
        eligible: agg.canPayout,
        reason: agg.reason || calculation.reason,
      };
    });

    // Calculate batch total
    const eligibleAggregates = aggregates.filter((a) => a.canPayout);
    const batchSummary = PayoutCalculator.calculateBatchTotal(
      eligibleAggregates,
      feePercentage
    );

    return NextResponse.json({
      preview,
      summary: {
        totalAffiliates: preview.length,
        eligibleAffiliates: batchSummary.eligibleCount,
        ineligibleAffiliates: batchSummary.ineligibleCount,
        totalGrossAmount: batchSummary.totalGrossAmount,
        totalFeeAmount: batchSummary.totalFeeAmount,
        totalNetAmount: batchSummary.totalNetAmount,
        feePercentage,
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
