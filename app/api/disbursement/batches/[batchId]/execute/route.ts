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

interface RouteParams {
  params: Promise<{ batchId: string }>;
}

/**
 * POST /api/disbursement/batches/[batchId]/execute
 *
 * Executes a payment batch. Sends payments to all affiliates in the batch.
 *
 * The batch must be in PENDING or QUEUED status.
 * Only one batch can be processing at a time.
 *
 * @param batchId - The batch ID
 * @returns 200 - Execution result
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 404 - Batch not found
 * @returns 409 - Batch cannot be executed (wrong status or another batch processing)
 * @returns 500 - Server error
 */
export async function POST(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    // Require admin access
    await requireAdmin();

    const { batchId } = await params;

    // Create provider and orchestrator
    let provider;
    try {
      provider = createPaymentProvider();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        { error: `Payment provider error: ${message}` },
        { status: 500 }
      );
    }

    const orchestrator = new PaymentOrchestrator(prisma, provider);

    // Execute batch
    let result;
    try {
      result = await orchestrator.executeBatch(batchId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message === 'Batch not found') {
        return NextResponse.json(
          { error: 'Batch not found' },
          { status: 404 }
        );
      }

      if (message.includes('Cannot execute batch')) {
        return NextResponse.json(
          { error: message },
          { status: 409 }
        );
      }

      if (message.includes('Another batch is currently processing')) {
        return NextResponse.json(
          { error: message },
          { status: 409 }
        );
      }

      throw error;
    }

    return NextResponse.json({
      result: {
        success: result.success,
        batchId: result.batchId,
        batchNumber: result.batchNumber,
        totalAmount: result.totalAmount,
        successCount: result.successCount,
        failedCount: result.failedCount,
        errors: result.errors,
      },
      message: result.success
        ? `Successfully executed batch: ${result.successCount} payments completed`
        : `Batch execution completed with errors: ${result.successCount} succeeded, ${result.failedCount} failed`,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Error executing batch:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute batch' },
      { status: 500 }
    );
  }
}
