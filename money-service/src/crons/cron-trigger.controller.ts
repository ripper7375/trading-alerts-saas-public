/**
 * Cron Trigger Controller (Session 4A-2, File 5/6)
 *
 * New glue code (no direct SOURCE — the Vercel routes it replaces WERE the
 * public trigger surface; now that crons run on `@nestjs/schedule`'s own
 * internal timer, these endpoints exist only for manual testing/admin use).
 * Each endpoint calls the exact same `CronsScheduler` method the schedule
 * itself invokes, so a manual trigger and a scheduled firing run identical
 * code. Guarded by `CronSecretGuard` — mirrors the CRON_SECRET protection
 * every source route had; public internet cannot trigger these without it.
 */

import { Controller, Post, UseGuards } from '@nestjs/common';

import { CronSecretGuard } from './cron-secret.guard';
import { CronsScheduler } from './crons.scheduler';

@UseGuards(CronSecretGuard)
@Controller('cron-trigger')
export class CronTriggerController {
  constructor(private readonly scheduler: CronsScheduler) {}

  @Post('check-expiring-subscriptions')
  checkExpiringSubscriptions() {
    return this.scheduler.handleCheckExpiringSubscriptions();
  }

  @Post('daily-maintenance')
  dailyMaintenance() {
    return this.scheduler.handleDailyMaintenance();
  }

  @Post('distribute-codes')
  distributeCodes() {
    return this.scheduler.handleDistributeCodes();
  }

  @Post('downgrade-expired-subscriptions')
  downgradeExpiredSubscriptions() {
    return this.scheduler.handleDowngradeExpiredSubscriptions();
  }

  @Post('expire-codes')
  expireCodes() {
    return this.scheduler.handleExpireCodes();
  }

  @Post('process-pending-disbursements')
  processPendingDisbursements() {
    return this.scheduler.handleProcessPendingDisbursements();
  }

  @Post('send-monthly-reports')
  sendMonthlyReports() {
    return this.scheduler.handleSendMonthlyReports();
  }

  @Post('sync-riseworks-accounts')
  syncRiseWorksAccounts() {
    return this.scheduler.handleSyncRiseWorksAccounts();
  }
}
