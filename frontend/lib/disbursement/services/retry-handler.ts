/**
 * Retry Handler Service (Part 19B)
 *
 * Manages retry logic for failed disbursement transactions.
 * Implements exponential backoff and max retry limits.
 */

import { PrismaClient } from '@prisma/client';
import { DEFAULT_RETRY_CONFIG } from '../constants';

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * Retry handler for failed payment transactions
 */
export class RetryHandler {
  private readonly config: RetryConfig;

  constructor(
    private readonly prisma: PrismaClient,
    config?: Partial<RetryConfig>
  ) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Check if a transaction can be retried
   *
   * @param transactionId Transaction ID (internal id)
   * @returns true if transaction can be retried
   */
  async canRetry(transactionId: string): Promise<boolean> {
    const transaction = await this.prisma.disbursementTransaction.findUnique({
      where: { id: transactionId },
      select: { status: true, retryCount: true },
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
   * Increment retry count and reset status to PENDING
   *
   * @param transactionId Transaction ID (internal id)
   */
  async incrementRetryCount(transactionId: string): Promise<void> {
    await this.prisma.disbursementTransaction.update({
      where: { id: transactionId },
      data: {
        retryCount: { increment: 1 },
        lastRetryAt: new Date(),
        status: 'PENDING',
        errorMessage: null, // Clear previous error
      },
    });
  }

  /**
   * Mark transaction as cancelled due to max retries exceeded
   *
   * @param transactionId Transaction ID (internal id)
   */
  async markAsMaxRetriesExceeded(transactionId: string): Promise<void> {
    await this.prisma.disbursementTransaction.update({
      where: { id: transactionId },
      data: {
        status: 'CANCELLED',
        errorMessage: `Max retry attempts (${this.config.maxAttempts}) exceeded`,
      },
    });
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
   * @param batchId Batch ID
   * @returns Array of transaction IDs
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

    type TxnId = (typeof transactions)[number];
    return transactions.map((t: TxnId) => t.id);
  }

  /**
   * Get transactions that have exceeded max retries
   *
   * @param batchId Batch ID
   * @returns Array of transaction IDs
   */
  async getExhaustedTransactions(batchId: string): Promise<string[]> {
    const transactions = await this.prisma.disbursementTransaction.findMany({
      where: {
        batchId,
        status: 'FAILED',
        retryCount: { gte: this.config.maxAttempts },
      },
      select: { id: true },
    });

    type ExhaustedTxnId = (typeof transactions)[number];
    return transactions.map((t: ExhaustedTxnId) => t.id);
  }

  /**
   * Prepare a transaction for retry
   *
   * @param transactionId Transaction ID (internal id)
   * @returns true if retry was prepared successfully, false if not eligible
   */
  async prepareRetry(transactionId: string): Promise<boolean> {
    const canRetry = await this.canRetry(transactionId);

    if (!canRetry) {
      return false;
    }

    await this.incrementRetryCount(transactionId);
    return true;
  }

  /**
   * Get retry statistics for a batch
   *
   * @param batchId Batch ID
   * @returns Retry statistics
   */
  async getBatchRetryStats(batchId: string): Promise<{
    totalFailed: number;
    retryable: number;
    exhausted: number;
  }> {
    const [retryable, exhausted] = await Promise.all([
      this.getRetryableTransactions(batchId),
      this.getExhaustedTransactions(batchId),
    ]);

    return {
      totalFailed: retryable.length + exhausted.length,
      retryable: retryable.length,
      exhausted: exhausted.length,
    };
  }

  /**
   * Get current retry configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }
}
