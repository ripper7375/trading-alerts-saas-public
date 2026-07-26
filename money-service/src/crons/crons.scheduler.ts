/**
 * Crons Scheduler
 *
 * Ported from the 8 `app/api/cron/<job>/route.ts` handlers + `vercel.json`
 * (Session 4A-2, File 4/6). Replaces Vercel's HTTP-triggered cron routes
 * with NestJS `@Cron()` decorators. UTC expressions are copied verbatim
 * from `vercel.json` — CRITICAL invariant, do not change the timing.
 *
 * `CRON_SECRET` auth is dropped here on purpose: these are internally
 * scheduled jobs, not public HTTP endpoints, so there's no request to
 * authenticate (blueprint §5.2's own porting note: "CRON_SECRET auth
 * becomes unnecessary... but keep the guard for manual triggers" — that
 * guard lives in File 5/6's cron-trigger.controller.ts instead).
 *
 * `check-expiring-subscriptions`, `downgrade-expired-subscriptions`,
 * `distribute-codes`, `process-pending-disbursements`, and
 * `sync-riseworks-accounts` delegate to the services ported in Files 2/6
 * and 3/6. `expire-codes` and `send-monthly-reports` have no dedicated
 * service in source (their logic is inline in the route) and stay inline
 * here too. `daily-maintenance` composes the same three tasks as source
 * but calls the injected SubscriptionCronService methods for tasks 2/3
 * instead of duplicating their logic (per this order's Known Wrinkles).
 */

import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { logger } from '../common/logger.util';
import {
  AutoDisbursementResult,
  AccountSyncResult,
  DisbursementProcessorService,
} from '../disbursement/disbursement-processor.service';
import { PrismaService } from '../prisma/prisma.service';

import {
  AffiliateCronService,
  MonthlyDistributionResult,
} from './affiliate.service';
import {
  CheckExpiringResult,
  DowngradeExpiredResult,
  SubscriptionCronService,
} from './subscription.service';
import {
  ReconciliationResult,
  WiseReconciliationService,
} from './wise-reconciliation.service';

interface MonthlyReportData {
  affiliateId: string;
  email: string;
  month: string;
  codesDistributed: number;
  codesUsed: number;
  commissionsEarned: number;
  balance: number;
}

export interface DailyMaintenanceResult {
  expiredCodes: { count: number };
  expiringSubscriptions: CheckExpiringResult;
  expiredSubscriptions: DowngradeExpiredResult;
}

export interface SendMonthlyReportsResult {
  sent: number;
  totalAffiliates: number;
  errors: string[];
}

export interface ExpireCodesResult {
  count: number;
}

