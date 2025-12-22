/**
 * Batch Manager Service (Part 19B)
 *
 * Manages payment batch lifecycle: creation, tracking, status updates, and deletion.
 * Uses type-safe Prisma query patterns from query-patterns.ts.
 */

import type {
  PrismaClient,
  PaymentBatch,
  DisbursementProvider,
  PaymentBatchStatus,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { CommissionAggregate } from '@/types/disbursement';
import { generateBatchNumber, generateTransactionId, MAX_BATCH_SIZE } from '../constants';
import { TransactionLogger } from './transaction-logger';
import {
  BATCH_WITH_TRANSACTIONS,
  BATCH_LIST_VIEW,
  type BatchWithTransactions,
  type BatchListView,
} from '../query-patterns';

/**
 * Batch creation result
 */
export interface BatchCreationResult {
  batch: PaymentBatch;
  transactionCount: number;
}

/**
 * Batch manager for payment batch operations
 */
export class BatchManager {
  private readonly logger: TransactionLogger;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = new TransactionLogger(prisma);
  }

  /**
   * Create a new payment batch with transactions
   *
   * @param aggregates Commission aggregates to include in batch
   * @param provider Payment provider to use
   * @param actor User creating the batch
   * @returns Created batch with transaction count
   */
  async createBatch(
    aggregates: CommissionAggregate[],
    provider: DisbursementProvider,
    actor?: string
  ): Promise<BatchCreationResult> {
    // Filter to only payable aggregates
    const payableAggregates = aggregates.filter((agg) => agg.canPayout);

    if (payableAggregates.length === 0) {
      throw new Error('No payable affiliates provided');
    }

    const totalAmount = payableAggregates.reduce(
      (sum, agg) => sum + agg.totalAmount,
      0
    );
    const batchNumber = generateBatchNumber();

    // Create batch with transactions in a transaction
    const batch = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create the batch
      const newBatch = await tx.paymentBatch.create({
        data: {
          batchNumber,
          paymentCount: payableAggregates.length,
          totalAmount,
          currency: 'USD',
          provider,
          status: 'PENDING',
        },
      });

      // Create transactions for each aggregate
      for (const aggregate of payableAggregates) {
        // Get affiliate's Rise account
        const riseAccount = await tx.affiliateRiseAccount.findUnique({
          where: { affiliateProfileId: aggregate.affiliateId },
        });

        // Create transaction for each commission in the aggregate
        for (const commissionId of aggregate.commissionIds) {
          const commission = await tx.commission.findUnique({
            where: { id: commissionId },
          });

          if (!commission) {
            continue;
          }

          await tx.disbursementTransaction.create({
            data: {
              batchId: newBatch.id,
              commissionId,
              transactionId: generateTransactionId(),
              provider,
              affiliateRiseAccountId: riseAccount?.id,
              payeeRiseId: riseAccount?.riseId,
              amount: commission.commissionAmount,
              currency: 'USD',
              status: 'PENDING',
            },
          });
        }
      }

      return newBatch;
    });

    await this.logger.logBatchCreated(batch.id, actor, {
      paymentCount: payableAggregates.length,
      totalAmount,
      provider,
    });

    // Get the actual transaction count
    const transactionCount = await this.prisma.disbursementTransaction.count({
      where: { batchId: batch.id },
    });

    return { batch, transactionCount };
  }

  /**
   * Get a batch by ID with full transaction details
   *
   * CRITICAL: Returns BatchWithTransactions type
   * PaymentOrchestrator depends on the nested includes:
   * - transactions[].commission (for status updates)
   * - transactions[].affiliateRiseAccount (for payment requests)
   *
   * @param batchId The batch ID
   * @returns Batch with transactions or null
   */
  async getBatchById(batchId: string): Promise<BatchWithTransactions | null> {
    return this.prisma.paymentBatch.findUnique({
      where: { id: batchId },
      include: BATCH_WITH_TRANSACTIONS,
    });
  }

  /**
   * Get a batch by batch number
   *
   * @param batchNumber The batch number (e.g., BATCH-2024-ABC123)
   * @returns Batch with transactions or null
   */
  async getBatchByNumber(batchNumber: string): Promise<BatchWithTransactions | null> {
    return this.prisma.paymentBatch.findUnique({
      where: { batchNumber },
      include: BATCH_WITH_TRANSACTIONS,
    });
  }

  /**
   * Update batch status
   *
   * @param batchId The batch ID
   * @param status New status
   * @param errorMessage Optional error message for failed batches
   */
  async updateBatchStatus(
    batchId: string,
    status: PaymentBatchStatus,
    errorMessage?: string
  ): Promise<void> {
    const updateData: Record<string, unknown> = { status };

    switch (status) {
      case 'QUEUED':
        updateData['scheduledAt'] = new Date();
        break;
      case 'PROCESSING':
        updateData['executedAt'] = new Date();
        break;
      case 'COMPLETED':
        updateData['completedAt'] = new Date();
        break;
      case 'FAILED':
        updateData['failedAt'] = new Date();
        if (errorMessage) {
          updateData['errorMessage'] = errorMessage;
        }
        break;
      case 'CANCELLED':
        updateData['failedAt'] = new Date();
        if (errorMessage) {
          updateData['errorMessage'] = errorMessage;
        }
        break;
    }

    await this.prisma.paymentBatch.update({
      where: { id: batchId },
      data: updateData,
    });
  }

  /**
   * Get all batches with optional filtering
   *
   * @param status Filter by status
   * @param limit Maximum number of batches to return
   * @param offset Pagination offset
   * @returns Array of batches with summary info
   */
  async getAllBatches(
    status?: PaymentBatchStatus,
    limit: number = 50,
    offset: number = 0
  ): Promise<BatchListView[]> {
    return this.prisma.paymentBatch.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: BATCH_LIST_VIEW,
    });
  }

  /**
   * Get batch count by status
   *
   * @param status Optional status filter
   * @returns Count of batches
   */
  async getBatchCount(status?: PaymentBatchStatus): Promise<number> {
    return this.prisma.paymentBatch.count({
      where: status ? { status } : undefined,
    });
  }

  /**
   * Split items into batches of specified size
   *
   * @param items Items to split
   * @param batchSize Maximum batch size (default: MAX_BATCH_SIZE)
   * @returns Array of item arrays
   */
  splitIntoBatches<T>(items: T[], batchSize: number = MAX_BATCH_SIZE): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Delete a batch (only if PENDING or CANCELLED)
   *
   * @param batchId The batch ID
   * @throws Error if batch cannot be deleted
   */
  async deleteBatch(batchId: string): Promise<void> {
    const batch = await this.getBatchById(batchId);

    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status === 'PROCESSING') {
      throw new Error('Cannot delete batch that is currently processing');
    }

    if (batch.status === 'COMPLETED') {
      throw new Error('Cannot delete batch that has been completed');
    }

    // Delete in transaction to ensure consistency
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Delete audit logs first
      await tx.disbursementAuditLog.deleteMany({
        where: { batchId },
      });

      // Delete transactions
      await tx.disbursementTransaction.deleteMany({
        where: { batchId },
      });

      // Delete batch
      await tx.paymentBatch.delete({
        where: { id: batchId },
      });
    });
  }

  /**
   * Cancel a batch
   *
   * @param batchId The batch ID
   * @param reason Cancellation reason
   * @param actor User cancelling the batch
   */
  async cancelBatch(
    batchId: string,
    reason?: string,
    actor?: string
  ): Promise<void> {
    const batch = await this.getBatchById(batchId);

    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status === 'PROCESSING') {
      throw new Error('Cannot cancel batch that is currently processing');
    }

    if (batch.status === 'COMPLETED') {
      throw new Error('Cannot cancel batch that has been completed');
    }

    if (batch.status === 'CANCELLED') {
      throw new Error('Batch is already cancelled');
    }

    await this.updateBatchStatus(batchId, 'CANCELLED', reason);

    // Cancel all pending transactions
    await this.prisma.disbursementTransaction.updateMany({
      where: {
        batchId,
        status: 'PENDING',
      },
      data: {
        status: 'CANCELLED',
        errorMessage: reason ?? 'Batch cancelled',
      },
    });

    await this.logger.logBatchCancelled(batchId, actor, reason);
  }

  /**
   * Queue a batch for execution
   *
   * @param batchId The batch ID
   * @param actor User queueing the batch
   */
  async queueBatch(batchId: string, actor?: string): Promise<void> {
    const batch = await this.getBatchById(batchId);

    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status !== 'PENDING') {
      throw new Error(`Cannot queue batch with status ${batch.status}`);
    }

    await this.updateBatchStatus(batchId, 'QUEUED');
    await this.logger.logBatchQueued(batchId, actor);
  }

  /**
   * Check if there's already a batch processing
   *
   * @returns True if a batch is currently processing
   */
  async isBatchProcessing(): Promise<boolean> {
    const count = await this.prisma.paymentBatch.count({
      where: { status: 'PROCESSING' },
    });
    return count > 0;
  }

  /**
   * Get batch statistics summary
   *
   * @returns Batch statistics
   */
  async getBatchStats(): Promise<{
    total: number;
    pending: number;
    queued: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
    totalAmount: number;
    totalPaidAmount: number;
  }> {
    const counts = await this.prisma.paymentBatch.groupBy({
      by: ['status'],
      _count: true,
      _sum: {
        totalAmount: true,
      },
    });

    const stats = {
      total: 0,
      pending: 0,
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      totalAmount: 0,
      totalPaidAmount: 0,
    };

    for (const item of counts) {
      const count = item._count;
      const amount = Number(item._sum.totalAmount ?? 0);

      stats.total += count;
      stats.totalAmount += amount;

      switch (item.status) {
        case 'PENDING':
          stats.pending = count;
          break;
        case 'QUEUED':
          stats.queued = count;
          break;
        case 'PROCESSING':
          stats.processing = count;
          break;
        case 'COMPLETED':
          stats.completed = count;
          stats.totalPaidAmount += amount;
          break;
        case 'FAILED':
          stats.failed = count;
          break;
        case 'CANCELLED':
          stats.cancelled = count;
          break;
      }
    }

    return stats;
  }
}
