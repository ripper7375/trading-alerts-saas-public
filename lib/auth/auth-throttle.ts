import 'server-only';

import { createHash } from 'crypto';
import { isIP } from 'net';

import { getRedisClient } from '@/lib/redis/client';

/**
 * Limits on sign-in, password reset and the two e-mail flows (CODE-01B).
 *
 * Every counter is a Redis `INCR` with a fixed window that starts at its first hit. A request is
 * COUNTED FIRST (`reserve`) and the counter is given back (`release`) or cleared (`clear`) when
 * the request turns out to be no failure. Counting first is what makes the limit hold under a
 * parallel burst: "look, do the work, then record" lets every request of the burst look at a
 * counter that is still zero.
 *
 * operation-service writes the ACCOUNT keys with the same formats, limits and windows
 * (`operation-service/src/auth/auth-throttle.util.ts`), so the credentials provider here and
 * `AuthService` there share one budget per account. The per-address keys live in this stack only:
 * operation-service sees Vercel's address, not the client's (decision D-4). Both stacks have a
 * test that asserts the same literals, so a drift in one fails a test.
 *
 * Redis down: every function FAILS OPEN (decision D-1), a warning and no error, unlike the 2FA
 * steps, which fail closed. The Vercel Firewall rule is the backstop for that case.
 *
 * `lib/rate-limit.ts` is a different tool (a sliding window that counts every request and throws
 * on a Redis outage) and is left alone for the routes that rely on it.
 */

/** Failed passwords per account (and e-mails that do not exist) in one window. */
export const LOGIN_ACCOUNT_LIMIT = 5;
/** Failed passwords per client address, across all accounts, in one window. */
export const LOGIN_IP_LIMIT = 20;
export const LOGIN_WINDOW_SECONDS = 15 * 60;
/** Rejected reset tokens per client address in one window. */
export const RESET_IP_LIMIT = 10;
export const RESET_WINDOW_SECONDS = 15 * 60;
/** Forgot-password and resend-verification requests, per e-mail and per client address. */
export const MAIL_LIMIT = 3;
export const MAIL_WINDOW_SECONDS = 60 * 60;

/** The e-mail part of an account key: no address appears in a Redis key. */
export function emailHash(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

export const throttleKeys = {
  loginAccount: (email: string): string =>
    `authfail:login:acct:${emailHash(email)}`,
  loginIp: (ip: string): string => `authfail:login:ip:${ip}`,
  resetIp: (ip: string): string => `authfail:reset:ip:${ip}`,
  forgotAccount: (email: string): string =>
    `authmail:forgot:acct:${emailHash(email)}`,
  forgotIp: (ip: string): string => `authmail:forgot:ip:${ip}`,
  resendAccount: (email: string): string =>
    `authmail:resend:acct:${emailHash(email)}`,
  resendIp: (ip: string): string => `authmail:resend:ip:${ip}`,
} as const;

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

type HeaderSource =
  | { get(name: string): string | null }
  | Record<string, string | string[] | undefined>;

function readHeader(
  headers: HeaderSource | null | undefined,
  name: string
): string | undefined {
  if (!headers) return undefined;
  if (typeof (headers as { get?: unknown }).get === 'function') {
    return (
      (headers as { get(n: string): string | null }).get(name) ?? undefined
    );
  }
  const value = (headers as Record<string, string | string[] | undefined>)[
    name
  ];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The client's address behind Vercel: `x-real-ip`, else the first `x-forwarded-for` entry. Takes
 * a `Headers` or the plain object NextAuth passes to `authorize()`. Anything that is not an IP
 * address is null (the per-address limits are then skipped, the per-account ones are not).
 */
export function clientIp(
  headers: HeaderSource | null | undefined
): string | null {
  const candidate =
    readHeader(headers, 'x-real-ip')?.trim() ||
    readHeader(headers, 'x-forwarded-for')?.split(',')[0]?.trim();
  return candidate && isIP(candidate) ? candidate : null;
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
export async function reserve(limits: Limit[]): Promise<ThrottleVerdict> {
  if (limits.length === 0) return OPEN;
  try {
    const redis = getRedisClient();
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
export async function release(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    const redis = getRedisClient();
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
export async function clear(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await getRedisClient().del(...keys);
  } catch (error) {
    warnUnavailable('clear', error);
  }
}

export type MailFlow = 'forgot' | 'resend';

/**
 * The limits of one e-mail request. Either part may be left out: the monolith's `token-*` routes
 * pass the address only, because the e-mail address is counted by operation-service behind them
 * (counting it here too would count it twice).
 */
export function mailLimits(
  flow: MailFlow,
  input: { email?: string; ip?: string | null }
): Limit[] {
  const limits: Limit[] = [];
  if (input.email !== undefined) {
    limits.push({
      key:
        flow === 'forgot'
          ? throttleKeys.forgotAccount(input.email)
          : throttleKeys.resendAccount(input.email),
      limit: MAIL_LIMIT,
      windowSeconds: MAIL_WINDOW_SECONDS,
    });
  }
  if (input.ip) {
    limits.push({
      key:
        flow === 'forgot'
          ? throttleKeys.forgotIp(input.ip)
          : throttleKeys.resendIp(input.ip),
      limit: MAIL_LIMIT,
      windowSeconds: MAIL_WINDOW_SECONDS,
    });
  }
  return limits;
}
