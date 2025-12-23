/**
 * Disbursement Processor (Part 19C)
 *
 * Business logic for automated cron jobs.
 * Handles automated disbursement processing and account syncing.
 */

import { PrismaClient } from '@prisma/client';
import { CommissionAggregator } from '../services/commission-aggregator';
import { BatchManager } from '../services/batch-manager';
import { PaymentOrchestrator } from '../services/payment-orchestrator';
import { createPaymentProvider } from '../providers/provider-factory';
import { TransactionLogger } from '../services/transaction-logger';
import { getDefaultProvider } from '../constants';
import type { DisbursementProvider } from '@/types/disbursement';

export interface AutoDisbursementResult {
  success: boolean;
  batchesCreated: number;
  batchesExecuted: number;
  totalAmount: number;
  affiliatesProcessed: number;
  errors: string[];
  startTime: Date;
  endTime: Date;
  durationMs: number;
}

export interface AccountSyncResult {
  success: boolean;
  accountsSynced: number;
  accountsUpdated: number;
  errors: string[];
  startTime: Date;
  endTime: Date;
  durationMs: number;
}

/**
 * Disbursement processor for automated cron operations
 */
export class DisbursementProcessor {
  private readonly logger: TransactionLogger;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = new TransactionLogger(prisma);
  }

  /**
   * Process automated disbursements (idempotent)
   * Safe to run multiple times - will only process eligible commissions
   *
   * @returns Processing result
   */
  async processAutomatedDisbursements(): Promise<AutoDisbursementResult> {
    const startTime = new Date();
    const errors: string[] = [];
    let batchesCreated = 0;
    let batchesExecuted = 0;
    let totalAmount = 0;
    let affiliatesProcessed = 0;

    try {
      // Log start of automated processing
      await this.logger.log({
        action: 'cron.disbursement_start',
        status: 'INFO',
        details: { startTime: startTime.toISOString() },
      });

      // Get all payable affiliates
      const aggregator = new CommissionAggregator(this.prisma);
      const aggregates = await aggregator.getAllPayableAffiliates();

      if (aggregates.length === 0) {
        await this.logger.log({
          action: 'cron.disbursement_complete',
          status: 'SUCCESS',
          details: { message: 'No payable affiliates found' },
        });

        const endTime = new Date();
        return {
          success: true,
          batchesCreated: 0,
          batchesExecuted: 0,
          totalAmount: 0,
          affiliatesProcessed: 0,
          errors: [],
          startTime,
          endTime,
          durationMs: endTime.getTime() - startTime.getTime(),
        };
      }

      affiliatesProcessed = aggregates.length;

      // Get provider
      const providerType = getDefaultProvider();

      // Create batch
      const batchManager = new BatchManager(this.prisma);
      const batch = await batchManager.createBatch(
        aggregates,
        providerType,
        'CRON_JOB'
      );
      batchesCreated++;

      // Execute batch
      try {
        const paymentProvider = createPaymentProvider(providerType);
        const orchestrator = new PaymentOrchestrator(
          this.prisma,
          paymentProvider
        );
        const result = await orchestrator.executeBatch(batch.id);

        if (result.success) {
          batchesExecuted++;
          totalAmount = result.totalAmount;
        } else {
          errors.push(...result.errors);
        }
      } catch (execError) {
        const errorMessage =
          execError instanceof Error
            ? execError.message
            : 'Batch execution failed';
        errors.push(errorMessage);

        await this.logger.log({
          action: 'cron.batch_execution_failed',
          status: 'FAILURE',
          batchId: batch.id,
          details: { error: errorMessage },
        });
      }

      // Log completion
      await this.logger.log({
        action: 'cron.disbursement_complete',
        status: errors.length === 0 ? 'SUCCESS' : 'WARNING',
        details: {
          batchesCreated,
          batchesExecuted,
          totalAmount,
          affiliatesProcessed,
          errorCount: errors.length,
        },
      });

      const endTime = new Date();
      return {
        success: errors.length === 0,
        batchesCreated,
        batchesExecuted,
        totalAmount,
        affiliatesProcessed,
        errors,
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);

      await this.logger.log({
        action: 'cron.disbursement_error',
        status: 'FAILURE',
        details: { error: errorMessage },
      });

      const endTime = new Date();
      return {
        success: false,
        batchesCreated,
        batchesExecuted,
        totalAmount,
        affiliatesProcessed,
        errors,
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
      };
    }
  }

  /**
   * Sync RiseWorks accounts (idempotent)
   * Updates local account data from RiseWorks API
   *
   * @returns Sync result
   */
  async syncRiseWorksAccounts(): Promise<AccountSyncResult> {
    const startTime = new Date();
    const errors: string[] = [];
    let accountsSynced = 0;
    let accountsUpdated = 0;

    try {
      // Log start
      await this.logger.log({
        action: 'cron.account_sync_start',
        status: 'INFO',
        details: { startTime: startTime.toISOString() },
      });

      // Get all Rise accounts
      const accounts = await this.prisma.affiliateRiseAccount.findMany({
        where: {
          riseId: { not: null },
        },
      });

      accountsSynced = accounts.length;

      for (const account of accounts) {
        try {
          // In production, this would call RiseWorks API to get current status
          // For now, we just update the sync timestamp
          // Example API call (when RISE provider is implemented):
          // const riseData = await riseProvider.getPayeeInfo(account.riseId);

          await this.prisma.affiliateRiseAccount.update({
            where: { id: account.id },
            data: {
              lastSyncAt: new Date(),
              // In production, would also update:
              // kycStatus: riseData.kycStatus,
              // etc.
            },
          });

          accountsUpdated++;
        } catch (accountError) {
          const errorMsg =
            accountError instanceof Error
              ? accountError.message
              : 'Account sync failed';
          errors.push(`Account ${account.id}: ${errorMsg}`);
        }
      }

      // Log completion
      await this.logger.log({
        action: 'cron.account_sync_complete',
        status: errors.length === 0 ? 'SUCCESS' : 'WARNING',
        details: {
          accountsSynced,
          accountsUpdated,
          errorCount: errors.length,
        },
      });

      const endTime = new Date();
      return {
        success: errors.length === 0,
        accountsSynced,
        accountsUpdated,
        errors,
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);

      await this.logger.log({
        action: 'cron.account_sync_error',
        status: 'FAILURE',
        details: { error: errorMessage },
      });

      const endTime = new Date();
      return {
        success: false,
        accountsSynced,
        accountsUpdated,
        errors,
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
      };
    }
  }

  /**
   * Retry failed transactions from pending batches
   *
   * @returns Number of transactions retried
   */
  async retryFailedTransactions(): Promise<{
    retriedCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let retriedCount = 0;

    try {
      // Find batches with failed transactions that can be retried
      const batchesWithFailures = await this.prisma.paymentBatch.findMany({
        where: {
          status: { in: ['FAILED', 'PENDING'] },
          transactions: {
            some: {
              status: 'FAILED',
              retryCount: { lt: 3 }, // Max retry count from config
            },
          },
        },
        select: { id: true },
      });

      for (const batch of batchesWithFailures) {
        try {
          const provider = createPaymentProvider();
          const orchestrator = new PaymentOrchestrator(this.prisma, provider);
          const retried = await orchestrator.retryFailedTransactions(batch.id);
          retriedCount += retried;
        } catch (retryError) {
          errors.push(
            `Batch ${batch.id}: ${retryError instanceof Error ? retryError.message : 'Retry failed'}`
          );
        }
      }

      return { retriedCount, errors };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      return { retriedCount, errors };
    }
  }
}
