/**
 * Retry Handler Service (Part 19B)
 *
 * Manages retry logic for failed payment transactions.
 * Implements exponential backoff and max retry limits.
 */

import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_RETRY_CONFIG,
  calculateBackoffDelay,
  canRetryTransaction,
} from '../constants';
import { TransactionLogger } from './transaction-logger';

/**
 * Retry configuration options
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * Failed transaction info for retry processing
 */
export interface FailedTransaction {
  id: string;
  transactionId: string;
  batchId: string;
  retryCount: number;
  status: string;
  errorMessage: string | null;
  lastRetryAt: Date | null;
}

/**
 * Retry handler for failed disbursement transactions
 */
export class RetryHandler {
  private readonly config: RetryConfig;
  private readonly logger: TransactionLogger;

  constructor(
    private readonly prisma: PrismaClient,
    config?: Partial<RetryConfig>
  ) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
    this.logger = new TransactionLogger(prisma);
  }

  /**
   * Check if a transaction can be retried
   *
   * @param transactionId The transaction ID (primary key)
   * @returns true if transaction can be retried
   */
  async canRetry(transactionId: string): Promise<boolean> {
    const transaction = await this.prisma.disbursementTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return false;
    }

    return canRetryTransaction(
      transaction.status,
      transaction.retryCount,
      this.config.maxAttempts
    );
  }

  /**
   * Increment retry count and reset status to PENDING
   *
   * @param transactionId The transaction ID (primary key)
   */
  async incrementRetryCount(transactionId: string): Promise<void> {
    const transaction = await this.prisma.disbursementTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    const newRetryCount = transaction.retryCount + 1;

    await this.prisma.disbursementTransaction.update({
      where: { id: transactionId },
      data: {
        retryCount: newRetryCount,
        lastRetryAt: new Date(),
        status: 'PENDING',
        errorMessage: null,
      },
    });

    await this.logger.logPaymentRetry(transaction.transactionId, newRetryCount);
  }

  /**
   * Mark a transaction as cancelled due to max retries exceeded
   *
   * @param transactionId The transaction ID (primary key)
   */
  async markAsMaxRetriesExceeded(transactionId: string): Promise<void> {
    const transaction = await this.prisma.disbursementTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    await this.prisma.disbursementTransaction.update({
      where: { id: transactionId },
      data: {
        status: 'CANCELLED',
        errorMessage: `Max retry attempts (${this.config.maxAttempts}) exceeded`,
        failedAt: new Date(),
      },
    });

    await this.logger.logMaxRetriesExceeded(
      transaction.transactionId,
      this.config.maxAttempts
    );
  }

  /**
   * Calculate the delay before next retry based on retry count
   *
   * @param retryCount Current retry count
   * @returns Delay in milliseconds
   */
  calculateDelay(retryCount: number): number {
    return calculateBackoffDelay(retryCount + 1, this.config);
  }

  /**
   * Get all failed transactions for a batch that can be retried
   *
   * @param batchId The batch ID
   * @returns Array of transaction IDs that can be retried
   */
  async getRetryableTransactions(batchId: string): Promise<string[]> {
    const transactions = await this.prisma.disbursementTransaction.findMany({
      where: {
        batchId,
        status: 'FAILED',
        retryCount: { lt: this.config.maxAttempts },
      },
      select: { id: true },
    });

    return transactions.map((t) => t.id);
  }

  /**
   * Get all failed transactions for a batch with details
   *
   * @param batchId The batch ID
   * @returns Array of failed transaction details
   */
  async getFailedTransactionsDetails(
    batchId: string
  ): Promise<FailedTransaction[]> {
    const transactions = await this.prisma.disbursementTransaction.findMany({
      where: {
        batchId,
        status: 'FAILED',
      },
      select: {
        id: true,
        transactionId: true,
        batchId: true,
        retryCount: true,
        status: true,
        errorMessage: true,
        lastRetryAt: true,
      },
    });

    return transactions.map((t) => ({
      id: t.id,
      transactionId: t.transactionId,
      batchId: t.batchId,
      retryCount: t.retryCount,
      status: t.status,
      errorMessage: t.errorMessage,
      lastRetryAt: t.lastRetryAt,
    }));
  }

  /**
   * Get transactions that have exceeded max retries
   *
   * @param batchId Optional batch ID filter
   * @returns Array of cancelled transaction IDs
   */
  async getCancelledTransactions(batchId?: string): Promise<string[]> {
    const transactions = await this.prisma.disbursementTransaction.findMany({
      where: {
        ...(batchId && { batchId }),
        status: 'CANCELLED',
        retryCount: { gte: this.config.maxAttempts },
      },
      select: { id: true },
    });

    return transactions.map((t) => t.id);
  }

  /**
   * Reset a cancelled transaction for manual retry
   * Only works on transactions that were cancelled due to max retries
   *
   * @param transactionId The transaction ID (primary key)
   */
  async resetForManualRetry(transactionId: string): Promise<void> {
    const transaction = await this.prisma.disbursementTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    if (transaction.status !== 'CANCELLED') {
      throw new Error('Only cancelled transactions can be reset for retry');
    }

    await this.prisma.disbursementTransaction.update({
      where: { id: transactionId },
      data: {
        status: 'PENDING',
        retryCount: 0,
        errorMessage: null,
        lastRetryAt: null,
        failedAt: null,
      },
    });

    await this.logger.log({
      action: 'payment.manual_retry_reset',
      status: 'INFO',
      transactionId: transaction.transactionId,
      details: {
        previousStatus: 'CANCELLED',
        previousRetryCount: transaction.retryCount,
      },
    });
  }

  /**
   * Get retry statistics for a batch
   *
   * @param batchId The batch ID
   * @returns Retry statistics
   */
  async getRetryStats(batchId: string): Promise<{
    totalTransactions: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
    retryable: number;
  }> {
    const transactions = await this.prisma.disbursementTransaction.findMany({
      where: { batchId },
      select: { status: true, retryCount: true },
    });

    let pending = 0;
    let processing = 0;
    let completed = 0;
    let failed = 0;
    let cancelled = 0;
    let retryable = 0;

    for (const txn of transactions) {
      switch (txn.status) {
        case 'PENDING':
          pending++;
          break;
        case 'PROCESSING':
          processing++;
          break;
        case 'COMPLETED':
          completed++;
          break;
        case 'FAILED':
          failed++;
          if (txn.retryCount < this.config.maxAttempts) {
            retryable++;
          }
          break;
        case 'CANCELLED':
          cancelled++;
          break;
      }
    }

    return {
      totalTransactions: transactions.length,
      pending,
      processing,
      completed,
      failed,
      cancelled,
      retryable,
    };
  }

  /**
   * Get the retry configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }
}
