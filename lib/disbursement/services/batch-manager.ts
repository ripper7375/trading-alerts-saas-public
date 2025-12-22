/**
 * Batch Manager Service (Part 19B)
 *
 * Manages payment batch creation, tracking, and lifecycle.
 * Handles batch splitting for large payment sets and status updates.
 */

import { PrismaClient } from '@prisma/client';
import type { CommissionAggregate, DisbursementProvider } from '@/types/disbursement';
import { generateBatchNumber, MAX_BATCH_SIZE } from '../constants';
import { TransactionLogger } from './transaction-logger';

/**
 * Payment batch with transactions
 */
export interface PaymentBatchWithTransactions {
  id: string;
  batchNumber: string;
  paymentCount: number;
  totalAmount: number;
  currency: string;
  provider: string;
  status: string;
  scheduledAt: Date | null;
  executedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  transactions: Array<{
    id: string;
    status: string;
    amount: number;
    transactionId?: string;
    commissionId?: string;
    payeeRiseId?: string | null;
    currency?: string;
    retryCount?: number;
    commission?: unknown;
    affiliateRiseAccount?: unknown;
  }>;
}

/**
 * Batch status type
 */
export type BatchStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

/**
 * Batch manager for payment batch operations
 */
export class BatchManager {
  private readonly logger: TransactionLogger;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = new TransactionLogger(prisma);
  }

  /**
   * Create a new payment batch from commission aggregates
   *
   * @param aggregates Array of commission aggregates
   * @param provider Payment provider to use
   * @param actor User creating the batch
   * @returns Created payment batch
   */
  async createBatch(
    aggregates: CommissionAggregate[],
    provider: DisbursementProvider,
    actor?: string
  ): Promise<PaymentBatchWithTransactions> {
    const totalAmount = aggregates.reduce(
      (sum, agg) => sum + agg.totalAmount,
      0
    );
    const batchNumber = generateBatchNumber();

    const batch = await this.prisma.paymentBatch.create({
      data: {
        batchNumber,
        paymentCount: aggregates.length,
        totalAmount,
        currency: 'USD',
        provider,
        status: 'PENDING',
      },
      include: {
        transactions: {
          select: {
            id: true,
            status: true,
            amount: true,
          },
        },
      },
    });

    await this.logger.logBatchCreated(
      batch.id,
      actor,
      aggregates.length,
      totalAmount
    );

    return {
      id: batch.id,
      batchNumber: batch.batchNumber,
      paymentCount: batch.paymentCount,
      totalAmount: Number(batch.totalAmount),
      currency: batch.currency,
      provider: batch.provider,
      status: batch.status,
      scheduledAt: batch.scheduledAt,
      executedAt: batch.executedAt,
      completedAt: batch.completedAt,
      failedAt: batch.failedAt,
      errorMessage: batch.errorMessage,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      transactions: batch.transactions.map((t) => ({
        id: t.id,
        status: t.status,
        amount: Number(t.amount),
      })),
    };
  }

  /**
   * Get a batch by ID with transactions
   *
   * @param batchId The batch ID
   * @returns Payment batch with transactions or null
   */
  async getBatchById(
    batchId: string
  ): Promise<PaymentBatchWithTransactions | null> {
    const batch = await this.prisma.paymentBatch.findUnique({
      where: { id: batchId },
      include: {
        transactions: true,
      },
    });

    if (!batch) {
      return null;
    }

    // Cast transaction to access all fields
    type FullTransaction = {
      id: string;
      status: string;
      amount: number | { toNumber?: () => number };
      transactionId?: string;
      commissionId?: string;
      payeeRiseId?: string | null;
      currency?: string;
      retryCount?: number;
      commission?: unknown;
      affiliateRiseAccount?: unknown;
    };

    return {
      id: batch.id,
      batchNumber: batch.batchNumber,
      paymentCount: batch.paymentCount,
      totalAmount: Number(batch.totalAmount),
      currency: batch.currency,
      provider: batch.provider,
      status: batch.status,
      scheduledAt: batch.scheduledAt,
      executedAt: batch.executedAt,
      completedAt: batch.completedAt,
      failedAt: batch.failedAt,
      errorMessage: batch.errorMessage,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      transactions: batch.transactions.map((t) => {
        const txn = t as unknown as FullTransaction;
        return {
          id: txn.id,
          status: txn.status,
          amount: typeof txn.amount === 'object' && txn.amount?.toNumber
            ? txn.amount.toNumber()
            : Number(txn.amount),
          transactionId: txn.transactionId,
          commissionId: txn.commissionId,
          payeeRiseId: txn.payeeRiseId,
          currency: txn.currency,
          retryCount: txn.retryCount,
          commission: txn.commission,
          affiliateRiseAccount: txn.affiliateRiseAccount,
        };
      }),
    };
  }

  /**
   * Update batch status with appropriate timestamp
   *
   * @param batchId The batch ID
   * @param status New status
   * @param errorMessage Optional error message for FAILED status
   */
  async updateBatchStatus(
    batchId: string,
    status: BatchStatus,
    errorMessage?: string
  ): Promise<void> {
    const updateData: Record<string, unknown> = { status };

    switch (status) {
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
   * Get all batches with optional status filter
   *
   * @param status Optional status filter
   * @param limit Maximum number of batches to return
   * @returns Array of payment batches
   */
  async getAllBatches(
    status?: BatchStatus,
    limit: number = 50
  ): Promise<PaymentBatchWithTransactions[]> {
    const batches = await this.prisma.paymentBatch.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        transactions: {
          select: {
            id: true,
            status: true,
            amount: true,
          },
        },
      },
    });

    return batches.map((batch) => ({
      id: batch.id,
      batchNumber: batch.batchNumber,
      paymentCount: batch.paymentCount,
      totalAmount: Number(batch.totalAmount),
      currency: batch.currency,
      provider: batch.provider,
      status: batch.status,
      scheduledAt: batch.scheduledAt,
      executedAt: batch.executedAt,
      completedAt: batch.completedAt,
      failedAt: batch.failedAt,
      errorMessage: batch.errorMessage,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      transactions: batch.transactions.map((t) => ({
        id: t.id,
        status: t.status,
        amount: Number(t.amount),
      })),
    }));
  }

  /**
   * Split items into batches of specified size
   *
   * @param items Items to split
   * @param batchSize Maximum items per batch
   * @returns Array of item batches
   */
  splitIntoBatches<T>(items: T[], batchSize: number = MAX_BATCH_SIZE): T[][] {
    if (items.length === 0) {
      return [];
    }

    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Delete a batch (only allowed for PENDING or CANCELLED batches)
   *
   * @param batchId The batch ID
   * @throws Error if batch not found or cannot be deleted
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

    await this.prisma.paymentBatch.delete({
      where: { id: batchId },
    });
  }

  /**
   * Queue a batch for processing
   *
   * @param batchId The batch ID
   */
  async queueBatch(batchId: string): Promise<void> {
    await this.updateBatchStatus(batchId, 'QUEUED');
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
    const batch = await this.prisma.paymentBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status === 'COMPLETED') {
      throw new Error('Cannot cancel a completed batch');
    }

    if (batch.status === 'PROCESSING') {
      throw new Error('Cannot cancel a batch that is currently processing');
    }

    await this.updateBatchStatus(batchId, 'CANCELLED', reason);
    await this.logger.logBatchCancelled(batchId, actor, reason);
  }

  /**
   * Get batch statistics
   *
   * @returns Batch statistics by status
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
    completedAmount: number;
  }> {
    const batches = await this.prisma.paymentBatch.findMany({
      select: {
        status: true,
        totalAmount: true,
      },
    });

    let pending = 0;
    let queued = 0;
    let processing = 0;
    let completed = 0;
    let failed = 0;
    let cancelled = 0;
    let totalAmount = 0;
    let completedAmount = 0;

    for (const batch of batches) {
      totalAmount += Number(batch.totalAmount);

      switch (batch.status) {
        case 'PENDING':
          pending++;
          break;
        case 'QUEUED':
          queued++;
          break;
        case 'PROCESSING':
          processing++;
          break;
        case 'COMPLETED':
          completed++;
          completedAmount += Number(batch.totalAmount);
          break;
        case 'FAILED':
          failed++;
          break;
        case 'CANCELLED':
          cancelled++;
          break;
      }
    }

    return {
      total: batches.length,
      pending,
      queued,
      processing,
      completed,
      failed,
      cancelled,
      totalAmount,
      completedAmount,
    };
  }

  /**
   * Check if there's already a batch being processed
   *
   * @returns true if a batch is currently processing
   */
  async hasBatchInProgress(): Promise<boolean> {
    const processingBatch = await this.prisma.paymentBatch.findFirst({
      where: { status: 'PROCESSING' },
    });
    return !!processingBatch;
  }
}
