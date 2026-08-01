/**
 * Idempotency Store (Session 4A-8, Step 1; refactored Session 4B-4 Step 2 to
 * share money-service's global RedisService instead of a dedicated
 * connection — each of the 4 consuming modules (admin/disbursement/dlocal/
 * stripe) previously constructed its own separate IdempotencyStore, so this
 * also collapses 4 separate Redis connections into the one shared client).
 *
 * Redis-backed storage for IdempotencyInterceptor. Uses the same shared
 * Railway Redis instance as the rest of money-service (F15), under the
 * `money:idempotency:` namespace so its keys never collide with the
 * throttler's or BullMQ's. The prefix used to be applied by ioredis's own
 * client-level `keyPrefix` option on a dedicated connection; now applied
 * manually per key, since the shared RedisService's client carries no
 * built-in prefix (it's used by CacheService and others with their own
 * namespacing).
 *
 * Not yet wired to any live route -- built ready for 4A-9's write-route
 * cutover (money-service has no write endpoints of its own yet; Stripe/
 * dLocal write paths stay on monolith Next.js routes until then, see
 * lib/idempotency/idempotency-guard.ts for THIS session's actual fix on
 * those live routes).
 */

import { Injectable } from '@nestjs/common';

import { RedisService } from '../../redis/redis.service';
import { MONEY_KEY_PREFIX } from '../../queue/queue.constants';

/** 24h, matching this order's own Step 1 spec ("standard TTL"). */
export const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

const IN_PROGRESS_MARKER = '__IN_PROGRESS__';
const KEY_PREFIX = `${MONEY_KEY_PREFIX}idempotency:`;

export interface IdempotencyRecord {
  statusCode: number;
  body: unknown;
}

@Injectable()
export class IdempotencyStore {
  constructor(private readonly redisService: RedisService) {}

  private prefixed(key: string): string {
    return `${KEY_PREFIX}${key}`;
  }

  /**
   * Atomically claims `key` for a new in-flight request. Returns `true`
   * when this call is the first to see the key (caller should proceed and
   * eventually `save()` or `release()`); `false` when another request
   * already holds it (cached or still in flight).
   */
  async claim(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redisService
      .getClient()
      .set(this.prefixed(key), IN_PROGRESS_MARKER, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  /**
   * Reads the current state of `key`: `null` if never seen, `'IN_PROGRESS'`
   * if claimed but not yet resolved, or the cached response record.
   */
  async get(key: string): Promise<IdempotencyRecord | 'IN_PROGRESS' | null> {
    const raw = await this.redisService.getClient().get(this.prefixed(key));
    if (raw === null) {
      return null;
    }
    if (raw === IN_PROGRESS_MARKER) {
      return 'IN_PROGRESS';
    }
    return JSON.parse(raw) as IdempotencyRecord;
  }

  /** Persists the final response so future duplicates get the cached result instead of re-executing. */
  async save(
    key: string,
    record: IdempotencyRecord,
    ttlSeconds: number
  ): Promise<void> {
    await this.redisService
      .getClient()
      .set(this.prefixed(key), JSON.stringify(record), 'EX', ttlSeconds);
  }

  /** Releases a claim without caching a result -- used when the underlying request failed, so a genuine retry isn't stuck behind a stale in-progress marker. */
  async release(key: string): Promise<void> {
    await this.redisService.getClient().del(this.prefixed(key));
  }
}