@Injectable()
export class CronsScheduler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionCron: SubscriptionCronService,
    private readonly affiliateCron: AffiliateCronService,
    private readonly disbursementProcessor: DisbursementProcessorService,
    private readonly wiseReconciliation: WiseReconciliationService
  ) {}

  /**
   * Safety toggle (Session 4A-2, added post-CONFIRM at Davin's direction):
   * with `vercel.json`'s crons still active, a live money-service deploy
   * would otherwise fire these jobs on the same schedule against the same
   * production database — a real double-processing risk for
   * process-pending-disbursements specifically. Every scheduled entry
   * point below checks this before running; the underlying `handleX()`
   * methods (used directly by CronTriggerController's manual-trigger
   * endpoints, File 5/6) are NOT gated — manual triggers are how this
   * session's actual shadow-run verification happens (fired once, by
   * hand, after Vercel's own cron completes, to check idempotency).
   */
  private isCronEnabled(): boolean {
    return process.env['CRON_ENABLED'] === 'true';
  }

  /**
   * Ported from lib/cron/monthly-distribution.ts's own private helper... no —
   * this one is send-monthly-reports/route.ts's inline `generateAffiliateReport`.
   */
  private async generateAffiliateReport(
    affiliateId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    codesDistributed: number;
    codesUsed: number;
    commissionsEarned: number;
  }> {
    const codesDistributed = await this.prisma.affiliateCode.count({
      where: {
        affiliateProfileId: affiliateId,
        distributedAt: { gte: startDate, lte: endDate },
      },
    });

    const codesUsed = await this.prisma.affiliateCode.count({
      where: {
        affiliateProfileId: affiliateId,
        usedAt: { gte: startDate, lte: endDate },
      },
    });

    const commissions = await this.prisma.commission.aggregate({
      where: {
        affiliateProfileId: affiliateId,
        earnedAt: { gte: startDate, lte: endDate },
      },
      _sum: { commissionAmount: true },
    });

    const sumResult = commissions['_sum'] as unknown as {
      commissionAmount: number | null;
    };

    return {
      codesDistributed,
      codesUsed,
      commissionsEarned: Number(sumResult.commissionAmount ?? 0),
    };
  }

  /**
   * Job: check-expiring-subscriptions — vercel.json "0 0 * * *"
   */
  async handleCheckExpiringSubscriptions(): Promise<CheckExpiringResult> {
    const result = await this.subscriptionCron.checkExpiringSubscriptions();
    logger.info(
      `[CRON] Found ${result.processed} expiring subscriptions, ${result.reminders.length} reminders marked`
    );
    return result;
  }

  /**
   * Job: daily-maintenance — vercel.json "0 4 * * *". Consolidates code
   * expiry + expiring/downgrade subscription checks, matching source's
   * 3-task sequence.
   */
  async handleDailyMaintenance(): Promise<DailyMaintenanceResult> {
    logger.info('[CRON] Starting daily maintenance...');
    const startTime = Date.now();

    const results: DailyMaintenanceResult = {
      expiredCodes: { count: 0 },
      expiringSubscriptions: { reminders: [], processed: 0, errors: [] },
      expiredSubscriptions: { downgrades: [], processed: 0, errors: [] },
    };

    // Task 1/3: Expire affiliate codes
    try {
      const now = new Date();
      const expireResult = await this.prisma.affiliateCode.updateMany({
        where: { status: 'ACTIVE', expiresAt: { lte: now } },
        data: { status: 'EXPIRED' },
      });
      results.expiredCodes.count = expireResult.count;
      logger.info(`[CRON] Expired ${expireResult.count} affiliate codes`);
    } catch (error) {
      logger.error('[CRON] Error expiring codes:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Task 2/3: Check expiring subscriptions (3-day reminder)
    try {
      results.expiringSubscriptions =
        await this.subscriptionCron.checkExpiringSubscriptions();
      logger.info(
        `[CRON] Found ${results.expiringSubscriptions.processed} expiring, ${results.expiringSubscriptions.reminders.length} reminders marked`
      );
    } catch (error) {
      logger.error('[CRON] Error checking expiring subscriptions:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Task 3/3: Downgrade expired subscriptions
    try {
      results.expiredSubscriptions =
        await this.subscriptionCron.downgradeExpiredSubscriptions();
      logger.info(
        `[CRON] Processed ${results.expiredSubscriptions.processed}, downgraded ${results.expiredSubscriptions.downgrades.length}`
      );
    } catch (error) {
      logger.error('[CRON] Error downgrading subscriptions:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    logger.info(
      `[CRON] Daily maintenance completed in ${Date.now() - startTime}ms`
    );
    return results;
  }

  /**
   * Job: distribute-codes — vercel.json "0 0 1 * *"
   */
  async handleDistributeCodes(): Promise<MonthlyDistributionResult> {
    const result = await this.affiliateCron.runMonthlyDistribution();
    logger.info(`[CRON] Distributed codes to ${result.distributed} affiliates`);
    return result;
  }

  /**
   * Job: downgrade-expired-subscriptions — vercel.json "0 1 * * *"
   */
  async handleDowngradeExpiredSubscriptions(): Promise<DowngradeExpiredResult> {
    const result = await this.subscriptionCron.downgradeExpiredSubscriptions();
    logger.info(`[CRON] Downgraded ${result.downgrades.length} users`);
    return result;
  }

  /**
   * Job: expire-codes — vercel.json "59 23 28-31 * *"
   */
  async handleExpireCodes(): Promise<ExpireCodesResult> {
    console.log('[CRON] Starting code expiry check...');
    const startTime = Date.now();

    const now = new Date();
    const result = await this.prisma.affiliateCode.updateMany({
      where: { status: 'ACTIVE', expiresAt: { lte: now } },
      data: { status: 'EXPIRED' },
    });

    console.log(
      `[CRON] Expired ${result.count} codes in ${Date.now() - startTime}ms`
    );
    return { count: result.count };
  }

  /**
   * Job: process-pending-disbursements — vercel.json "0 2 * * *"
   */
  async handleProcessPendingDisbursements(): Promise<AutoDisbursementResult> {
    console.log('Starting automated disbursement processing...');
    const result =
      await this.disbursementProcessor.processAutomatedDisbursements();
    console.log('Disbursement processing completed:', {
      success: result.success,
      batchesCreated: result.batchesCreated,
      batchesExecuted: result.batchesExecuted,
      affiliatesProcessed: result.affiliatesProcessed,
      totalAmount: result.totalAmount,
      durationMs: result.durationMs,
      errorCount: result.errors.length,
    });
    return result;
  }

  /**
   * Job: send-monthly-reports — vercel.json "0 6 1 * *"
   */
  async handleSendMonthlyReports(): Promise<SendMonthlyReportsResult> {
    console.log('[CRON] Starting monthly report distribution...');
    const startTime = Date.now();

    const now = new Date();
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
      999
    );
    const monthName = startOfPrevMonth.toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    });

    const affiliates = await this.prisma.affiliateProfile.findMany({
      where: { status: 'ACTIVE' },
    });

    // AffiliateProfile no longer carries a `user` relation (Session 2-3 FK
    // audit) — batch-fetch contact users separately by userId.
    const affiliateUsers = await this.prisma.user.findMany({
      where: { id: { in: affiliates.map((a) => a.userId) } },
    });
    const affiliateUserById = new Map(affiliateUsers.map((u) => [u.id, u]));

    if (affiliates.length === 0) {
      console.log('[CRON] No active affiliates found for reports');
      return { sent: 0, totalAffiliates: 0, errors: [] };
    }

    console.log(
      `[CRON] Generating reports for ${affiliates.length} affiliates`
    );

    let sent = 0;
    const errors: string[] = [];
    const reports: MonthlyReportData[] = [];

    for (const affiliate of affiliates) {
      const affiliateUser = affiliateUserById.get(affiliate.userId);
      try {
        const reportData = await this.generateAffiliateReport(
          affiliate.id,
          startOfPrevMonth,
          endOfPrevMonth
        );

        const report: MonthlyReportData = {
          affiliateId: affiliate.id,
          email: affiliateUser?.email ?? '',
          month: monthName,
          codesDistributed: reportData.codesDistributed,
          codesUsed: reportData.codesUsed,
          commissionsEarned: reportData.commissionsEarned,
          balance: Number(affiliate.pendingCommissions),
        };

        reports.push(report);

        // TODO: Send email with monthly-report template

        sent++;
        console.log(
          `[CRON] Generated report for ${affiliateUser?.email ?? 'unknown'}`
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${affiliateUser?.email ?? 'unknown'}: ${errorMessage}`);
        console.error(
          `[CRON] Failed to generate report for ${affiliateUser?.email ?? 'unknown'}:`,
          error
        );
      }
    }

    console.log(`[CRON] Sent ${sent} reports in ${Date.now() - startTime}ms`);
    return { sent, totalAffiliates: affiliates.length, errors };
  }

  /**
   * Job: wise-reconciliation (Session 4A-W6, File 7/8, design §6.5) —
   * hourly. New job, not in `vercel.json`'s original 8 (this whole part of
   * money-service was never a Vercel cron in the first place).
   */
  async handleWiseReconciliation(): Promise<ReconciliationResult> {
    logger.info('[CRON] Starting Wise reconciliation...');
    const result = await this.wiseReconciliation.reconcile();
    logger.info('[CRON] Wise reconciliation completed', {
      transfersChecked: result.transfersChecked,
      transfersFailed: result.transfersFailed,
      fundingSlaBreaches: result.fundingSlaBreaches,
    });
    return result;
  }

  /**
   * Job: sync-riseworks-accounts — vercel.json "0 3 * * *"
   */
  async handleSyncRiseWorksAccounts(): Promise<AccountSyncResult> {
    console.log('Starting RiseWorks account sync...');
    const result = await this.disbursementProcessor.syncRiseWorksAccounts();
    console.log('Account sync completed:', {
      success: result.success,
      accountsSynced: result.accountsSynced,
      accountsUpdated: result.accountsUpdated,
      durationMs: result.durationMs,
      errorCount: result.errors.length,
    });
    return result;
  }

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SCHEDULED ENTRY POINTS — CRON_ENABLED-gated (see isCronEnabled above).
  // These carry the actual @Cron() decorators; the handleX() methods
  // above are the shared logic, called directly (ungated) by
  // CronTriggerController's manual-trigger endpoints.
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  @Cron('0 0 * * *')
  async scheduledCheckExpiringSubscriptions(): Promise<void> {
    if (!this.isCronEnabled()) {
      logger.info(
        '[CRON] Skipped check-expiring-subscriptions — CRON_ENABLED is not "true"'
      );
      return;
    }
    await this.handleCheckExpiringSubscriptions();
  }

  @Cron('0 4 * * *')
  async scheduledDailyMaintenance(): Promise<void> {
    if (!this.isCronEnabled()) {
      logger.info(
        '[CRON] Skipped daily-maintenance — CRON_ENABLED is not "true"'
      );
      return;
    }
    await this.handleDailyMaintenance();
  }

  @Cron('0 0 1 * *')
  async scheduledDistributeCodes(): Promise<void> {
    if (!this.isCronEnabled()) {
      logger.info(
        '[CRON] Skipped distribute-codes — CRON_ENABLED is not "true"'
      );
      return;
    }
    await this.handleDistributeCodes();
  }

  @Cron('0 1 * * *')
  async scheduledDowngradeExpiredSubscriptions(): Promise<void> {
    if (!this.isCronEnabled()) {
      logger.info(
        '[CRON] Skipped downgrade-expired-subscriptions — CRON_ENABLED is not "true"'
      );
      return;
    }
    await this.handleDowngradeExpiredSubscriptions();
  }

  @Cron('59 23 28-31 * *')
  async scheduledExpireCodes(): Promise<void> {
    if (!this.isCronEnabled()) {
      logger.info('[CRON] Skipped expire-codes — CRON_ENABLED is not "true"');
      return;
    }
    await this.handleExpireCodes();
  }

  @Cron('0 2 * * *')
  async scheduledProcessPendingDisbursements(): Promise<void> {
    if (!this.isCronEnabled()) {
      logger.info(
        '[CRON] Skipped process-pending-disbursements — CRON_ENABLED is not "true"'
      );
      return;
    }
    await this.handleProcessPendingDisbursements();
  }

  @Cron('0 6 1 * *')
  async scheduledSendMonthlyReports(): Promise<void> {
    if (!this.isCronEnabled()) {
      logger.info(
        '[CRON] Skipped send-monthly-reports — CRON_ENABLED is not "true"'
      );
      return;
    }
    await this.handleSendMonthlyReports();
  }

  @Cron('0 3 * * *')
  async scheduledSyncRiseWorksAccounts(): Promise<void> {
    if (!this.isCronEnabled()) {
      logger.info(
        '[CRON] Skipped sync-riseworks-accounts — CRON_ENABLED is not "true"'
      );
      return;
    }
    await this.handleSyncRiseWorksAccounts();
  }

  @Cron('0 * * * *')
  async scheduledWiseReconciliation(): Promise<void> {
    if (!this.isCronEnabled()) {
      logger.info(
        '[CRON] Skipped wise-reconciliation — CRON_ENABLED is not "true"'
      );
      return;
    }
    await this.handleWiseReconciliation();
  }
}
