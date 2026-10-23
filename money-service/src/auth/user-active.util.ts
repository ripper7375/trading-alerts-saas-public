import { Logger } from '@nestjs/common';

import type { PrismaService } from '../prisma/prisma.service';

/**
 * The state of the account behind a session token, read on every request after the token decodes.
 *
 * Copy of operation-service's `src/auth/user-active.util.ts` (which mirrors the monolith's
 * `lib/auth/user-active.ts`): keep the three in step. The NextAuth access token is a stateless JWE
 * that keeps decoding until it expires and says nothing about the account behind it, so
 * JwtAuthGuard compares it with the user's current row on every request:
 *
 *  - a locked (`isActive = false`) or soft-deleted (`deletedAt`) account is refused,
 *  - `token.sessionVersion` (a missing claim counts as 0, the column default) must equal the row's
 *    `sessionVersion`,
 *  - `role` and `tier` are not compared but REFRESHED from the row: the guard overwrites them on the
 *    request, so AdminGuard and the tier checks see the current values within the cache window,
 *  - an ADMIN session ends 12 hours after sign-in (`token.authTime`),
 *  - CODE-09: `twoFactorEnabled` rides in the same snapshot. It is not part of the session verdict;
 *    only AdminGuard reads it, and refuses an ADMIN whose flag is not true.
 *
 * The row is read once and cached as a snapshot for 30 s per process: one query per user per half
 * minute. Only a snapshot of an active, not deleted account is cached, so a locked account is read
 * again each time.
 *
 * Fails open on a database error (a blip must not sign every user out). A missing row is refused in
 * production only; elsewhere the dev test ids have no row.
 */
const ACTIVE_CACHE_TTL_MS = 30_000;
const ACTIVE_CACHE_MAX_ENTRIES = 10_000;

/** An ADMIN session ends this long after sign-in (D-5). */
export const ADMIN_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export const ACCOUNT_DEACTIVATED_CODE = 'ACCOUNT_DEACTIVATED';
export const SESSION_REVOKED_CODE = 'SESSION_REVOKED';
export const SESSION_EXPIRED_CODE = 'SESSION_EXPIRED';

export interface SessionState {
  isActive: boolean;
  deletedAt: Date | null;
  sessionVersion: number;
  role: string;
  tier: string;
  twoFactorEnabled: boolean;
}

/** The row's state, `'missing'` when there is no such user, `'error'` when the lookup failed. */
export type SessionLookup = SessionState | 'missing' | 'error';

export type SessionVerdict =
  | { ok: true; state: SessionState | null }
  | {
      ok: false;
      code:
        | typeof ACCOUNT_DEACTIVATED_CODE
        | typeof SESSION_REVOKED_CODE
        | typeof SESSION_EXPIRED_CODE;
    };

const SESSION_STATE_SELECT = {
  isActive: true,
  deletedAt: true,
  sessionVersion: true,
  role: true,
  tier: true,
  twoFactorEnabled: true,
} as const;

const logger = new Logger('UserActiveCheck');
const snapshots = new Map<string, { state: SessionState; until: number }>();

export async function getSessionState(
  prisma: Pick<PrismaService, 'user'>,
  userId: string
): Promise<SessionLookup> {
  const now = Date.now();
  const cached = snapshots.get(userId);
  if (cached && cached.until > now) return cached.state;

  let state: SessionState;
  try {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: SESSION_STATE_SELECT,
    });
    if (!row) return 'missing';
    state = {
      isActive: row.isActive,
      deletedAt: row.deletedAt,
      sessionVersion: row.sessionVersion,
      role: row.role,
      tier: row.tier,
      twoFactorEnabled: row.twoFactorEnabled,
    };
  } catch (error) {
    logger.error('session state lookup failed, letting the request through', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return 'error';
  }

  if (!state.isActive || state.deletedAt) {
    snapshots.delete(userId);
    return state;
  }

  if (snapshots.size >= ACTIVE_CACHE_MAX_ENTRIES) {
    for (const [key, entry] of snapshots) {
      if (entry.until <= now) snapshots.delete(key);
    }
    // Still full of live entries: drop the oldest insertion rather than grow without bound.
    if (snapshots.size >= ACTIVE_CACHE_MAX_ENTRIES) {
      const oldest = snapshots.keys().next();
      if (!oldest.done) snapshots.delete(oldest.value);
    }
  }
  snapshots.set(userId, { state, until: now + ACTIVE_CACHE_TTL_MS });
  return state;
}

/**
 * Is this token still the session of its account? Pure: the caller reads the row with
 * `getSessionState` and acts on the verdict (refuse with the code, or take role and tier from
 * `state`).
 */
export function judgeSession(
  claims: { sessionVersion?: unknown; authTime?: unknown },
  lookup: SessionLookup,
  options: { nowMs?: number; production?: boolean } = {}
): SessionVerdict {
  if (lookup === 'error') return { ok: true, state: null };

  if (lookup === 'missing') {
    const production =
      options.production ?? process.env['NODE_ENV'] === 'production';
    return production
      ? { ok: false, code: ACCOUNT_DEACTIVATED_CODE }
      : { ok: true, state: null };
  }

  if (!lookup.isActive || lookup.deletedAt) {
    return { ok: false, code: ACCOUNT_DEACTIVATED_CODE };
  }

  const claimedVersion =
    typeof claims.sessionVersion === 'number' ? claims.sessionVersion : 0;
  if (claimedVersion !== lookup.sessionVersion) {
    return { ok: false, code: SESSION_REVOKED_CODE };
  }

  if (lookup.role === 'ADMIN') {
    const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000);
    const { authTime } = claims;
    if (
      typeof authTime !== 'number' ||
      !Number.isFinite(authTime) ||
      nowSeconds - authTime > ADMIN_SESSION_MAX_AGE_SECONDS
    ) {
      return { ok: false, code: SESSION_EXPIRED_CODE };
    }
  }

  return { ok: true, state: lookup };
}

/** Forget one user's snapshot: the next read goes to the database. */
export function forgetSessionState(userId: string): void {
  snapshots.delete(userId);
}

/** Test seam: forget every cached answer. */
export function clearUserActiveCache(): void {
  snapshots.clear();
}
