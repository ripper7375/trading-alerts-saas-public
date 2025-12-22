/**
 * Payment Orchestrator Service (Part 19B)
 *
 * Coordinates payment batch execution, processes individual payments,
 * handles success/failure outcomes, and manages transaction state.
 */

import { PrismaClient } from '@prisma/client';
import { PaymentProvider } from '../providers/base-provider';
import type {
  PaymentRequest,
  BatchPaymentResult,
  DisbursementTransactionStatus,
} from '@/types/disbursement';
import { TransactionLogger } from './transaction-logger';
import { RetryHandler } from './retry-handler';
import { BatchManager, type PaymentBatchWithTransactions } from './batch-manager';
import { generateTransactionId } from '../constants';

/**
 * Extended transaction type with full details for orchestration
 */
interface TransactionWithDetails {
  id: string;
  transactionId: string;
  commissionId: string;
  payeeRiseId: string | null;
  amount: number;
  currency: string;
  status: string;
  retryCount: number;
  affiliateRiseAccount?: {
    affiliateProfileId: string;
    riseId: string;
  } | null;
}

/**
 * Execution result for a batch
 */
export interface ExecutionResult {
  success: boolean;
  batchId: string;
  totalAmount: number;
  successCount: number;
  failedCount: number;
  errors: string[];
}

