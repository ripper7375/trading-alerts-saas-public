/**
 * Batch Execute API Route (Part 19B)
 *
 * POST: Execute a payment batch
 *
 * @module app/api/disbursement/batches/[batchId]/execute/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';
import { PaymentOrchestrator } from '@/lib/disbursement/services/payment-orchestrator';
import { createPaymentProvider } from '@/lib/disbursement/providers/provider-factory';
import { getDefaultProvider } from '@/lib/disbursement/constants';

interface RouteParams {
  params: Promise<{ batchId: string }>;
}

/**
 * POST /api/disbursement/batches/[batchId]/execute
 *
 * Executes a payment batch, processing all pending transactions.
 * The batch must be in PENDING or QUEUED status.
 *
 * @returns 200 - Execution result
 * @returns 400 - Invalid batch status
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 404 - Batch not found
 * @returns 500 - Server error
 */
export async function POST(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    await requireAdmin();

    const { batchId } = await params;

    // Check batch exists
    const batch = await prisma.paymentBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    // Validate batch can be executed
    if (batch.status !== 'PENDING' && batch.status !== 'QUEUED') {
      return NextResponse.json(
        {
          error: `Cannot execute batch with status ${batch.status}`,
          currentStatus: batch.status,
        },
        { status: 400 }
      );
    }

    // Get provider based on batch configuration or default
    const providerType = (batch.provider as 'RISE' | 'MOCK') || getDefaultProvider();
    const provider = createPaymentProvider(providerType);
    const orchestrator = new PaymentOrchestrator(prisma, provider);

    // Execute the batch
    const result = await orchestrator.executeBatch(batchId);

    return NextResponse.json({
      result,
      executedAt: new Date(),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    console.error('Error executing batch:', error);
    return NextResponse.json(
      { error: `Failed to execute batch: ${errorMessage}` },
      { status: 500 }
    );
  }
}
