/**
 * Cron Lock (Remediation Tier 2 §6.9)
 *
 * A cron instant fires in EVERY process that has the scheduler enabled. During
 * a Railway rolling deploy the old and the new instance both run with
 * CRON_ENABLED=true for a while, so at 00:00 both would start the same job: two
 * downgrade passes, two payout runs. CRON_ENABLED on a single instance is the
 * primary guard; this is the second line, for the overlap.
 *
 * `SET key token PX ttl NX` is a one-winner claim on "this job is being run for
 * this firing". The winner runs the job; the other instance, firing within
 * seconds, loses and skips. The lock is deliberately NOT released when the job
 * ends: a loser that fires a few seconds late would otherwise find it free and run
 * the job a second time. It expires on its own, long before the next firing
 * (the most frequent job is hourly).
 *
 * Fails open: if Redis cannot be reached the job runs. The lock stops a
 * double run; it must not be the reason the nightly downgrade never happens.
 */

import { Injectable } from '@nestjs/common';

import { logger } from '../common/logger.util';
import { MONEY_KEY_PREFIX } from '../queue/queue.constants';
import { RedisService } from '../redis/redis.service';

/** Covers two instances firing the same cron seconds apart; far below the hourly minimum between firings. */
export const CRON_LOCK_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class CronLockService {
  constructor(private readonly redis: RedisService) {}

  /** True when this process won the right to run `jobName` for this firing. */
  async acquire(
    jobName: string,
    ttlMs: number = CRON_LOCK_TTL_MS
  ): Promise<boolean> {
    try {
      const won = await this.redis
        .getClient()
        .set(
          `${MONEY_KEY_PREFIX}cron-lock:${jobName}`,
          `${process.pid}:${Date.now()}`,
          'PX',
          ttlMs,
          'NX'
        );
      return won === 'OK';
    } catch (error) {
      logger.error('[CRON] Lock unavailable, running the job without it', {
        jobName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return true;
    }
  }
}
