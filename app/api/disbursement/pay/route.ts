/**
 * Quick Payment API (Part 19C)
 *
 * POST /api/disbursement/pay
 *
 * Allows admin to pay a single affiliate immediately.
 * Creates a single-affiliate batch and executes it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { PaymentOrchestrator } from '@/lib/disbursement/services/payment-orchestrator';
import { CommissionAggregator } from '@/lib/disbursement/services/commission-aggregator';
import { BatchManager } from '@/lib/disbursement/services/batch-manager';
import { createPaymentProvider } from '@/lib/disbursement/providers/provider-factory';
import type { DisbursementProvider } from '@/types/disbursement';

interface QuickPaymentRequest {
  affiliateId: string;
  provider?: DisbursementProvider;
}

/**
 * Process a quick payment for a single affiliate
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as QuickPaymentRequest;
    const { affiliateId, provider = 'MOCK' } = body;

    if (!affiliateId) {
      return NextResponse.json(
        { error: 'affiliateId is required' },
        { status: 400 }
      );
    }

    // Validate provider
    if (provider !== 'MOCK' && provider !== 'RISE') {
      return NextResponse.json(
        { error: 'Invalid provider. Must be MOCK or RISE' },
        { status: 400 }
      );
    }

    // Check if affiliate exists
    const affiliate = await prisma.affiliateProfile.findUnique({
      where: { id: affiliateId },
      include: {
        riseAccount: true,
      },
    });

    if (!affiliate) {
      return NextResponse.json(
        { error: 'Affiliate not found' },
        { status: 404 }
      );
    }

    // Check if affiliate has commissions ready for payout
    const aggregator = new CommissionAggregator(prisma);
    const aggregate = await aggregator.getAggregatesByAffiliate(affiliateId);

    if (!aggregate.canPayout) {
      return NextResponse.json(
        {
          error: aggregate.reason || 'Affiliate not ready for payout',
          details: {
            totalAmount: aggregate.totalAmount,
            commissionCount: aggregate.commissionCount,
          },
        },
        { status: 400 }
      );
    }

    // For RISE provider, check if affiliate has a verified Rise account
    if (provider === 'RISE') {
      if (!affiliate.riseAccount) {
        return NextResponse.json(
          { error: 'Affiliate does not have a RiseWorks account' },
          { status: 400 }
        );
      }

      if (affiliate.riseAccount.kycStatus !== 'APPROVED') {
        return NextResponse.json(
          {
            error: 'Affiliate RiseWorks account is not fully verified',
            kycStatus: affiliate.riseAccount.kycStatus,
          },
          { status: 400 }
        );
      }
    }

    // Create single-affiliate batch
    const batchManager = new BatchManager(prisma);
    const batch = await batchManager.createBatch(
      [aggregate],
      provider,
      session.user.id
    );

    // Execute immediately
    const paymentProvider = createPaymentProvider(provider);
    const orchestrator = new PaymentOrchestrator(prisma, paymentProvider);

    const result = await orchestrator.executeBatch(batch.id);

    return NextResponse.json({
      success: result.success,
      batchId: result.batchId,
      batchNumber: result.batchNumber,
      totalAmount: result.totalAmount,
      successCount: result.successCount,
      failedCount: result.failedCount,
      errors: result.errors,
      affiliate: {
        id: affiliate.id,
        name: affiliate.fullName,
      },
    });
  } catch (error) {
    console.error('Quick payment error:', error);

    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes('not yet implemented')) {
        return NextResponse.json(
          { error: 'RISE provider not available. Use MOCK provider.' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
