/**
 * Retry Handler Service (Part 19B)
 *
 * Manages retry logic for failed payment transactions.
 * Implements exponential backoff and max retry limits.
 */

import type { PrismaClient } from '@prisma/client';
import { DEFAULT_RETRY_CONFIG } from '../constants';
import { TransactionLogger } from './transaction-logger';

/**
 * Retry configuration interface
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * Retry eligibility result
 */
export interface RetryEligibility {
  canRetry: boolean;
  currentAttempt: number;
  maxAttempts: number;
  nextRetryDelay?: number;
  reason?: string;
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
   * @param transactionId The transaction ID (from DisbursementTransaction.id)
   * @returns Whether the transaction can be retried
   */
  async canRetry(transactionId: string): Promise<boolean> {
    const transaction = await this.prisma.disbursementTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return false;
    }

    return (
      transaction.status === 'FAILED' &&
      transaction.retryCount < this.config.maxAttempts
    );
  }

  /**
   * Get detailed retry eligibility information
   *
   * @param transactionId The transaction ID
   * @returns Retry eligibility details
   */
  async getRetryEligibility(transactionId: string): Promise<RetryEligibility> {
    const transaction = await this.prisma.disbursementTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return {
        canRetry: false,
        currentAttempt: 0,
        maxAttempts: this.config.maxAttempts,
        reason: 'Transaction not found',
      };
    }

    if (transaction.status !== 'FAILED') {
      return {
        canRetry: false,
        currentAttempt: transaction.retryCount,
        maxAttempts: this.config.maxAttempts,
        reason: `Transaction status is ${transaction.status}, not FAILED`,
      };
    }

    if (transaction.retryCount >= this.config.maxAttempts) {
      return {
        canRetry: false,
        currentAttempt: transaction.retryCount,
        maxAttempts: this.config.maxAttempts,
        reason: 'Max retry attempts exceeded',
      };
    }

    const nextRetryDelay = this.calculateDelay(transaction.retryCount);

    return {
      canRetry: true,
      currentAttempt: transaction.retryCount,
      maxAttempts: this.config.maxAttempts,
      nextRetryDelay,
    };
  }

  /**
   * Increment retry count and reset status to PENDING
   *
   * @param transactionId The transaction ID
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
        errorMessage: null, // Clear previous error
      },
    });

    await this.logger.logPaymentRetry(
      transactionId,
      newRetryCount,
      this.config.maxAttempts
    );
  }

  /**
   * Mark a transaction as max retries exceeded (CANCELLED)
   *
   * @param transactionId The transaction ID
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

    await this.logger.logMaxRetriesExceeded(transactionId, transaction.retryCount);
  }

  /**
   * Calculate delay for exponential backoff
   *
   * @param retryCount Current retry count (0-indexed)
   * @returns Delay in milliseconds
   */
  calculateDelay(retryCount: number): number {
    const delay =
      this.config.initialDelay *
      Math.pow(this.config.backoffMultiplier, retryCount);
    return Math.min(delay, this.config.maxDelay);
  }

  /**
   * Get all failed transactions in a batch that can be retried
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

    return transactions.map((t: { id: string }) => t.id);
  }

  /**
   * Get failed transactions that have exceeded max retries
   *
   * @param batchId The batch ID
   * @returns Array of transaction IDs
   */
  async getMaxRetriesExceededTransactions(batchId: string): Promise<string[]> {
    const transactions = await this.prisma.disbursementTransaction.findMany({
      where: {
        batchId,
        status: 'FAILED',
        retryCount: { gte: this.config.maxAttempts },
      },
      select: { id: true },
    });

    return transactions.map((t: { id: string }) => t.id);
  }

  /**
   * Reset failed transactions for retry
   * Useful for manual retry of all failed transactions in a batch
   *
   * @param batchId The batch ID
   * @returns Number of transactions reset
   */
  async resetFailedTransactionsForRetry(batchId: string): Promise<number> {
    const result = await this.prisma.disbursementTransaction.updateMany({
      where: {
        batchId,
        status: 'FAILED',
        retryCount: { lt: this.config.maxAttempts },
      },
      data: {
        status: 'PENDING',
        errorMessage: null,
      },
    });

    return result.count;
  }

  /**
   * Get retry statistics for a batch
   *
   * @param batchId The batch ID
   * @returns Retry statistics
   */
  async getBatchRetryStats(batchId: string): Promise<{
    total: number;
    pending: number;
    completed: number;
    failed: number;
    cancelled: number;
    retryable: number;
    totalRetryAttempts: number;
  }> {
    const transactions = await this.prisma.disbursementTransaction.findMany({
      where: { batchId },
      select: { status: true, retryCount: true },
    });

    const stats = {
      total: transactions.length,
      pending: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      retryable: 0,
      totalRetryAttempts: 0,
    };

    for (const txn of transactions) {
      stats.totalRetryAttempts += txn.retryCount;

      switch (txn.status) {
        case 'PENDING':
        case 'PROCESSING':
          stats.pending++;
          break;
        case 'COMPLETED':
          stats.completed++;
          break;
        case 'FAILED':
          stats.failed++;
          if (txn.retryCount < this.config.maxAttempts) {
            stats.retryable++;
          }
          break;
        case 'CANCELLED':
          stats.cancelled++;
          break;
      }
    }

    return stats;
  }

  /**
   * Get the retry configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }
}
