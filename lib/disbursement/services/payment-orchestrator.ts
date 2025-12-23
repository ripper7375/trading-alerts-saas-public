/**
 * Payment Orchestrator Service (Part 19B)
 *
 * Executes batch payments by coordinating with payment providers.
 * Handles payment execution, result processing, and error handling.
 */

import { PrismaClient } from '@prisma/client';
import { PaymentProvider } from '../providers/base-provider';
import type { PaymentRequest } from '@/types/disbursement';
import { TransactionLogger } from './transaction-logger';
import { RetryHandler } from './retry-handler';
import { BatchManager } from './batch-manager';
import { TransactionService } from './transaction-service';

/**
 * Result of batch execution
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
 * Payment orchestrator for executing batch payments
 */
export class PaymentOrchestrator {
  private readonly logger: TransactionLogger;
  private readonly retryHandler: RetryHandler;
  private readonly batchManager: BatchManager;
  private readonly transactionService: TransactionService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly provider: PaymentProvider
  ) {
    this.logger = new TransactionLogger(prisma);
    this.retryHandler = new RetryHandler(prisma);
    this.batchManager = new BatchManager(prisma);
    this.transactionService = new TransactionService(prisma);
  }

  /**
   * Execute a payment batch
   *
   * @param batchId Batch ID to execute
   * @returns Execution result
   * @throws Error if batch not found or invalid status
   */
  async executeBatch(batchId: string): Promise<ExecutionResult> {
    const batch = await this.batchManager.getBatchById(batchId);

    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status !== 'PENDING' && batch.status !== 'QUEUED') {
      throw new Error(
        `Cannot execute batch with status ${batch.status}. Only PENDING or QUEUED batches can be executed.`
      );
    }

    // Update batch status to PROCESSING
    await this.batchManager.updateBatchStatus(batchId, 'PROCESSING');

    const transactions = batch.transactions ?? [];
    type BatchTransaction = (typeof transactions)[number];

    // Filter transactions that are ready for payment
    const pendingTransactions = transactions.filter(
      (txn: BatchTransaction) => txn.status === 'PENDING'
    );

    if (pendingTransactions.length === 0) {
      await this.batchManager.updateBatchStatus(
        batchId,
        'COMPLETED',
        'No pending transactions to process'
      );

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

    // Build payment requests from transactions
    const paymentRequests: PaymentRequest[] = pendingTransactions.map(
      (txn: BatchTransaction) => ({
        affiliateId: txn.affiliateRiseAccount?.affiliateProfileId || '',
        riseId: txn.payeeRiseId || '',
        amount: Number(txn.amount),
        currency: txn.currency,
        commissionId: txn.commissionId,
        metadata: {
          transactionId: txn.transactionId,
          internalId: txn.id,
          batchId: batch.id,
        },
      })
    );

    // Execute via provider
    const result = await this.provider.sendBatchPayment(paymentRequests);

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Process results
    for (const paymentResult of result.results) {
      // Find the matching transaction by transactionId
      const txn = pendingTransactions.find(
        (t: BatchTransaction) => t.transactionId === paymentResult.transactionId
      );

      if (!txn) {
        console.error(
          `No matching transaction for result: ${paymentResult.transactionId}`
        );
        continue;
      }

      if (paymentResult.success) {
        await this.handleSuccessfulPayment(txn.id, txn.commissionId, {
          providerTxId: paymentResult.providerTxId,
          amount: paymentResult.amount,
        });
        successCount++;
      } else {
        await this.handleFailedPayment(
          txn.id,
          paymentResult.error || 'Unknown error'
        );
        failedCount++;
        errors.push(
          `Transaction ${txn.transactionId}: ${paymentResult.error || 'Unknown error'}`
        );
      }
    }

    // Determine final batch status
    const batchSuccess = failedCount === 0;
    await this.batchManager.updateBatchStatus(
      batchId,
      batchSuccess ? 'COMPLETED' : 'FAILED',
      batchSuccess ? undefined : `${failedCount} payment(s) failed`
    );

    await this.logger.logBatchExecuted(batchId, {
      success: batchSuccess,
      message: `${successCount} succeeded, ${failedCount} failed`,
    });

    return {
      success: batchSuccess,
      batchId,
      batchNumber: batch.batchNumber,
      totalAmount: result.totalAmount,
      successCount,
      failedCount,
      errors,
    };
  }

  /**
   * Handle a successful payment
   */
  private async handleSuccessfulPayment(
    transactionId: string,
    commissionId: string,
    result: { providerTxId?: string; amount: number }
  ): Promise<void> {
    // Update transaction status
    await this.transactionService.updateTransactionStatus(
      transactionId,
      'COMPLETED',
      { providerTxId: result.providerTxId }
    );

    // Mark commission as paid
    await this.transactionService.markCommissionPaid(commissionId);

    await this.logger.logPaymentCompleted(
      transactionId,
      result.amount,
      result.providerTxId
    );
  }

  /**
   * Handle a failed payment
   */
  private async handleFailedPayment(
    transactionId: string,
    error: string
  ): Promise<void> {
    // Check if can retry
    const canRetry = await this.retryHandler.canRetry(transactionId);

    if (canRetry) {
      // Will be retried on next execution
      await this.logger.logPaymentFailed(transactionId, error, true);
    } else {
      // Mark as cancelled (max retries exceeded)
      await this.retryHandler.markAsMaxRetriesExceeded(transactionId);
      await this.logger.logMaxRetriesExceeded(
        transactionId,
        this.retryHandler.getConfig().maxAttempts
      );
    }

    // Update transaction status
    await this.transactionService.updateTransactionStatus(
      transactionId,
      'FAILED',
      { errorMessage: error }
    );

    await this.logger.logPaymentFailed(transactionId, error);
  }

  /**
   * Retry failed transactions in a batch
   *
   * @param batchId Batch ID
   * @returns Number of transactions queued for retry
   */
  async retryFailedTransactions(batchId: string): Promise<number> {
    const retryableIds =
      await this.retryHandler.getRetryableTransactions(batchId);

    let retryCount = 0;
    for (const txnId of retryableIds) {
      const prepared = await this.retryHandler.prepareRetry(txnId);
      if (prepared) {
        await this.logger.logPaymentRetry(
          txnId,
          (
            await this.prisma.disbursementTransaction.findUnique({
              where: { id: txnId },
              select: { retryCount: true },
            })
          )?.retryCount || 0
        );
        retryCount++;
      }
    }

    // If we have transactions to retry, update batch status back to PENDING
    if (retryCount > 0) {
      await this.batchManager.updateBatchStatus(batchId, 'PENDING');
    }

    return retryCount;
  }

  /**
   * Get execution summary for a batch
   *
   * @param batchId Batch ID
   * @returns Execution summary
   */
  async getExecutionSummary(batchId: string): Promise<{
    batchId: string;
    status: string;
    totalTransactions: number;
    completed: number;
    failed: number;
    pending: number;
    cancelled: number;
    totalAmount: number;
    paidAmount: number;
  }> {
    const batch = await this.batchManager.getBatchById(batchId);

    if (!batch) {
      throw new Error('Batch not found');
    }

    const counts =
      await this.transactionService.getTransactionCountsByStatus(batchId);

    const batchTransactions = batch.transactions ?? [];
    type SummaryTransaction = (typeof batchTransactions)[number];

    const paidAmount = batchTransactions
      .filter((t: SummaryTransaction) => t.status === 'COMPLETED')
      .reduce((sum: number, t: SummaryTransaction) => sum + Number(t.amount), 0);

    return {
      batchId,
      status: batch.status,
      totalTransactions: batchTransactions.length,
      completed: counts.completed,
      failed: counts.failed,
      pending: counts.pending,
      cancelled: counts.cancelled,
      totalAmount: Number(batch.totalAmount),
      paidAmount,
    };
  }
}
