import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

import { AlertCheckerService } from './alert-checker.service';

/**
 * Alert Cron Scheduler — periodic poll/check engine.
 *
 * Ported from lib/jobs/queue.ts's setInterval loop (every 60 seconds) to
 * NestJS's `@Interval()` decorator, with the same isRunning concurrency
 * guard preserved exactly.
 *
 * Safety: `@Interval()` fires in EVERY NestJS context that constructs this
 * provider — since AlertEngineModule is registered in the shared
 * app.module.ts (imported by both main.ts's HTTP process and
 * main-worker.ts's worker process, matching this repo's established
 * CronsScheduler convention in money-service, which gates its own @Cron()
 * handlers the same way), an unguarded interval would double-run in both
 * processes. `active` starts false and is flipped true ONLY by
 * main-worker.ts's bootstrap calling `enable()` — the HTTP process never
 * calls it, so its own ticks return immediately, zero real work.
 *
 * @module alert-engine/alert-cron.scheduler
 */
const ALERT_CHECK_INTERVAL_MS = 60 * 1000;

@Injectable()
export class AlertCronScheduler {
  private readonly logger = new Logger(AlertCronScheduler.name);
  private active = false;
  private isRunning = false;
  private lastRun: Date | undefined;

  constructor(private readonly alertChecker: AlertCheckerService) {}

  /** Called once by main-worker.ts after bootstrap. */
  enable(): void {
    this.active = true;
    this.logger.log('alert checker enabled (every 60 seconds)');
  }

  disable(): void {
    this.active = false;
  }

  isEnabled(): boolean {
    return this.active;
  }

  @Interval(ALERT_CHECK_INTERVAL_MS)
  async tick(): Promise<void> {
    if (!this.active) return;
    await this.runAlertChecker();
  }

  /**
   * Run the alert checker with concurrency protection
   */
  private async runAlertChecker(): Promise<void> {
    if (this.isRunning) {
      this.logger.log('Alert checker already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      await this.alertChecker.checkAlerts();
      const duration = Date.now() - startTime;
      this.lastRun = new Date();
      this.logger.log(`Alert check completed in ${duration}ms`);
    } catch (error) {
      this.logger.error('Alert check failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manually trigger an alert check (bypasses the active guard, matching
   * source's own triggerAlertCheck — used for manual testing).
   */
  async triggerAlertCheck(): Promise<void> {
    this.logger.log('Manually triggering alert check');
    await this.runAlertChecker();
  }

  getStatus(): { running: boolean; interval: number; lastRun?: Date } {
    return {
      running: this.isRunning,
      interval: ALERT_CHECK_INTERVAL_MS,
      ...(this.lastRun ? { lastRun: this.lastRun } : {}),
    };
  }
}
