/**
 * Idempotency Store (Session 4A-8, Step 1)
 *
 * Redis-backed storage for IdempotencyInterceptor. Uses the same shared
 * Railway Redis instance as the rest of money-service (F15), under the
 * `money:idempotency:` namespace via MONEY_KEY_PREFIX so its keys never
 * collide with the throttler's or BullMQ's.
 *
 * Not yet wired to any live route -- built ready for 4A-9's write-route
 * cutover (money-service has no write endpoints of its own yet; Stripe/
 * dLocal write paths stay on monolith Next.js routes until then, see
 * lib/idempotency/idempotency-guard.ts for THIS session's actual fix on
 * those live routes).
 */

import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

import { MONEY_KEY_PREFIX } from '../../queue/queue.constants';

/** 24h, matching this order's own Step 1 spec ("standard TTL"). */
export const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

const IN_PROGRESS_MARKER = '__IN_PROGRESS__';

export interface IdempotencyRecord {
  statusCode: number;
  body: unknown;
}

@Injectable()
export class IdempotencyStore {
  private redis: Redis | null = null;

  private getRedis(): Redis {
    if (!this.redis) {
      this.redis = new Redis(
        process.env['REDIS_URL'] ?? 'redis://localhost:6379',
        { keyPrefix: `${MONEY_KEY_PREFIX}idempotency:` }
      );
    }
    return this.redis;
  }

  /**
   * Atomically claims `key` for a new in-flight request. Returns `true`
   * when this call is the first to see the key (caller should proceed and
   * eventually `save()` or `release()`); `false` when another request
   * already holds it (cached or still in flight).
   */
  async claim(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.getRedis().set(
      key,
      IN_PROGRESS_MARKER,
      'EX',
      ttlSeconds,
      'NX'
    );
    return result === 'OK';
  }

  /**
   * Reads the current state of `key`: `null` if never seen, `'IN_PROGRESS'`
   * if claimed but not yet resolved, or the cached response record.
   */
  async get(key: string): Promise<IdempotencyRecord | 'IN_PROGRESS' | null> {
    const raw = await this.getRedis().get(key);
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
    await this.getRedis().set(key, JSON.stringify(record), 'EX', ttlSeconds);
  }

  /** Releases a claim without caching a result -- used when the underlying request failed, so a genuine retry isn't stuck behind a stale in-progress marker. */
  async release(key: string): Promise<void> {
    await this.getRedis().del(key);
  }
}
