/**
 * Single Batch API Route (Part 19B)
 *
 * GET: Get batch details
 * DELETE: Delete a pending batch
 *
 * @module app/api/disbursement/batches/[batchId]/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';
import { BatchManager } from '@/lib/disbursement/services/batch-manager';
import { TransactionService } from '@/lib/disbursement/services/transaction-service';

interface RouteContext {
  params: Promise<{ batchId: string }>;
}

/**
 * GET /api/disbursement/batches/[batchId]
 *
 * Get detailed information about a payment batch including transactions.
 *
 * @returns 200 - Batch details
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 404 - Batch not found
 * @returns 500 - Server error
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Require admin access
    await requireAdmin();

    const { batchId } = await context.params;

    const batchManager = new BatchManager(prisma);
    const transactionService = new TransactionService(prisma);

    const batch = await batchManager.getBatchById(batchId);

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    // Get transaction status counts
    const statusCounts = await transactionService.getTransactionCountsByStatus(batchId);

    type BatchTransaction = NonNullable<typeof batch.transactions>[number];
    type BatchAuditLog = NonNullable<typeof batch.auditLogs>[number];

    // Calculate paid amount
    const paidAmount = batch.transactions
      ? batch.transactions
          .filter((t: BatchTransaction) => t.status === 'COMPLETED')
          .reduce((sum: number, t: BatchTransaction) => sum + Number(t.amount), 0)
      : 0;

    return NextResponse.json({
      batch: {
        id: batch.id,
        batchNumber: batch.batchNumber,
        provider: batch.provider,
        status: batch.status,
        paymentCount: batch.paymentCount,
        totalAmount: Number(batch.totalAmount),
        paidAmount,
        currency: batch.currency,
        scheduledAt: batch.scheduledAt,
        executedAt: batch.executedAt,
        completedAt: batch.completedAt,
        failedAt: batch.failedAt,
        errorMessage: batch.errorMessage,
        metadata: batch.metadata,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
      },
      transactions: batch.transactions?.map((txn: BatchTransaction) => ({
        id: txn.id,
        transactionId: txn.transactionId,
        providerTxId: txn.providerTxId,
        commissionId: txn.commissionId,
        affiliateProfileId: txn.commission?.affiliateProfileId,
        affiliateRiseId: txn.affiliateRiseAccount?.riseId,
        amount: Number(txn.amount),
        amountRiseUnits: txn.amountRiseUnits?.toString(),
        currency: txn.currency,
        status: txn.status,
        retryCount: txn.retryCount,
        lastRetryAt: txn.lastRetryAt,
        errorMessage: txn.errorMessage,
        createdAt: txn.createdAt,
        completedAt: txn.completedAt,
        failedAt: txn.failedAt,
      })) || [],
      transactionCounts: statusCounts,
      auditLogs: batch.auditLogs?.map((log: BatchAuditLog) => ({
        id: log.id,
        action: log.action,
        status: log.status,
        actor: log.actor,
        details: log.details,
        createdAt: log.createdAt,
      })) || [],
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Error fetching batch:', error);
    return NextResponse.json(
      { error: 'Failed to fetch batch' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/disbursement/batches/[batchId]
 *
 * Delete a payment batch. Only PENDING or CANCELLED batches can be deleted.
 *
 * @returns 200 - Batch deleted
 * @returns 400 - Cannot delete batch (wrong status)
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 404 - Batch not found
 * @returns 500 - Server error
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Require admin access
    await requireAdmin();

    const { batchId } = await context.params;

    const batchManager = new BatchManager(prisma);

    // Get batch to return info
    const batch = await batchManager.getBatchById(batchId);

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    try {
      await batchManager.deleteBatch(batchId);
    } catch (error) {
      if (error instanceof Error) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      message: 'Batch deleted successfully',
      deletedBatch: {
        id: batch.id,
        batchNumber: batch.batchNumber,
        status: batch.status,
        transactionCount: batch.transactions?.length || 0,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Error deleting batch:', error);
    return NextResponse.json(
      { error: 'Failed to delete batch' },
      { status: 500 }
    );
  }
}
