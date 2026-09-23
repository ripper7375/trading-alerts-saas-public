/**
 * Disbursement Processor (Part 19C)
 *
 * Ported from lib/disbursement/cron/disbursement-processor.ts (Session
 * 4A-2, File 3/6). Business logic for automated cron jobs. Handles
 * automated disbursement processing and account syncing.
 *
 * `CommissionAggregatorService`/`BatchManagerService`/
 * `PaymentOrchestratorService`/`TransactionLoggerService` are now
 * constructor-injected instead of `new`-ed per call (source instantiated
 * `new CommissionAggregator(this.prisma)` etc. inline) — same reasoning as
 * `PaymentOrchestratorService`'s own Deviation note: these need to be real
 * Nest providers for the DI graph to resolve, not a behavior change.
 */

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { WisePaymentProvider } from '../wise/providers/wise-payment.provider';

import { BatchManagerService } from './batch-manager.service';
import { CommissionAggregatorService } from './commission-aggregator.service';
import { getDefaultProvider } from './disbursement.constants';
import { DisbursementSettingsService } from './disbursement-settings.service';
import { PaymentOrchestratorService } from './payment-orchestrator.service';
import { createPaymentProvider } from './providers/provider-factory';
import { TransactionLoggerService } from './transaction-logger.service';

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
@Injectable()
export class DisbursementProcessorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: TransactionLoggerService,
    private readonly commissionAggregator: CommissionAggregatorService,
    private readonly batchManager: BatchManagerService,
    private readonly paymentOrchestrator: PaymentOrchestratorService,
    private readonly wisePaymentProvider: WisePaymentProvider,
    private readonly settings: DisbursementSettingsService
  ) {}

  /**
   * Auto-approve PENDING commissions whose refund window has passed.
   *
   * The window (in days) is the admin-editable `commissionApprovalDays`
   * setting (SystemConfig key `affiliate_commission_approval_days`, default
   * 14, bounds 0–90), read through `DisbursementSettingsService` — the single
   * reader for that key (spec E3, DECISION-LOG F83). Idempotent: approved
   * commissions are skipped. Runs daily as its own job
   * (`approve-matured-commissions`, F84) and as Step 0 of the monthly payout
   * run.
   *
   * @param approvalDays Window to use; resolved from settings when omitted
   * @returns Number of commissions transitioned PENDING -> APPROVED
   */
  async approveMaturedCommissions(approvalDays?: number): Promise<number> {
    const windowDays =
      approvalDays ?? (await this.settings.get()).commissionApprovalDays;

    const maturityDate = new Date(
      Date.now() - windowDays * 24 * 60 * 60 * 1000
    );

    const result = await this.prisma.commission.updateMany({
      where: {
        status: 'PENDING',
        earnedAt: { lte: maturityDate },
      },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Process automated disbursements (idempotent)
   * Safe to run multiple times - will only process eligible commissions
   *
   * Payout settings (DECISION-LOG F83) are read once, first:
   * - Step 0 (commission approval) still runs while payouts are paused (D5);
   * - paused (DB `disbursement_enabled=false` or this service's env
   *   `DISBURSEMENT_ENABLED=false`) -> logs `cron.disbursement_skipped` and
   *   returns success with 0 batches (E1);
   * - payable affiliates are split into batches of at most `maxBatchSize`,
   *   each created and executed in turn, results summed (E2).
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

      const settings = await this.settings.get();

      // Step 0: Auto-approve matured PENDING commissions (refund window passed)
      const approvedCount = await this.approveMaturedCommissions(
        settings.commissionApprovalDays
      );
      if (approvedCount > 0) {
        await this.logger.log({
          action: 'cron.commissions_auto_approved',
          status: 'SUCCESS',
          details: { approvedCount },
        });
      }

      // E1: payouts paused -> approval only, pay nothing
      if (!settings.effectiveEnabled) {
        await this.logger.log({
          action: 'cron.disbursement_skipped',
          status: 'INFO',
          details: {
            reason: settings.envKillSwitch ? 'env_kill_switch' : 'db_disabled',
          },
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

      // Get provider (fetched before aggregation -- 4A-W7: WISE needs its
      // own AffiliateWiseRecipient-aware aggregation, not the generic query)
      const providerType = getDefaultProvider();

      // Get all payable affiliates, eligibility-filtered per provider
      const aggregates =
        await this.commissionAggregator.getAllPayableAffiliatesForProvider(
          providerType,
          settings.minimumPayoutUsd
        );

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

      // E2: one batch per chunk of at most maxBatchSize affiliates
      const chunks = this.batchManager.splitIntoBatches(
        aggregates,
        settings.maxBatchSize
      );

      for (const chunk of chunks) {
        // Create batch (a creation failure aborts the remaining chunks via
        // the outer catch -- conservative for money movement)
        const batch = await this.batchManager.createBatch(
          chunk,
          providerType,
          'CRON_JOB'
        );
        batchesCreated++;

        // Execute batch
        try {
          const paymentProvider = createPaymentProvider(
            providerType,
            providerType === 'WISE'
              ? { wiseProvider: this.wisePaymentProvider }
              : undefined
          );
          const result = await this.paymentOrchestrator.executeBatch(
            batch.id,
            paymentProvider
          );

          if (result.success) {
            batchesExecuted++;
            totalAmount += result.totalAmount;
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

      // Get all Rise accounts (riseId is a required field, so all records have one)
      const accounts = await this.prisma.affiliateRiseAccount.findMany();

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
          const retried =
            await this.paymentOrchestrator.retryFailedTransactions(batch.id);
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
