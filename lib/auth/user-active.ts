import { headers } from 'next/headers';

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
 *  - CODE-09: `twoFactorEnabled` rides in the same snapshot. It is not part of the session verdict (an
 *    admin without two-factor authentication must still be able to sign in and switch it on); only
 *    `requireAdmin()` and `requireAdminPage()` read it, and refuse an ADMIN whose flag is not true.
 *    money-service's `AdminGuard` does the same from its own copy of this module.
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
 *
 * CODE-02C: a second, per-device snapshot. Every sign-in writes a `UserSession` row and puts its id
 * on the token as `sid`; `getDeviceSessionState` reads that row (cached 30 s per `sid`, active rows
 * only) and `judgeDeviceSession` ends the session when the row is revoked, gone or somebody else's.
 * "Gone" counts as revoked on purpose: a purge of revoked rows must not bring their tokens back. A
 * token without `sid` (minted before the deploy, or when the row could not be written) is judged by
 * the account's `sessionVersion` alone; a database error lets the token through, as above.
 * `revokeSession` calls `forgetDeviceSession`, so the instance that revoked a device refuses it at once.
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

const snapshots = new Map<string, { state: SessionState; until: number }>();

/** Add to a snapshot map, dropping expired entries (then the oldest) once it is full. */
function remember<T extends { until: number }>(
  map: Map<string, T>,
  key: string,
  entry: T,
  now: number
): void {
  if (map.size >= ACTIVE_CACHE_MAX_ENTRIES) {
    for (const [existing, held] of map) {
      if (held.until <= now) map.delete(existing);
    }
    // Still full of live entries: drop the oldest insertion rather than grow without bound.
    if (map.size >= ACTIVE_CACHE_MAX_ENTRIES) {
      const oldest = map.keys().next();
      if (!oldest.done) map.delete(oldest.value);
    }
  }
  map.set(key, entry);
}

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
      twoFactorEnabled: row.twoFactorEnabled,
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

  remember(snapshots, userId, { state, until: now + ACTIVE_CACHE_TTL_MS }, now);
  return state;
}

export interface DeviceSessionState {
  isActive: boolean;
}

/** The device row's state, `'missing'` when there is no such row (for this user), `'error'` when the lookup failed. */
export type DeviceSessionLookup = DeviceSessionState | 'missing' | 'error';

export type DeviceSessionVerdict =
  | { ok: true }
  | { ok: false; code: typeof SESSION_REVOKED_CODE };

/** The active device rows seen in the last 30 s, by `sid`; a revoked row is never held. */
const deviceSnapshots = new Map<string, { userId: string; until: number }>();

export async function getDeviceSessionState(
  userId: string,
  sid: string
): Promise<DeviceSessionLookup> {
  const now = Date.now();
  const cached = deviceSnapshots.get(sid);
  if (cached && cached.until > now && cached.userId === userId) {
    return { isActive: true };
  }

  let row: { userId: string; isActive: boolean } | null;
  try {
    row = await prisma.userSession.findUnique({
      where: { id: sid },
      select: { userId: true, isActive: true },
    });
  } catch (error) {
    console.error(
      '[Auth] device session lookup failed, letting the session through:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return 'error';
  }

  // A row of somebody else is no row of this user's: the token names a device it cannot own.
  if (!row || row.userId !== userId) {
    deviceSnapshots.delete(sid);
    return 'missing';
  }
  if (!row.isActive) {
    deviceSnapshots.delete(sid);
    return { isActive: false };
  }

  remember(
    deviceSnapshots,
    sid,
    { userId, until: now + ACTIVE_CACHE_TTL_MS },
    now
  );
  return { isActive: true };
}

/**
 * Is the device this token was minted for still signed in? (CODE-02C.) Pure, like `judgeSession`:
 * the caller reads the row with `getDeviceSessionState` and throws the code. A token with no `sid`
 * has no device to check.
 */
export function judgeDeviceSession(
  claims: { sid?: unknown },
  lookup: DeviceSessionLookup
): DeviceSessionVerdict {
  if (typeof claims.sid !== 'string' || claims.sid === '') return { ok: true };
  if (lookup === 'error') return { ok: true };
  if (lookup === 'missing' || !lookup.isActive) {
    return { ok: false, code: SESSION_REVOKED_CODE };
  }
  return { ok: true };
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

/** Forget one device's snapshot: the next read of its `sid` goes to the database. */
export function forgetDeviceSession(sid: string): void {
  deviceSnapshots.delete(sid);
}

/** How long a device row is kept after it was written or last tracked (30 days). */
export const DEVICE_SESSION_ROW_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** User agent and address of the request being served, or `null` outside a request. */
async function readRequestMeta(): Promise<{
  userAgent: string;
  ipAddress: string;
} | null> {
  try {
    const requestHeaders = await headers();
    return {
      userAgent: requestHeaders.get('user-agent') || '',
      ipAddress:
        requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        requestHeaders.get('x-real-ip') ||
        'Unknown',
    };
  } catch {
    return null;
  }
}

/**
 * Start the device session of a sign-in (CODE-02C): one `UserSession` row, whose id the `jwt`
 * callback puts on the token as `sid`. Revoking the row ends the token (see above).
 *
 * The row holds no session token: the cookie rotates and is a credential, the `sid` is not. The
 * device details come from the request being served (the raw user agent and address; the sessions
 * list names the device from them); outside a request, or when it cannot be read, the row is
 * written without them and `trackSession` fills them in when the device lists its sessions.
 *
 * Lives here, not in `session-tracker.ts`, because `auth-options.ts` already imports this module:
 * the tracker carries English display strings that the translation-coverage scan of the compulsory
 * pages would otherwise reach through `auth-options.ts`.
 *
 * @param userId - The user who signed in
 * @returns The new row's id (the `sid`)
 */
export async function startSession(userId: string): Promise<string> {
  const meta = await readRequestMeta();

  const session = await prisma.userSession.create({
    data: {
      userId,
      userAgent: meta?.userAgent ?? null,
      ipAddress: meta?.ipAddress ?? null,
      expiresAt: new Date(Date.now() + DEVICE_SESSION_ROW_TTL_MS),
    },
    select: { id: true },
  });

  return session.id;
}

/**
 * End the device of a session that signed out by itself (CODE-02C). The row is revoked like
 * `revokeSession` does for "log out this device", so the sessions list does not keep a device that
 * is gone, and a copy of its cookie stops working too. Only the user's own row is touched.
 *
 * @param sessionId - The `sid` of the token that signed out
 * @param userId - The user the token belongs to
 */
export async function endSession(
  sessionId: string,
  userId: string
): Promise<void> {
  await prisma.userSession.updateMany({
    where: { id: sessionId, userId },
    data: { isActive: false },
  });
  forgetDeviceSession(sessionId);
}

/** Test seam: forget every cached answer. */
export function clearUserActiveCache(): void {
  snapshots.clear();
  deviceSnapshots.clear();
}
