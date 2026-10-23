import { ACCOUNT_DEACTIVATED_CODE } from '@/lib/account/deletion';
import { prisma } from '@/lib/db/prisma';

/**
 * The state of the account behind a session token, read on every session after sign-in.
 *
 * The NextAuth session is a stateless JWT (7 days): it decodes the same whether the account behind
 * it has changed or not. The `jwt` callback of `authOptions` therefore compares the token with the
 * user's current row on every session read, and throws when the session must end, which NextAuth
 * turns into "no session" and a cleared cookie. operation-service and money-service do the same for
 * their bearer tokens (`operation-service/src/auth/user-active.util.ts`,
 * `money-service/src/auth/user-active.util.ts`: keep the three in step).
 *
 *  - F21: an account that confirmed a deletion is locked (`isActive = false`), later soft-deleted
 *    (`deletedAt`): its sessions end.
 *  - CODE-02A: `token.sessionVersion` (a missing claim counts as 0, the column default) must equal
 *    the row's `sessionVersion`; a security change raises the row's, which ends every older session.
 *  - `role` and `tier` are not compared but REFRESHED from the row into the token, so a demotion or a
 *    PRO expiry takes effect within the cache window without ending the session.
 *  - An ADMIN session ends 12 hours after sign-in (`token.authTime`, set by the `jwt` callback).
 *
 * The row is read once and cached as a snapshot for 30 s per server instance: one query per user per
 * half minute (the Prisma pool is small), and a change is felt within 30 s. Only a snapshot of an
 * active, not deleted account is cached, so a locked account is read again each time and a cancelled
 * deletion lets the user back in at once. `forgetSessionState` drops one user (the writers that raise
 * the version call it).
 *
 * Fails open on a database error: signing in needs the database anyway, and a blip must not sign
 * every user out. A missing row ends the session in production only; elsewhere it stays open for the
 * dev test accounts whose id is made up when the upsert fails.
 */
const ACTIVE_CACHE_TTL_MS = 30_000;
const ACTIVE_CACHE_MAX_ENTRIES = 10_000;

/** An ADMIN session ends this long after sign-in (D-5). */
export const ADMIN_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export const SESSION_REVOKED_CODE = 'SESSION_REVOKED';
export const SESSION_EXPIRED_CODE = 'SESSION_EXPIRED';

export interface SessionState {
  isActive: boolean;
  deletedAt: Date | null;
  sessionVersion: number;
  role: string;
  tier: string;
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
} as const;

const snapshots = new Map<string, { state: SessionState; until: number }>();

export async function getSessionState(userId: string): Promise<SessionLookup> {
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
    };
  } catch (error) {
    console.error(
      '[Auth] session state lookup failed, letting the session through:',
      error instanceof Error ? error.message : 'Unknown error'
    );
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
 * `getSessionState` and acts on the verdict (throw the code, and refresh role and tier from `state`).
 */
export function judgeSession(
  claims: { sessionVersion?: unknown; authTime?: unknown },
  lookup: SessionLookup,
  options: { nowMs?: number; production?: boolean } = {}
): SessionVerdict {
  if (lookup === 'error') return { ok: true, state: null };

  if (lookup === 'missing') {
    const production =
      options.production ??
      Reflect.get(process.env, 'NODE_ENV') === 'production';
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

/**
 * Is this user still allowed in at all? (F21.) The answer of `getSessionState` reduced to a yes or
 * no for a caller that has no token to compare: false only for a locked or deleted account.
 */
export async function isUserActive(userId: string): Promise<boolean> {
  const lookup = await getSessionState(userId);
  if (lookup === 'missing' || lookup === 'error') return true;
  return lookup.isActive && !lookup.deletedAt;
}

/** Forget one user's snapshot: the next read goes to the database. */
export function forgetSessionState(userId: string): void {
  snapshots.delete(userId);
}

/** Test seam: forget every cached answer. */
export function clearUserActiveCache(): void {
  snapshots.clear();
}
