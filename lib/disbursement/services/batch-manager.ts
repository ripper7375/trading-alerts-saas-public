/**
 * Batch Manager Service (Part 19B)
 *
 * Creates and manages payment batches for affiliate commission payouts.
 * Handles batch lifecycle: creation, status updates, retrieval, and deletion.
 */

import {
  PrismaClient,
  PaymentBatch,
  DisbursementProvider,
  PaymentBatchStatus,
  Prisma,
} from '@prisma/client';
import type { CommissionAggregate } from '@/types/disbursement';
import { generateBatchNumber, MAX_BATCH_SIZE } from '../constants';
import { TransactionLogger } from './transaction-logger';
import { TransactionService } from './transaction-service';

/**
 * Batch manager for payment batch operations
 */
export class BatchManager {
  private readonly logger: TransactionLogger;
  private readonly transactionService: TransactionService;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = new TransactionLogger(prisma);
    this.transactionService = new TransactionService(prisma);
  }

  /**
   * Create a payment batch from commission aggregates
   *
   * @param aggregates Array of commission aggregates
   * @param provider Payment provider (MOCK or RISE)
   * @param actor Optional actor ID (admin user)
   * @returns Created PaymentBatch
   */
  async createBatch(
    aggregates: CommissionAggregate[],
    provider: DisbursementProvider,
    actor?: string
  ): Promise<PaymentBatch> {
    const totalAmount = aggregates.reduce(
      (sum, agg) => sum + agg.totalAmount,
      0
    );
    const batchNumber = generateBatchNumber();

    // Create batch
    const batch = await this.prisma.paymentBatch.create({
      data: {
        batchNumber,
        paymentCount: 0, // Will be updated after creating transactions
        totalAmount,
        currency: 'USD',
        provider,
        status: 'PENDING',
      },
    });

    // Create transactions for each aggregate's commissions
    let totalTransactions = 0;
    for (const aggregate of aggregates) {
      const count =
        await this.transactionService.createTransactionsForCommissions(
          batch.id,
          aggregate.commissionIds,
          provider
        );
      totalTransactions += count;
    }

    // Update batch with actual transaction count
    const updatedBatch = await this.prisma.paymentBatch.update({
      where: { id: batch.id },
      data: { paymentCount: totalTransactions },
    });

    await this.logger.logBatchCreated(batch.id, actor, {
      batchNumber,
      totalAmount,
      paymentCount: totalTransactions,
      provider,
    });

    return updatedBatch;
  }

  /**
   * Get batch by ID with full transaction details
   *
   * @param batchId Batch ID
   * @returns Batch with transactions or null
   */
  async getBatchById(batchId: string) {
    return this.prisma.paymentBatch.findUnique({
      where: { id: batchId },
      include: {
        transactions: {
          include: {
            commission: {
              select: {
                id: true,
                status: true,
                commissionAmount: true,
                affiliateProfileId: true,
              },
            },
            affiliateRiseAccount: {
              select: {
                affiliateProfileId: true,
                riseId: true,
                kycStatus: true,
              },
            },
          },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
  }

  /**
   * Get batch by batch number
   *
   * @param batchNumber Batch number (BATCH-YYYY-xxx format)
   * @returns Batch or null
   */
  async getBatchByNumber(batchNumber: string) {
    return this.prisma.paymentBatch.findUnique({
      where: { batchNumber },
      include: {
        transactions: true,
      },
    });
  }

  /**
   * Update batch status
   *
   * @param batchId Batch ID
   * @param status New status
   * @param errorMessage Optional error message (for FAILED status)
   */
  async updateBatchStatus(
    batchId: string,
    status: PaymentBatchStatus,
    errorMessage?: string
  ): Promise<void> {
    const updateData: Prisma.PaymentBatchUpdateInput = { status };

    switch (status) {
      case 'QUEUED':
        await this.logger.logBatchQueued(batchId);
        break;
      case 'PROCESSING':
        updateData.executedAt = new Date();
        break;
      case 'COMPLETED':
        updateData.completedAt = new Date();
        break;
      case 'FAILED':
        updateData.failedAt = new Date();
        updateData.errorMessage = errorMessage;
        break;
      case 'CANCELLED':
        updateData.failedAt = new Date();
        updateData.errorMessage = errorMessage || 'Batch cancelled';
        break;
    }

    await this.prisma.paymentBatch.update({
      where: { id: batchId },
      data: updateData,
    });
  }

  /**
   * Get all batches with optional status filter
   *
   * @param status Optional status filter
   * @param limit Maximum number of batches to return
   * @returns Array of batches
   */
  async getAllBatches(
    status?: PaymentBatchStatus,
    limit: number = 50
  ): Promise<PaymentBatch[]> {
    return this.prisma.paymentBatch.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get batches with transaction summaries
   *
   * @param status Optional status filter
   * @param limit Maximum number of batches
   * @returns Batches with transaction count info
   */
  async getBatchesWithSummary(status?: PaymentBatchStatus, limit: number = 50) {
    const batches = await this.prisma.paymentBatch.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });

    type BatchWithCount = (typeof batches)[number];

    // Get transaction status counts for each batch
    const batchesWithCounts = await Promise.all(
      batches.map(async (batch: BatchWithCount) => {
        const statusCounts =
          await this.transactionService.getTransactionCountsByStatus(batch.id);
        return {
          ...batch,
          transactionCounts: statusCounts,
        };
      })
    );

    return batchesWithCounts;
  }

  /**
   * Delete a batch (only allowed for PENDING or CANCELLED batches)
   *
   * @param batchId Batch ID
   * @throws Error if batch cannot be deleted
   */
  async deleteBatch(batchId: string): Promise<void> {
    const batch = await this.prisma.paymentBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status === 'PROCESSING' || batch.status === 'COMPLETED') {
      throw new Error('Cannot delete batch that is processing or completed');
    }

    // Delete transactions first (cascade should handle this but being explicit)
    await this.prisma.disbursementTransaction.deleteMany({
      where: { batchId },
    });

    // Delete audit logs
    await this.prisma.disbursementAuditLog.deleteMany({
      where: { batchId },
    });

    // Delete batch
    await this.prisma.paymentBatch.delete({
      where: { id: batchId },
    });
  }

  /**
   * Cancel a batch
   *
   * @param batchId Batch ID
   * @param actor Optional actor ID
   * @param reason Optional cancellation reason
   */
  async cancelBatch(
    batchId: string,
    actor?: string,
    reason?: string
  ): Promise<void> {
    const batch = await this.prisma.paymentBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status === 'PROCESSING' || batch.status === 'COMPLETED') {
      throw new Error('Cannot cancel batch that is processing or completed');
    }

    await this.updateBatchStatus(batchId, 'CANCELLED', reason);
    await this.logger.logBatchCancelled(batchId, actor, reason);

    // Cancel all pending transactions
    await this.prisma.disbursementTransaction.updateMany({
      where: {
        batchId,
        status: 'PENDING',
      },
      data: {
        status: 'CANCELLED',
        errorMessage: 'Batch cancelled',
      },
    });
  }

  /**
   * Split items into batches based on max batch size
   *
   * @param items Array of items to split
   * @param batchSize Maximum items per batch
   * @returns Array of batches
   */
  splitIntoBatches<T>(items: T[], batchSize: number = MAX_BATCH_SIZE): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Get batch statistics summary
   *
   * @returns Summary of all batches
   */
  async getBatchStatistics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    totalAmount: number;
    totalPayments: number;
  }> {
    const [batches, statusCounts] = await Promise.all([
      this.prisma.paymentBatch.aggregate({
        _sum: {
          totalAmount: true,
          paymentCount: true,
        },
        _count: true,
      }),
      this.prisma.paymentBatch.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const item of statusCounts) {
      byStatus[item.status] = item._count;
    }

    return {
      total: batches._count,
      byStatus,
      totalAmount: Number(batches._sum.totalAmount ?? 0),
      totalPayments: batches._sum.paymentCount ?? 0,
    };
  }
}
