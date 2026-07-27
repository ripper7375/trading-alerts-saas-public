/**
 * Idempotency Guard (Session 4A-8)
 *
 * Redis SET-NX-EX lock for collapsing duplicate write-path submissions
 * (double-click, browser/network retry) into a single side effect. Mirrors
 * lib/rate-limit.ts's own Redis usage and fail-open convention -- a dedupe
 * guard must never be the reason a legitimate payment/admin action can't
 * go through, so a Redis error is treated as "not a duplicate" rather than
 * blocking the request.
 *
 * Scope note: this is a short debounce window, not a full 24h
 * request/response cache -- that fuller pattern is the NestJS
 * IdempotencyInterceptor being built in money-service
 * (money-service/src/common/idempotency/idempotency.interceptor.ts) for
 * 4A-9's write-route cutover. Here, only the FIRST attempt's side effect
 * matters (create the payment / distribute the codes); a genuine retry
 * minutes later after the window expires is a new, legitimate request.
 */

import { getRedisClient } from '@/lib/redis/client';

/** 30s: enough to absorb a double-click or client retry burst without blocking a deliberate follow-up action. */
export const DEFAULT_IDEMPOTENCY_TTL_SECONDS = 30;

/**
 * Attempts to acquire a one-time lock for `key`. Returns `true` the first
 * time a given key is seen within the TTL window (caller should proceed),
 * `false` on every duplicate within that window (caller should treat this
 * as a repeat of an in-flight/just-completed request).
 */
export async function acquireIdempotencyLock(
  key: string,
  ttlSeconds: number = DEFAULT_IDEMPOTENCY_TTL_SECONDS
): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch (error) {
    console.error(
      '[Idempotency] Redis lock check failed, failing open (treating as non-duplicate):',
      error instanceof Error ? error.message : error
    );
    return true;
  }
}
