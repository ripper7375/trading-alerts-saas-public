/**
 * Payment Orchestrator Service (Part 19B)
 *
 * Ported from lib/disbursement/services/payment-orchestrator.ts (Session
 * 4A-2, File 3/6). Executes batch payments by coordinating with payment
 * providers. Handles payment execution, result processing, and error
 * handling.
 *
 * Two structural changes from source, both required to make this a real
 * Nest singleton (recorded in the order's Deviations):
 *  1. `TransactionLoggerService`/`RetryHandlerService`/`BatchManagerService`/
 *     `TransactionService` are constructor-injected instead of `new`-ed
 *     internally from a raw `PrismaClient`.
 *  2. `provider: PaymentProvider` moved from a constructor parameter to a
 *     per-call parameter on `executeBatch` — a Nest `@Injectable()` is a
 *     fixed singleton, so it can't take a runtime-varying constructor
 *     argument the way source's plain `new PaymentOrchestrator(prisma,
 *     paymentProvider)` per-call construction did. Same call-site intent
 *     (disbursement-processor.service.ts still picks a provider immediately
 *     before executing a batch), just passed at the call instead of at
 *     construction.
 */

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { isFundable } from '../wise/providers/provider-capabilities';
import type { FundableProvider } from '../wise/providers/provider-capabilities';

import { BatchManagerService } from './batch-manager.service';
import type { PaymentRequest } from './disbursement.types';
import { PaymentProvider } from './providers/base-provider';
import { RetryHandlerService } from './retry-handler.service';
import { TransactionLoggerService } from './transaction-logger.service';
import { TransactionService } from './transaction.service';

type BatchWithTransactions = NonNullable<
  Awaited<ReturnType<BatchManagerService['getBatchById']>>
>;
type BatchTransactionRow = BatchWithTransactions['transactions'][number];

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
@Injectable()
export class PaymentOrchestratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: TransactionLoggerService,
    private readonly retryHandler: RetryHandlerService,
    private readonly batchManager: BatchManagerService,
    private readonly transactionService: TransactionService
  ) {}

  /**
   * Execute a payment batch
   *
   * @param batchId Batch ID to execute
   * @param provider Payment provider to execute the batch through
   * @returns Execution result
   * @throws Error if batch not found or invalid status
   */
  async executeBatch(
    batchId: string,
    provider: PaymentProvider
  ): Promise<ExecutionResult> {
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

    // §3.4 branch (Hard Invariant #1): a fundable provider (Wise) drafts a
    // batch but must NEVER itself set Commission.status = 'PAID' or touch
    // AffiliateProfile.balance — that stays 4A-W5's webhook reducer's
    // exclusive job. Every non-fundable provider (Mock, archived Rise) is
    // completely unaffected by this branch and falls through to the
    // existing logic below, unmodified (Hard Invariant #4 — the parity
    // oracle for this session's only genuinely risky edit).
    if (isFundable(provider)) {
      return this.executeFundableBatch(
        batchId,
        batch,
        pendingTransactions,
        provider
      );
    }

    // Build payment requests from transactions
    const paymentRequests: PaymentRequest[] = pendingTransactions.map(
      (txn: BatchTransaction) => ({
        // Hard Invariant #2 / design §3.5(a) fix: Commission.affiliateProfileId
        // is always present (required FK); txn.affiliateRiseAccount is absent
        // for any non-Rise transaction and silently produced '' here before.
        // Behavior-preserving for Rise: affiliateRiseAccount.affiliateProfileId
        // and commission.affiliateProfileId are the same value by construction.
        affiliateId: txn.commission.affiliateProfileId || '',
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
    const result = await provider.sendBatchPayment(paymentRequests);

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
   * §3.4 fundable-provider path (Wise). Drafts the batch at the provider
   * (quote + transfer per commission, no money moved) and closes it to
   * obtain pay-in instructions. Writes `DisbursementTransaction.status`
   * only for per-affiliate drafting FAILURES (housekeeping — Hard
   * Invariant #1 only prohibits touching `Commission.status`/balance, not
   * marking a drafting failure). Successful drafts stay `PENDING` exactly
   * as `TransactionService.createTransactionsForCommissions` left them —
   * they advance only when 4A-W5's reducer processes a real Wise webhook.
   * `PaymentBatch.status` stays `PROCESSING` (set unconditionally above);
   * there is no `COMPLETED` transition here, since "complete" for a Wise
   * batch means every transfer actually paid out, which is asynchronous
   * and reducer-driven, not something `executeBatch` can observe synchronously.
   */
  private async executeFundableBatch(
    batchId: string,
    batch: BatchWithTransactions,
    pendingTransactions: BatchTransactionRow[],
    provider: PaymentProvider & FundableProvider
  ): Promise<ExecutionResult> {
    const prepared = await provider.prepareBatch({
      paymentBatchId: batchId,
      batchName: batch.batchNumber,
      sourceCurrency: batch.currency,
      items: pendingTransactions.map((txn) => ({
        commissionId: txn.commissionId,
        // Hard Invariant #2 / design §3.5(a) fix: resolve the affiliate from
        // Commission.affiliateProfileId (always present, required FK), NOT
        // txn.affiliateRiseAccount?.affiliateProfileId — a Wise transaction
        // has no Rise account, so that path silently produced ''.
        affiliateProfileId: txn.commission.affiliateProfileId,
        amount: Number(txn.amount),
      })),
    });

    if (prepared.transfers.length > 0) {
      await provider.completeBatch(prepared.providerBatchId);
    }

    for (const failure of prepared.failures) {
      const txn = pendingTransactions.find(
        (t) => t.commissionId === failure.commissionId
      );
      if (txn) {
        await this.transactionService.updateTransactionStatus(
          txn.id,
          'FAILED',
          {
            errorMessage: failure.reason,
          }
        );
      }
    }

    await this.logger.logBatchExecuted(batchId, {
      success: prepared.failures.length === 0,
      message: `${prepared.transfers.length} drafted, ${prepared.failures.length} failed to draft`,
    });

    return {
      success: prepared.failures.length === 0,
      batchId,
      batchNumber: batch.batchNumber,
      totalAmount: prepared.totalSourceAmount,
      successCount: prepared.transfers.length,
      failedCount: prepared.failures.length,
      errors: prepared.failures.map(
        (f) => `Commission ${f.commissionId}: ${f.reason}`
      ),
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
      .reduce(
        (sum: number, t: SummaryTransaction) => sum + Number(t.amount),
        0
      );

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
