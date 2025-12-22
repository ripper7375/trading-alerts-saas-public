/**
 * Batch Details API Route (Part 19B)
 *
 * GET: Get detailed information about a specific batch
 * DELETE: Delete a pending or cancelled batch
 *
 * @module app/api/disbursement/batches/[batchId]/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';
import { BatchManager } from '@/lib/disbursement/services/batch-manager';

interface RouteParams {
  params: Promise<{ batchId: string }>;
}

/**
 * GET /api/disbursement/batches/[batchId]
 *
 * Returns detailed information about a specific batch including all transactions.
 *
 * @param batchId - The batch ID
 * @returns 200 - Batch details with transactions
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 404 - Batch not found
 * @returns 500 - Server error
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    // Require admin access
    await requireAdmin();

    const { batchId } = await params;

    const batchManager = new BatchManager(prisma);
    const batch = await batchManager.getBatchById(batchId);

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    // Calculate transaction stats
    const transactionStats = {
      total: batch.transactions.length,
      pending: batch.transactions.filter((t) => t.status === 'PENDING').length,
      processing: batch.transactions.filter((t) => t.status === 'PROCESSING').length,
      completed: batch.transactions.filter((t) => t.status === 'COMPLETED').length,
      failed: batch.transactions.filter((t) => t.status === 'FAILED').length,
      cancelled: batch.transactions.filter((t) => t.status === 'CANCELLED').length,
    };

    // Calculate amounts
    const completedAmount = batch.transactions
      .filter((t) => t.status === 'COMPLETED')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const failedAmount = batch.transactions
      .filter((t) => t.status === 'FAILED' || t.status === 'CANCELLED')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return NextResponse.json({
      batch: {
        id: batch.id,
        batchNumber: batch.batchNumber,
        status: batch.status,
        provider: batch.provider,
        paymentCount: batch.paymentCount,
        totalAmount: Number(batch.totalAmount),
        currency: batch.currency,
        scheduledAt: batch.scheduledAt,
        executedAt: batch.executedAt,
        completedAt: batch.completedAt,
        failedAt: batch.failedAt,
        errorMessage: batch.errorMessage,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
      },

      transactions: batch.transactions.map((txn) => ({
        id: txn.id,
        transactionId: txn.transactionId,
        providerTxId: txn.providerTxId,
        status: txn.status,
        amount: Number(txn.amount),
        currency: txn.currency,
        payeeRiseId: txn.payeeRiseId,
        retryCount: txn.retryCount,
        lastRetryAt: txn.lastRetryAt,
        errorMessage: txn.errorMessage,
        completedAt: txn.completedAt,
        failedAt: txn.failedAt,
        createdAt: txn.createdAt,
        commission: txn.commission
          ? {
              id: txn.commission.id,
              status: txn.commission.status,
              amount: Number(txn.commission.commissionAmount),
              type: txn.commission.commissionType,
            }
          : null,
        affiliateRiseAccount: txn.affiliateRiseAccount
          ? {
              id: txn.affiliateRiseAccount.id,
              riseId: txn.affiliateRiseAccount.riseId,
              kycStatus: txn.affiliateRiseAccount.kycStatus,
            }
          : null,
      })),

      stats: {
        transactions: transactionStats,
        amounts: {
          total: Number(batch.totalAmount),
          completed: completedAmount,
          failed: failedAmount,
          pending: Number(batch.totalAmount) - completedAmount - failedAmount,
        },
        successRate:
          transactionStats.total > 0
            ? (transactionStats.completed / transactionStats.total) * 100
            : 0,
      },

      auditLogs: batch.auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        status: log.status,
        actor: log.actor,
        details: log.details,
        createdAt: log.createdAt,
      })),
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
 * Deletes a batch. Only PENDING or CANCELLED batches can be deleted.
 *
 * @param batchId - The batch ID
 * @returns 200 - Success
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 404 - Batch not found
 * @returns 409 - Batch cannot be deleted (processing or completed)
 * @returns 500 - Server error
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    // Require admin access
    await requireAdmin();

    const { batchId } = await params;

    const batchManager = new BatchManager(prisma);

    try {
      await batchManager.deleteBatch(batchId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message === 'Batch not found') {
        return NextResponse.json(
          { error: 'Batch not found' },
          { status: 404 }
        );
      }

      if (
        message.includes('Cannot delete batch') ||
        message.includes('processing') ||
        message.includes('completed')
      ) {
        return NextResponse.json(
          { error: message },
          { status: 409 }
        );
      }

      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Batch deleted successfully',
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