/**
 * Payment orchestrator for batch payment execution
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
   * Execute all payments in a batch
   *
   * @param batchId The batch ID to execute
   * @returns Execution result with success/failure counts
   */
  async executeBatch(batchId: string): Promise<ExecutionResult> {
    const batch = await this.batchManager.getBatchById(batchId);

    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status !== 'PENDING' && batch.status !== 'QUEUED') {
      throw new Error(`Batch status ${batch.status} cannot be executed`);
    }

    // Mark batch as processing
    await this.batchManager.updateBatchStatus(batchId, 'PROCESSING');
    await this.logger.logBatchExecutionStarted(batchId);

    // Build payment requests from transactions
    const paymentRequests = this.buildPaymentRequests(batch);

    // Execute batch payment via provider
    let providerResult: BatchPaymentResult;
    try {
      providerResult = await this.provider.sendBatchPayment(paymentRequests);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Provider error';
      await this.batchManager.updateBatchStatus(batchId, 'FAILED', errorMessage);
      await this.logger.logBatchExecuted(batchId, {
        success: false,
        message: errorMessage,
        successCount: 0,
        failedCount: paymentRequests.length,
      });

      return {
        success: false,
        batchId,
        totalAmount: batch.totalAmount,
        successCount: 0,
        failedCount: paymentRequests.length,
        errors: [errorMessage],
      };
    }

    // Process individual payment results
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const paymentResult of providerResult.results) {
      if (paymentResult.success) {
        await this.handleSuccessfulPayment(
          paymentResult.transactionId,
          paymentResult.amount,
          paymentResult.providerTxId
        );
        successCount++;
      } else {
        await this.handleFailedPayment(
          paymentResult.transactionId,
          paymentResult.error || 'Unknown error'
        );
        failedCount++;
        if (paymentResult.error) {
          errors.push(paymentResult.error);
        }
      }
    }

    // Determine final batch status
    const batchSuccess = failedCount === 0;
    const finalStatus = batchSuccess ? 'COMPLETED' : 'FAILED';
    const errorMessage = batchSuccess ? undefined : errors.slice(0, 5).join('; ');

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
      totalAmount: providerResult.totalAmount,
      successCount,
      failedCount,
      errors,
    };
  }

  /**
   * Build payment requests from batch transactions
   */
  private buildPaymentRequests(
    batch: PaymentBatchWithTransactions
  ): PaymentRequest[] {
    return batch.transactions.map((txn) => {
      const txnDetails = txn as unknown as TransactionWithDetails;
      return {
        affiliateId: txnDetails.affiliateRiseAccount?.affiliateProfileId || '',
        riseId: txnDetails.payeeRiseId || txnDetails.affiliateRiseAccount?.riseId || '',
        amount: Number(txnDetails.amount),
        currency: txnDetails.currency || 'USD',
        commissionId: txnDetails.commissionId || '',
        metadata: {
          transactionId: txnDetails.transactionId || generateTransactionId(),
          batchId: batch.id,
          dbTransactionId: txnDetails.id,
        },
      };
    });
  }

  /**
   * Handle successful payment completion
   */
  private async handleSuccessfulPayment(
    transactionId: string,
    amount: number,
    providerTxId?: string
  ): Promise<void> {
    const transaction = await this.prisma.disbursementTransaction.findUnique({
      where: { transactionId },
    });

    if (!transaction) {
      console.warn(`Transaction not found for success handling: ${transactionId}`);
      return;
    }

    // Update transaction status
    await this.prisma.disbursementTransaction.update({
      where: { id: transaction.id },
      data: {
        status: 'COMPLETED' as DisbursementTransactionStatus,
        providerTxId,
        completedAt: new Date(),
      },
    });

    // Update commission status to PAID
    if (transaction.commissionId) {
      await this.prisma.commission.update({
        where: { id: transaction.commissionId },
        data: { status: 'PAID' },
      });
    }

    await this.logger.logPaymentCompleted(transactionId, amount, providerTxId);
  }

  /**
   * Handle failed payment
   */
  private async handleFailedPayment(
    transactionId: string,
    error: string
  ): Promise<void> {
    const transaction = await this.prisma.disbursementTransaction.findUnique({
      where: { transactionId },
    });

    if (!transaction) {
      console.warn(`Transaction not found for failure handling: ${transactionId}`);
      return;
    }

    const canRetry = await this.retryHandler.canRetry(transaction.id);

    if (canRetry) {
      await this.retryHandler.incrementRetryCount(transaction.id);
    } else if (transaction.retryCount >= 3) {
      await this.retryHandler.markAsMaxRetriesExceeded(transaction.id);
    }

    // Update transaction with failure info
    await this.prisma.disbursementTransaction.update({
      where: { id: transaction.id },
      data: {
        status: 'FAILED' as DisbursementTransactionStatus,
        errorMessage: error,
        failedAt: new Date(),
      },
    });

    await this.logger.logPaymentFailed(
      transactionId,
      error,
      transaction.retryCount
    );
  }

  /**
   * Retry failed transactions in a batch
   *
   * @param batchId The batch ID
   * @returns Retry result
   */
  async retryFailedTransactions(batchId: string): Promise<{
    retriedCount: number;
    skippedCount: number;
  }> {
    const retryableIds = await this.retryHandler.getRetryableTransactions(batchId);

    let retriedCount = 0;
    let skippedCount = 0;

    for (const txnId of retryableIds) {
      const canRetry = await this.retryHandler.canRetry(txnId);
      if (canRetry) {
        await this.retryHandler.incrementRetryCount(txnId);
        retriedCount++;
      } else {
        skippedCount++;
      }
    }

    return { retriedCount, skippedCount };
  }

  /**
   * Execute a single payment outside of a batch
   *
   * @param request Payment request details
   * @returns Payment result
   */
  async executeSinglePayment(request: PaymentRequest): Promise<{
    success: boolean;
    transactionId: string;
    error?: string;
  }> {
    try {
      const result = await this.provider.sendPayment(request);

      if (result.success) {
        await this.logger.logPaymentCompleted(
          result.transactionId,
          request.amount,
          result.providerTxId
        );
      } else {
        await this.logger.logPaymentFailed(
          result.transactionId,
          result.error || 'Unknown error'
        );
      }

      return {
        success: result.success,
        transactionId: result.transactionId,
        error: result.error,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Payment execution failed';
      return {
        success: false,
        transactionId: '',
        error: errorMessage,
      };
    }
  }

  /**
   * Get the current provider name
   */
  getProviderName(): string {
    return this.provider.name;
  }

  /**
   * Check provider connectivity
   */
  async checkProviderHealth(): Promise<{
    healthy: boolean;
    provider: string;
    error?: string;
  }> {
    try {
      await this.provider.authenticate();
      return {
        healthy: true,
        provider: this.provider.name,
      };
    } catch (error) {
      return {
        healthy: false,
        provider: this.provider.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
