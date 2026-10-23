import 'server-only';

import { randomUUID } from 'crypto';

import jwt from 'jsonwebtoken';

import { getRedisClient } from '@/lib/redis/client';

/**
 * The two-stage tokens of a 2FA sign-in (CODE-01A).
 *
 * 1. CHALLENGE (`2fa_challenge`, 5 minutes): the password was right and a code is due. It proves
 *    nothing else; no session can be made from it.
 * 2. COMPLETION (`2fa_verified`, 60 seconds, one use): the code was right. Only the verify step
 *    mints it, only the completion step (`authorize()` here, `AuthService.login()` in
 *    operation-service) accepts it, and each completion works once.
 *
 * operation-service has the same contract in `operation-service/src/auth/two-factor-token.util.ts`:
 * a challenge minted by one stack is checked by the other, against ONE Redis, so the purposes, the
 * issuer, the lifetimes and the key formats below must not drift. Both stacks have a test that
 * asserts the same literals.
 *
 * Redis down: the code and completion steps fail CLOSED (`TwoFactorUnavailableError`, decision
 * D-1); the callers answer 503 or refuse the sign-in.
 */

export const TWO_FACTOR_CHALLENGE = '2fa_challenge';
export const TWO_FACTOR_VERIFIED = '2fa_verified';
export const TWO_FACTOR_ISSUER = 'davintrade-2fa';

export const CHALLENGE_TTL_SECONDS = 300;
export const COMPLETION_TTL_SECONDS = 60;
/** How long the attempt counter of one challenge lives: as long as the challenge. */
export const ATTEMPTS_KEY_TTL_SECONDS = 300;
/** How long a spent challenge stays marked: past its own lifetime. */
export const CHALLENGE_USED_TTL_SECONDS = 300;
/** How long a spent completion stays marked: past its own lifetime and any clock skew. */
export const COMPLETION_USED_TTL_SECONDS = 120;
/** A TOTP code is valid for about 90 seconds across the window either side. */
export const TOTP_REPLAY_TTL_SECONDS = 90;
/** Wrong or right, the 6th code presented against one challenge burns it. */
export const MAX_CODE_ATTEMPTS = 5;

export const twoFactorKeys = {
  attempts: (challengeJti: string): string => `2fa:attempts:${challengeJti}`,
  used: (jti: string): string => `2fa:used:${jti}`,
  totp: (userId: string, code: string): string => `2fa:totp:${userId}:${code}`,
} as const;

export type TwoFactorPurpose =
  | typeof TWO_FACTOR_CHALLENGE
  | typeof TWO_FACTOR_VERIFIED;

export interface TwoFactorTokenClaims {
  userId: string;
  /** Set on a challenge. */
  email?: string;
  jti: string;
  /** Set on a completion: the jti of the challenge it completes. */
  chal?: string;
}

/** Redis could not answer; the 2FA state is unknown, so the step must not go ahead. */
export class TwoFactorUnavailableError extends Error {
  readonly reason: unknown;

  constructor(reason?: unknown) {
    super('Two-factor state is unavailable');
    this.name = 'TwoFactorUnavailableError';
    this.reason = reason;
  }
}

function getSecret(): string {
  const secret = process.env['NEXTAUTH_SECRET'];
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET not configured');
  }
  return secret;
}

export function signChallenge(input: {
  userId: string;
  email: string;
}): string {
  return jwt.sign(
    { purpose: TWO_FACTOR_CHALLENGE, email: input.email, jti: randomUUID() },
    getSecret(),
    {
      algorithm: 'HS256',
      expiresIn: CHALLENGE_TTL_SECONDS,
      issuer: TWO_FACTOR_ISSUER,
      subject: input.userId,
    }
  );
}

export function signCompletion(input: {
  userId: string;
  challengeJti: string;
}): string {
  return jwt.sign(
    {
      purpose: TWO_FACTOR_VERIFIED,
      chal: input.challengeJti,
      jti: randomUUID(),
    },
    getSecret(),
    {
      algorithm: 'HS256',
      expiresIn: COMPLETION_TTL_SECONDS,
      issuer: TWO_FACTOR_ISSUER,
      subject: input.userId,
    }
  );
}

/**
 * The claims of a token of the expected purpose. Throws for anything else: another purpose
 * (including the `2fa_verification` of an earlier version), another secret, issuer or algorithm, an expired
 * token, no `jti`, no `sub`.
 */
export function verifyTwoFactorToken(
  token: string,
  expectedPurpose: TwoFactorPurpose
): TwoFactorTokenClaims {
  const decoded = jwt.verify(token, getSecret(), {
    algorithms: ['HS256'],
    issuer: TWO_FACTOR_ISSUER,
  });
  if (typeof decoded === 'string') {
    throw new Error('Invalid two-factor token');
  }

  const { purpose, jti, sub, email, chal } = decoded as {
    purpose?: unknown;
    jti?: unknown;
    sub?: unknown;
    email?: unknown;
    chal?: unknown;
  };
  if (
    purpose !== expectedPurpose ||
    typeof jti !== 'string' ||
    jti === '' ||
    typeof sub !== 'string' ||
    sub === ''
  ) {
    throw new Error('Invalid two-factor token');
  }

  return {
    userId: sub,
    jti,
    ...(typeof email === 'string' ? { email } : {}),
    ...(typeof chal === 'string' ? { chal } : {}),
  };
}

async function withRedis<T>(
  run: (redis: ReturnType<typeof getRedisClient>) => Promise<T>
): Promise<T> {
  try {
    return await run(getRedisClient());
  } catch (error) {
    throw new TwoFactorUnavailableError(error);
  }
}

/** True for the first caller of a key, false for every later one (`SET ... NX`). */
export function consumeOnce(
  key: string,
  ttlSeconds: number = CHALLENGE_USED_TTL_SECONDS
): Promise<boolean> {
  return withRedis(
    async (redis) =>
      (await redis.set(key, '1', 'EX', ttlSeconds, 'NX')) === 'OK'
  );
}

export function isConsumed(key: string): Promise<boolean> {
  return withRedis(async (redis) => (await redis.exists(key)) === 1);
}

/** Counts one code attempt against a challenge; returns the count including this one. */
export function registerAttempt(challengeJti: string): Promise<number> {
  return withRedis(async (redis) => {
    const key = twoFactorKeys.attempts(challengeJti);
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, ATTEMPTS_KEY_TTL_SECONDS);
    }
    return count;
  });
}
