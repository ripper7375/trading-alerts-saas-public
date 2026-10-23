import { createHash } from 'crypto';

import type Redis from 'ioredis';

/**
 * Limits on sign-in and the two e-mail flows, the ACCOUNT half (CODE-01B).
 *
 * The monolith has the same contract in `lib/auth/auth-throttle.ts`: its credentials provider and
 * this service write the SAME account keys with the same limits and windows, so one budget covers
 * both ways in (decision D-4). The per-address keys live in the monolith only: this service sees
 * Vercel's address for calls the monolith proxies, not the client's. Both stacks have a test that
 * asserts the same literals, so a drift in one fails a test.
 *
 * Every counter is a Redis `INCR` with a fixed window that starts at its first hit. A request is
 * COUNTED FIRST (`reserve`) and the counter is cleared (`clear`) or given back (`release`) when
 * the request turns out to be no failure, so the limit holds under a parallel burst.
 *
 * Redis down: every function FAILS OPEN (decision D-1), a warning and no error, unlike the 2FA
 * steps, which fail closed.
 */

/** Failed passwords per account (and e-mails that do not exist) in one window. */
export const LOGIN_ACCOUNT_LIMIT = 5;
export const LOGIN_WINDOW_SECONDS = 15 * 60;
/** Forgot-password and resend-verification requests per e-mail in one window. */
export const MAIL_LIMIT = 3;
export const MAIL_WINDOW_SECONDS = 60 * 60;

/** The e-mail part of an account key: no address appears in a Redis key. */
export function emailHash(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

export const throttleKeys = {
  loginAccount: (email: string): string =>
    `authfail:login:acct:${emailHash(email)}`,
  forgotAccount: (email: string): string =>
    `authmail:forgot:acct:${emailHash(email)}`,
  resendAccount: (email: string): string =>
    `authmail:resend:acct:${emailHash(email)}`,
} as const;

export type ThrottleRedis = Pick<
  Redis,
  'incr' | 'decr' | 'ttl' | 'expire' | 'del'
>;

export interface Limit {
  key: string;
  /** Requests allowed in one window; the next one is refused. */
  limit: number;
  windowSeconds: number;
}

export interface ThrottleVerdict {
  blocked: boolean;
  /** Seconds until the window of the longest-blocking counter ends; 0 when not blocked. */
  retryAfterSeconds: number;
}

const OPEN: ThrottleVerdict = { blocked: false, retryAfterSeconds: 0 };

function warnUnavailable(action: string, error: unknown): void {
  console.warn(
    `[AuthThrottle] Redis unavailable during ${action}; limits not enforced:`,
    error instanceof Error ? error.message : String(error)
  );
}

/**
 * Counts one request against every limit and says whether any is over. The counter is raised
 * even for a refused request (a refused attempt does not extend the window). A counter that has
 * no lifetime (a lost EXPIRE) is given one, so a blip cannot lock an account for good.
 */
export async function reserve(
  redis: ThrottleRedis,
  limits: Limit[]
): Promise<ThrottleVerdict> {
  if (limits.length === 0) return OPEN;
  try {
    const counted = await Promise.all(
      limits.map(async ({ key, limit, windowSeconds }) => {
        const count = await redis.incr(key);
        let ttl = await redis.ttl(key);
        if (ttl < 0) {
          await redis.expire(key, windowSeconds);
          ttl = windowSeconds;
        }
        return { blocked: count > limit, ttl };
      })
    );
    const blocked = counted.filter((c) => c.blocked);
    if (blocked.length === 0) return OPEN;
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, ...blocked.map((c) => c.ttl)),
    };
  } catch (error) {
    warnUnavailable('reserve', error);
    return OPEN;
  }
}

/** Gives one reservation back (the request was no failure); never below zero. */
export async function release(
  redis: ThrottleRedis,
  keys: string[]
): Promise<void> {
  if (keys.length === 0) return;
  try {
    await Promise.all(
      keys.map(async (key) => {
        if ((await redis.decr(key)) <= 0) await redis.del(key);
      })
    );
  } catch (error) {
    warnUnavailable('release', error);
  }
}

/** Forgets the counters (a right password ends the account's run of failures). */
export async function clear(
  redis: ThrottleRedis,
  keys: string[]
): Promise<void> {
  if (keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch (error) {
    warnUnavailable('clear', error);
  }
}
