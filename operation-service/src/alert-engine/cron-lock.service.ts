/**
 * Cron Lock (Remediation Tier 2 §6.9)
 *
 * The alert checker ticks every 60 s in every worker process that called
 * AlertCronScheduler.enable(). A rolling deploy (or a second worker replica) has
 * two of them alive at once; both would check the same alerts and both could fire
 * the same alert. `SET key token PX ttl NX` is a one-winner claim on "this check
 * is being run": the winner checks, the other skips this tick.
 *
 * The lock is deliberately NOT released when the check ends. The ttl is just
 * under the tick interval, so across all workers there is about one check per
 * minute, and the lock is free again by the time the next tick is due; releasing
 * it early would let a second worker whose tick is 20 s out of phase check again.
 *
 * Fails open: if Redis cannot be reached the check runs. The alert engine reads
 * prices and queues fires through Redis anyway, and a missed check costs a
 * trader an alert, which is worse than the rare double check.
 */

import { Injectable } from '@nestjs/common';

import { alertEngineLogger } from './alert-engine.logger';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class CronLockService {
  constructor(private readonly redis: RedisService) {}

  /** True when this process won the right to run `jobName` for this tick. */
  async acquire(jobName: string, ttlMs: number): Promise<boolean> {
    try {
      const won = await this.redis
        .getClient()
        .set(
          `alerts:cron-lock:${jobName}`,
          `${process.pid}:${Date.now()}`,
          'PX',
          ttlMs,
          'NX'
        );
      return won === 'OK';
    } catch (error) {
      alertEngineLogger.error(
        {
          jobName,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'cron lock unavailable, running the job without it'
      );
      return true;
    }
  }
}
