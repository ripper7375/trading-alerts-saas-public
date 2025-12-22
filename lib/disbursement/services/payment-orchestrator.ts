/**
 * Payment Orchestrator Service (Part 19B)
 *
 * Coordinates payment execution for affiliate commission payouts.
 * Manages batch processing, payment submission, and status updates.
 *
 * DEPENDS ON: BatchManager.getBatchById() returning BatchWithTransactions
 * Required nested data:
 * - batch.transactions[].commission (for status updates)
 * - batch.transactions[].affiliateRiseAccount (for payment requests)
 */

import type { PrismaClient } from '@prisma/client';
import type { PaymentProvider } from '../providers/base-provider';
import type { PaymentRequest, BatchPaymentResult } from '@/types/disbursement';
import { TransactionLogger } from './transaction-logger';
import { RetryHandler } from './retry-handler';
import { BatchManager } from './batch-manager';
import type { BatchWithTransactions, BatchTransaction } from '../query-patterns';

/**
 * Execution result for a batch
 */
export interface ExecutionResult {
  success: boolean;
  batchId: string;
  batchNumber: string;
  totalAmount: number;
  successCount: number;
  failedCount: number;
  errors: string[];
}

/**
 * Payment orchestrator for batch execution
 */
export class PaymentOrchestrator {
  private readonly logger: TransactionLogger;
  private readonly retryHandler: RetryHandler;
  private readonly batchManager: BatchManager;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly provider: PaymentProvider
  ) {
    this.logger = new TransactionLogger(prisma);
    this.retryHandler = new RetryHandler(prisma);
    this.batchManager = new BatchManager(prisma);
  }

  /**
   * Execute a payment batch
   *
   * @param batchId The batch ID to execute
   * @returns Execution result with success/failure counts
   * @throws Error if batch not found or invalid status
   */
  async executeBatch(batchId: string): Promise<ExecutionResult> {
    const batch = await this.batchManager.getBatchById(batchId);

    if (!batch) {
      throw new Error('Batch not found');
    }

    // Validate batch status
    if (batch.status !== 'PENDING' && batch.status !== 'QUEUED') {
      throw new Error(
        `Cannot execute batch with status ${batch.status}. Only PENDING or QUEUED batches can be executed.`
      );
    }

    // Check for concurrent batch processing
    const isProcessing = await this.batchManager.isBatchProcessing();
    if (isProcessing) {
      throw new Error('Another batch is currently processing. Please wait.');
    }

    // Mark batch as processing
    await this.batchManager.updateBatchStatus(batchId, 'PROCESSING');
    await this.logger.logBatchExecutionStarted(batchId);

    try {
      // Build payment requests from transactions
      const paymentRequests = this.buildPaymentRequests(batch);

      if (paymentRequests.length === 0) {
        await this.batchManager.updateBatchStatus(batchId, 'COMPLETED');
        await this.logger.logBatchExecuted(batchId, {
          success: true,
          message: 'No transactions to process',
          successCount: 0,
          failedCount: 0,
        });

        return {
          success: true,
          batchId,
          batchNumber: batch.batchNumber,
          totalAmount: 0,
          successCount: 0,
          failedCount: 0,
          errors: [],
        };
      }

      // Execute payments via provider
      const providerResult = await this.provider.sendBatchPayment(paymentRequests);

      // Process results
      const { successCount, failedCount, errors } = await this.processPaymentResults(
        batch,
        providerResult
      );

      // Determine final batch status
      const batchSuccess = failedCount === 0;
      const finalStatus = batchSuccess ? 'COMPLETED' : 'FAILED';
      const errorMessage = batchSuccess ? undefined : errors.join('; ');

      await this.batchManager.updateBatchStatus(batchId, finalStatus, errorMessage);

      await this.logger.logBatchExecuted(batchId, {
        success: batchSuccess,
        message: `${successCount} succeeded, ${failedCount} failed`,
        successCount,
        failedCount,
      });

      return {
        success: batchSuccess,
        batchId,
        batchNumber: batch.batchNumber,
        totalAmount: providerResult.totalAmount,
        successCount,
        failedCount,
        errors,
      };
    } catch (error) {
      // Handle execution error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.batchManager.updateBatchStatus(batchId, 'FAILED', errorMessage);
      await this.logger.logBatchExecuted(batchId, {
        success: false,
        message: errorMessage,
      });

      throw error;
    }
  }

  /**
   * Build payment requests from batch transactions
   *
   * @param batch The batch with transactions
   * @returns Array of payment requests
   */
  private buildPaymentRequests(batch: BatchWithTransactions): PaymentRequest[] {
    const requests: PaymentRequest[] = [];

    for (const transaction of batch.transactions) {
      // Skip non-pending transactions
      if (transaction.status !== 'PENDING') {
        continue;
      }

      // Validate required data
      if (!transaction.payeeRiseId) {
        console.warn(
          `Transaction ${transaction.id} missing payeeRiseId, skipping`
        );
        continue;
      }

      requests.push({
        affiliateId: transaction.affiliateRiseAccount?.affiliateProfileId ?? '',
        riseId: transaction.payeeRiseId,
        amount: Number(transaction.amount),
        currency: transaction.currency,
        commissionId: transaction.commissionId,
        metadata: {
          transactionId: transaction.transactionId,
          batchId: batch.id,
          dbTransactionId: transaction.id,
        },
      });
    }

    return requests;
  }

  /**
   * Process payment results and update database
   *
   * @param batch The batch
   * @param result Provider batch result
   * @returns Success and failure counts
   */
  private async processPaymentResults(
    batch: BatchWithTransactions,
    result: BatchPaymentResult
  ): Promise<{ successCount: number; failedCount: number; errors: string[] }> {
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const paymentResult of result.results) {
      // Find the corresponding transaction by transactionId
      const transaction = batch.transactions.find(
        (t: BatchTransaction) => t.transactionId === paymentResult.transactionId
      );

      if (!transaction) {
        // Try to find by metadata.transactionId if provider preserves it
        console.warn(
          `Could not find transaction for result: ${paymentResult.transactionId}`
        );
        continue;
      }

      if (paymentResult.success) {
        await this.handleSuccessfulPayment(transaction, paymentResult);
        successCount++;
      } else {
        await this.handleFailedPayment(
          transaction,
          paymentResult.error ?? 'Unknown payment error'
        );
        failedCount++;
        if (paymentResult.error) {
          errors.push(paymentResult.error);
        }
      }
    }

    return { successCount, failedCount, errors };
  }

  /**
   * Handle a successful payment
   *
   * @param transaction The transaction
   * @param result Payment result
   */
  private async handleSuccessfulPayment(
    transaction: BatchTransaction,
    result: { providerTxId?: string; amount: number }
  ): Promise<void> {
    // Update transaction status
    await this.prisma.disbursementTransaction.update({
      where: { id: transaction.id },
      data: {
        status: 'COMPLETED',
        providerTxId: result.providerTxId,
        completedAt: new Date(),
      },
    });

    // Update commission status to PAID
    await this.prisma.commission.update({
      where: { id: transaction.commissionId },
      data: { status: 'PAID' },
    });

    await this.logger.logPaymentCompleted(
      transaction.id,
      result.amount,
      result.providerTxId
    );

    await this.logger.logCommissionStatusUpdate(
      transaction.id,
      transaction.commissionId,
      'PAID'
    );
  }

  /**
   * Handle a failed payment
   *
   * @param transaction The transaction
   * @param error Error message
   */
  private async handleFailedPayment(
    transaction: BatchTransaction,
    error: string
  ): Promise<void> {
    // Check if can retry
    const canRetry = await this.retryHandler.canRetry(transaction.id);

    if (canRetry) {
      await this.retryHandler.incrementRetryCount(transaction.id);
    } else {
      // Max retries exceeded - mark as cancelled
      await this.retryHandler.markAsMaxRetriesExceeded(transaction.id);
    }

    // Update transaction with error
    await this.prisma.disbursementTransaction.update({
      where: { id: transaction.id },
      data: {
        status: canRetry ? 'PENDING' : 'CANCELLED',
        errorMessage: error,
        failedAt: new Date(),
      },
    });

    await this.logger.logPaymentFailed(transaction.id, error, canRetry);
  }

  /**
   * Retry failed transactions in a batch
   *
   * @param batchId The batch ID
   * @returns Execution result
   */
  async retryFailedTransactions(batchId: string): Promise<ExecutionResult> {
    const batch = await this.batchManager.getBatchById(batchId);

    if (!batch) {
      throw new Error('Batch not found');
    }

    // Reset failed transactions for retry
    const resetCount = await this.retryHandler.resetFailedTransactionsForRetry(batchId);

    if (resetCount === 0) {
      return {
        success: true,
        batchId,
        batchNumber: batch.batchNumber,
        totalAmount: 0,
        successCount: 0,
        failedCount: 0,
        errors: ['No failed transactions to retry'],
      };
    }

    // Update batch status back to QUEUED for retry
    await this.batchManager.updateBatchStatus(batchId, 'QUEUED');

    // Execute the batch again
    return this.executeBatch(batchId);
  }

  /**
   * Get execution statistics for a batch
   *
   * @param batchId The batch ID
   * @returns Execution statistics
   */
  async getExecutionStats(batchId: string): Promise<{
    batch: BatchWithTransactions | null;
    stats: {
      total: number;
      pending: number;
      completed: number;
      failed: number;
      cancelled: number;
    };
  }> {
    const batch = await this.batchManager.getBatchById(batchId);

    if (!batch) {
      return {
        batch: null,
        stats: {
          total: 0,
          pending: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
        },
      };
    }

    const stats = {
      total: batch.transactions.length,
      pending: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const txn of batch.transactions) {
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
          break;
        case 'CANCELLED':
          stats.cancelled++;
          break;
      }
    }

    return { batch, stats };
  }
}
