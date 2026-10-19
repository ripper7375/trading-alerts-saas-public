import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

import { CronLockService } from '../alert-engine/cron-lock.service';
import { DELETION_WORKER_INTERVAL_MS } from './account-deletion.constants';
import { AccountDeletionWorker } from './account-deletion.worker';

/**
 * How long a process's claim on a tick lasts. Just under the interval, so the claim has lapsed
 * when the next tick is due, and so two workers ticking out of phase (a rolling deploy, a second
 * replica) still make about one run per interval between them. Same shape as the alert checker's
 * lock (Remediation Tier 2 section 6.9 / Unit 2.9): `SET key token PX ttl NX`, one winner.
 */
const DELETION_LOCK_TTL_MS = DELETION_WORKER_INTERVAL_MS - 10 * 1000;

/**
 * Runs AccountDeletionWorker every few minutes (F21).
 *
 * Gated exactly like AlertCronScheduler: `@Interval()` fires in every Nest context that builds
 * this provider, and AccountDeletionModule sits in the shared app.module.ts that both the HTTP
 * process and the worker process load. `active` starts false and only main-worker.ts's bootstrap
 * flips it with `enable()`, so the HTTP process's ticks return at once and nothing runs twice.
 *
 * The worker is idempotent and claims each request before it acts, so a lock that fails open
 * (Redis unreachable, see CronLockService) can at worst make two runs overlap, not delete twice.
 *
 * @module account-deletion/account-deletion.scheduler
 */
@Injectable()
export class AccountDeletionScheduler {
  private readonly logger = new Logger(AccountDeletionScheduler.name);
  private active = false;
  private isRunning = false;

  constructor(
    private readonly worker: AccountDeletionWorker,
    private readonly cronLock: CronLockService
  ) {}

  /** Called once by main-worker.ts after bootstrap. */
  enable(): void {
    this.active = true;
    this.logger.log(
      `account deletion worker enabled (every ${DELETION_WORKER_INTERVAL_MS / 1000} seconds)`
    );
  }

  disable(): void {
    this.active = false;
  }

  isEnabled(): boolean {
    return this.active;
  }

  @Interval(DELETION_WORKER_INTERVAL_MS)
  async tick(): Promise<void> {
    if (!this.active) return;
    if (
      !(await this.cronLock.acquire('account-deletion', DELETION_LOCK_TTL_MS))
    ) {
      this.logger.log('Account deletion already taken by another worker');
      return;
    }
    await this.run();
  }

  /** One run with the in-process overlap guard. Also the manual entry point for tests. */
  async run(): Promise<void> {
    if (this.isRunning) {
      this.logger.log('Account deletion run already in progress, skipping');
      return;
    }
    this.isRunning = true;
    try {
      await this.worker.processDueRequests();
    } catch (error) {
      // processDueRequests isolates each request; this is the search itself failing.
      this.logger.error('Account deletion run failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      this.isRunning = false;
    }
  }
}
