/**
 * Batch Execution API Route (Part 19B)
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
import { BatchManager } from '@/lib/disbursement/services/batch-manager';
import {
  createPaymentProvider,
  isProviderAvailable,
} from '@/lib/disbursement/providers/provider-factory';

interface RouteContext {
  params: Promise<{ batchId: string }>;
}

/**
 * POST /api/disbursement/batches/[batchId]/execute
 *
 * Execute a payment batch. Processes all pending transactions through the payment provider.
 *
 * @returns 200 - Execution result
 * @returns 400 - Cannot execute batch (wrong status or invalid provider)
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 404 - Batch not found
 * @returns 500 - Server error
 */
export async function POST(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Require admin access
    await requireAdmin();

    const { batchId } = await context.params;

    // Get batch to check status and provider
    const batchManager = new BatchManager(prisma);
    const batch = await batchManager.getBatchById(batchId);

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    // Check batch status
    if (batch.status !== 'PENDING' && batch.status !== 'QUEUED') {
      return NextResponse.json(
        {
          error: `Cannot execute batch with status ${batch.status}`,
          details: 'Only PENDING or QUEUED batches can be executed',
        },
        { status: 400 }
      );
    }

    // Check provider availability
    if (!isProviderAvailable(batch.provider)) {
      return NextResponse.json(
        {
          error: `Provider ${batch.provider} is not available`,
          details:
            'The selected payment provider is not implemented or unavailable',
        },
        { status: 400 }
      );
    }

    // Create provider instance
    let provider;
    try {
      provider = createPaymentProvider(batch.provider);
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Failed to initialize payment provider',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    // Execute batch
    const orchestrator = new PaymentOrchestrator(prisma, provider);
    const result = await orchestrator.executeBatch(batchId);

    // Get updated batch with transaction details
    const updatedBatch = await batchManager.getBatchById(batchId);

    return NextResponse.json({
      success: result.success,
      result: {
        batchId: result.batchId,
        batchNumber: result.batchNumber,
        totalAmount: result.totalAmount,
        successCount: result.successCount,
        failedCount: result.failedCount,
        errors: result.errors,
      },
      batch: updatedBatch
        ? {
            id: updatedBatch.id,
            batchNumber: updatedBatch.batchNumber,
            status: updatedBatch.status,
            executedAt: updatedBatch.executedAt,
            completedAt: updatedBatch.completedAt,
            failedAt: updatedBatch.failedAt,
            errorMessage: updatedBatch.errorMessage,
          }
        : null,
      message: result.success
        ? `Batch executed successfully: ${result.successCount} payments completed`
        : `Batch execution completed with errors: ${result.failedCount} failed`,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes('Cannot execute')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    console.error('Error executing batch:', error);
    return NextResponse.json(
      { error: 'Failed to execute batch' },
      { status: 500 }
    );
  }
}
