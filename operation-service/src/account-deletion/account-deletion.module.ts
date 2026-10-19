import { Module } from '@nestjs/common';

import { CronLockService } from '../alert-engine/cron-lock.service';
import { AccountDeletionScheduler } from './account-deletion.scheduler';
import { AccountDeletionWorker } from './account-deletion.worker';
import { BillingCanceller } from './billing-canceller';
import { StripeBillingCanceller } from './stripe-billing-canceller';

/**
 * The 24 h half of account deletion (F21). PrismaModule/RedisModule are @Global(); ScheduleModule
 * is registered (globally) by AlertEngineModule, which the same app.module.ts loads, so the
 * scheduler's `@Interval()` is discovered without importing it again.
 *
 * Nothing starts from being constructed: only main-worker.ts calls
 * `AccountDeletionScheduler.enable()`, so this module is safe in the shared app.module.ts that
 * both the HTTP process and the worker process load (same rule as AlertEngineModule).
 *
 * BillingCanceller is bound to StripeBillingCanceller (Davin, 2026-10-19: a restricted Stripe key
 * in this service, STRIPE_RESTRICTED_KEY). Without the key, a user who has a Stripe subscription
 * is not completed (the run logs an error and retries); users without one are.
 *
 * @module account-deletion/account-deletion.module
 */
@Module({
  providers: [
    AccountDeletionWorker,
    AccountDeletionScheduler,
    // Its own instance of the Unit 2.9 lock (the class is stateless apart from Redis).
    CronLockService,
    StripeBillingCanceller,
    { provide: BillingCanceller, useExisting: StripeBillingCanceller },
  ],
  exports: [AccountDeletionScheduler, AccountDeletionWorker],
})
export class AccountDeletionModule {}
