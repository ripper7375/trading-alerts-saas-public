/**
 * @jest-environment node
 */
/**
 * CODE-02A (WS-4): a NextAuth session is a stateless JWT, so it decodes the same whether the
 * account behind it changed or not. Every session read now compares the token with the user's
 * current row (cached 30 s per instance):
 *
 *  - the account must still be active and not deleted,
 *  - `token.sessionVersion` (a missing claim counts as 0) must equal the row's `sessionVersion`,
 *  - `role` and `tier` are REFRESHED from the row into the token (a demotion and a PRO expiry take
 *    effect within 30 s), never compared,
 *  - an ADMIN session ends 12 hours after sign-in (`authTime`),
 *  - a database error lets the session through, a missing row ends it in production only.
 *
 * The first block tests the state module on its own, the second the real `jwt` callback, the third
 * the real callbacks behind `requireAdmin()` / `requireAdminPage()`.
 */

const mockFindUnique = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
  },
}));

const mockGetServerSession = jest.fn();
// jest.config.js maps `next-auth` and every `next-auth/*` import to ONE stub, so this is also the module
// `next-auth/providers/credentials` resolves to: its default export is the provider factory, and the
// options are kept so a test could reach `authorize`.
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
  default: (options: { id: string }) => ({ id: options.id, options }),
}));

const mockRedirect = jest.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
jest.mock('next/navigation', () => ({
  __esModule: true,
  redirect: (url: string) => mockRedirect(url),
}));

import { AuthError } from '@/lib/auth/errors';
import { authOptions } from '@/lib/auth/auth-options';
import { requireAdmin, requireAdminPage } from '@/lib/auth/session';
import {
  clearUserActiveCache,
  forgetSessionState,
  getSessionState,
  judgeSession,
} from '@/lib/auth/user-active';

type EnvKey = 'NODE_ENV' | 'VERCEL_ENV';
const savedEnv = new Map<EnvKey, string | undefined>();

function setEnv(key: EnvKey, value: string | undefined): void {
  if (!savedEnv.has(key)) savedEnv.set(key, process.env[key]);
  if (value === undefined) Reflect.deleteProperty(process.env, key);
  else Reflect.set(process.env, key, value);
}

/** What the database holds for one user. Missing keys are columns the select did not ask for. */
const db: { row: Record<string, unknown> | null; failWith: Error | null } = {
  row: null,
  failWith: null,
};

function userRow(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: 'user-1',
    isActive: true,
    deletedAt: null,
    sessionVersion: 0,
    role: 'USER',
    tier: 'FREE',
    twoFactorEnabled: false,
    ...overrides,
  };
}

const HOUR = 3600;
const nowSec = (): number => Math.floor(Date.now() / 1000);

async function runJwt(
  token: Record<string, unknown>,
  user?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const callback = authOptions.callbacks?.jwt;
  if (!callback) throw new Error('jwt callback missing');
  return (await callback({
    token,
    user,
    trigger: undefined,
  } as never)) as never;
}

beforeEach(() => {
  mockFindUnique.mockReset();
  mockGetServerSession.mockReset();
  mockRedirect.mockClear();
  db.row = userRow();
  db.failWith = null;
  // Like the real client: only the selected columns come back.
  mockFindUnique.mockImplementation(
    async (args: { select: Record<string, boolean> }) => {
      if (db.failWith) throw db.failWith;
      if (!db.row) return null;
      return Object.fromEntries(
        Object.entries(args.select)
          .filter(([, wanted]) => wanted)
          .map(([column]) => [column, db.row![column]])
      );
    }
  );
  clearUserActiveCache();
  setEnv('NODE_ENV', 'test');
  setEnv('VERCEL_ENV', undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  for (const [key, value] of savedEnv) setEnv(key, value);
  savedEnv.clear();
});

describe('getSessionState', () => {
  it('reads exactly the six columns the checks need', async () => {
    await getSessionState('user-1');

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: {
        isActive: true,
        deletedAt: true,
        sessionVersion: true,
        role: true,
        tier: true,
        twoFactorEnabled: true,
      },
    });
  });

  it('returns the snapshot of an active user', async () => {
    db.row = userRow({
      sessionVersion: 4,
      role: 'ADMIN',
      tier: 'PRO',
      twoFactorEnabled: true,
    });

    await expect(getSessionState('user-1')).resolves.toEqual({
      isActive: true,
      deletedAt: null,
      sessionVersion: 4,
      role: 'ADMIN',
      tier: 'PRO',
      twoFactorEnabled: true,
    });
  });

  it('carries a false twoFactorEnabled as false, never as a missing value', async () => {
    db.row = userRow({ role: 'ADMIN', twoFactorEnabled: false });

    await expect(getSessionState('user-1')).resolves.toMatchObject({
      twoFactorEnabled: false,
    });
  });

  it('asks the database once per user inside the 30 s window, and again after it', async () => {
    jest.useFakeTimers({ now: 1_000_000 });

    await getSessionState('user-1');
    jest.setSystemTime(1_000_000 + 29_000);
    await getSessionState('user-1');
    expect(mockFindUnique).toHaveBeenCalledTimes(1);

    jest.setSystemTime(1_000_000 + 31_000);
    await getSessionState('user-1');
    expect(mockFindUnique).toHaveBeenCalledTimes(2);
  });

  it('never caches an inactive or a deleted account, so a lifted lock works at once', async () => {
    db.row = userRow({ isActive: false });
    await expect(getSessionState('user-1')).resolves.toMatchObject({
      isActive: false,
    });
    await getSessionState('user-1');
    expect(mockFindUnique).toHaveBeenCalledTimes(2);

    mockFindUnique.mockClear();
    db.row = userRow({ deletedAt: new Date('2026-10-01') });
    await getSessionState('user-1');
    await getSessionState('user-1');
    expect(mockFindUnique).toHaveBeenCalledTimes(2);
  });

  it("answers 'missing' for a user with no row and 'error' when the lookup throws", async () => {
    db.row = null;
    await expect(getSessionState('ghost')).resolves.toBe('missing');

    db.failWith = new Error('connection reset');
    await expect(getSessionState('user-1')).resolves.toBe('error');
  });

  it('forgetSessionState drops one user from the cache and leaves the others', async () => {
    await getSessionState('user-1');
    await getSessionState('user-2');
    mockFindUnique.mockClear();

    forgetSessionState('user-1');
    await getSessionState('user-1');
    await getSessionState('user-2');

    expect(mockFindUnique).toHaveBeenCalledTimes(1);
  });
});

describe('judgeSession', () => {
  const state = (overrides: Record<string, unknown> = {}) => ({
    isActive: true,
    deletedAt: null,
    sessionVersion: 0,
    role: 'USER',
    tier: 'FREE',
    twoFactorEnabled: false,
    ...overrides,
  });

  it('accepts a token without a sessionVersion claim when the row is still at 0', () => {
    expect(judgeSession({}, state())).toEqual({ ok: true, state: state() });
  });

  it('refuses a token whose version differs, in either direction', () => {
    expect(
      judgeSession({ sessionVersion: 0 }, state({ sessionVersion: 1 }))
    ).toEqual({ ok: false, code: 'SESSION_REVOKED' });
    expect(
      judgeSession({ sessionVersion: 3 }, state({ sessionVersion: 2 }))
    ).toEqual({ ok: false, code: 'SESSION_REVOKED' });
  });

  it('refuses a token that has no claim once the row has moved on from 0', () => {
    expect(judgeSession({}, state({ sessionVersion: 1 }))).toEqual({
      ok: false,
      code: 'SESSION_REVOKED',
    });
  });

  it('refuses an inactive or a deleted account before it looks at the version', () => {
    const inactive = judgeSession(
      { sessionVersion: 9 },
      state({ isActive: false })
    );
    const deleted = judgeSession({}, state({ deletedAt: new Date() }));

    expect(inactive).toEqual({ ok: false, code: 'ACCOUNT_DEACTIVATED' });
    expect(deleted).toEqual({ ok: false, code: 'ACCOUNT_DEACTIVATED' });
  });

  it('hands back the row so the caller refreshes role and tier', () => {
    const verdict = judgeSession(
      {},
      state({ role: 'ADMIN', tier: 'PRO', sessionVersion: 0 }),
      {
        nowMs: 1_000_000_000,
      }
    );
    // An ADMIN needs an authTime: this one has none, so it is expired.
    expect(verdict).toEqual({ ok: false, code: 'SESSION_EXPIRED' });

    const user = judgeSession({}, state({ role: 'USER', tier: 'PRO' }));
    expect(user).toMatchObject({
      ok: true,
      state: { role: 'USER', tier: 'PRO' },
    });
  });

  it('ends an ADMIN session 12 hours after authTime, and only an ADMIN session', () => {
    const nowMs = 2_000_000_000_000;
    const at = (hoursAgo: number): number =>
      Math.floor(nowMs / 1000) - Math.round(hoursAgo * HOUR);
    const admin = state({ role: 'ADMIN' });

    expect(
      judgeSession({ authTime: at(11.9) }, admin, { nowMs })
    ).toMatchObject({
      ok: true,
    });
    expect(judgeSession({ authTime: at(12.1) }, admin, { nowMs })).toEqual({
      ok: false,
      code: 'SESSION_EXPIRED',
    });
    expect(
      judgeSession({ authTime: at(13) }, state(), { nowMs })
    ).toMatchObject({
      ok: true,
    });
  });

  it('treats an authTime that is not a finite number as missing', () => {
    const admin = state({ role: 'ADMIN' });
    const nowMs = 2_000_000_000_000;

    for (const authTime of ['yesterday', NaN, Infinity, null, {}]) {
      expect(judgeSession({ authTime }, admin, { nowMs })).toEqual({
        ok: false,
        code: 'SESSION_EXPIRED',
      });
    }
  });

  it("lets the session through on 'error' (a blip must not sign everyone out)", () => {
    expect(
      judgeSession({ sessionVersion: 7 }, 'error', { production: true })
    ).toEqual({ ok: true, state: null });
  });

  it("ends the session on 'missing' in production only", () => {
    expect(judgeSession({}, 'missing', { production: true })).toEqual({
      ok: false,
      code: 'ACCOUNT_DEACTIVATED',
    });
    expect(judgeSession({}, 'missing', { production: false })).toEqual({
      ok: true,
      state: null,
    });
  });
});

describe('the jwt callback on a session read', () => {
  const token = (extra: Record<string, unknown> = {}) => ({
    id: 'user-1',
    email: 'alice@example.com',
    role: 'USER',
    tier: 'FREE',
    isAffiliate: false,
    ...extra,
  });

  it('refuses a token whose sessionVersion is behind the database (SESSION_REVOKED)', async () => {
    db.row = userRow({ sessionVersion: 1 });

    await expect(runJwt(token({ sessionVersion: 0 }))).rejects.toThrow(
      'SESSION_REVOKED'
    );
  });

  it('accepts a token that has no sessionVersion claim while the row is still 0', async () => {
    db.row = userRow({ sessionVersion: 0 });

    await expect(runJwt(token())).resolves.toMatchObject({ id: 'user-1' });
  });

  it('accepts a token whose version matches a bumped row', async () => {
    db.row = userRow({ sessionVersion: 2 });

    await expect(runJwt(token({ sessionVersion: 2 }))).resolves.toMatchObject({
      id: 'user-1',
    });
  });

  it('still refuses a deactivated account with the same code as before', async () => {
    db.row = userRow({ isActive: false });

    await expect(runJwt(token())).rejects.toThrow('ACCOUNT_DEACTIVATED');
  });

  it('refuses a soft-deleted account', async () => {
    db.row = userRow({ deletedAt: new Date('2026-10-01') });

    await expect(runJwt(token())).rejects.toThrow('ACCOUNT_DEACTIVATED');
  });

  it('refreshes role and tier from the database into the token, in both directions', async () => {
    db.row = userRow({ role: 'USER', tier: 'PRO' });
    const demoted = await runJwt(
      token({ role: 'ADMIN', tier: 'FREE', authTime: nowSec() })
    );
    expect(demoted).toMatchObject({ role: 'USER', tier: 'PRO' });

    clearUserActiveCache();
    db.row = userRow({ role: 'USER', tier: 'FREE' });
    const expired = await runJwt(token({ role: 'USER', tier: 'PRO' }));
    expect(expired).toMatchObject({ tier: 'FREE' });
  });

  it('ends an ADMIN session 13 hours after sign-in, and keeps a USER session of the same age', async () => {
    db.row = userRow({ role: 'ADMIN' });
    await expect(
      runJwt(token({ role: 'ADMIN', authTime: nowSec() - 13 * HOUR }))
    ).rejects.toThrow('SESSION_EXPIRED');

    clearUserActiveCache();
    db.row = userRow({ role: 'USER' });
    await expect(
      runJwt(token({ authTime: nowSec() - 13 * HOUR }))
    ).resolves.toMatchObject({ id: 'user-1' });
  });

  it('keeps an ADMIN session that is 11 hours old, and ends one with no authTime at all', async () => {
    db.row = userRow({ role: 'ADMIN' });
    await expect(
      runJwt(token({ role: 'ADMIN', authTime: nowSec() - 11 * HOUR }))
    ).resolves.toMatchObject({ role: 'ADMIN' });

    clearUserActiveCache();
    await expect(runJwt(token({ role: 'ADMIN' }))).rejects.toThrow(
      'SESSION_EXPIRED'
    );
  });

  it('treats a user promoted to ADMIN as an ADMIN session with no authTime: sign in again', async () => {
    db.row = userRow({ role: 'ADMIN' });

    await expect(runJwt(token({ role: 'USER' }))).rejects.toThrow(
      'SESSION_EXPIRED'
    );
  });

  it('lets the session through when the lookup fails (D-7), even in production', async () => {
    setEnv('NODE_ENV', 'production');
    db.failWith = new Error('connection reset');

    await expect(runJwt(token({ sessionVersion: 5 }))).resolves.toMatchObject({
      id: 'user-1',
    });
  });

  it('ends a session whose row is missing in production (D-7)', async () => {
    setEnv('NODE_ENV', 'production');
    db.row = null;

    await expect(runJwt(token())).rejects.toThrow('ACCOUNT_DEACTIVATED');
  });

  it('keeps a session whose row is missing outside production (the made-up dev test ids)', async () => {
    db.row = null;

    await expect(
      runJwt({ id: 'test-user-free-test-trading-alerts-test' })
    ).resolves.toMatchObject({ id: 'test-user-free-test-trading-alerts-test' });
  });

  describe('at sign-in', () => {
    it('stamps the database sessionVersion and the sign-in time on the token', async () => {
      db.row = userRow({
        email: 'alice@example.com',
        name: 'Alice',
        image: null,
        isAffiliate: false,
        sessionVersion: 3,
      });
      const before = nowSec();

      const signedIn = await runJwt(
        {},
        { id: 'user-1', email: 'alice@example.com' }
      );

      expect(signedIn.sessionVersion).toBe(3);
      expect(signedIn.authTime).toBeGreaterThanOrEqual(before);
      expect(signedIn.authTime).toBeLessThanOrEqual(nowSec());
    });

    it('stamps authTime even when the row cannot be found, and leaves the version to count as 0', async () => {
      db.row = null;

      const signedIn = await runJwt({}, { id: 'dev-user', email: 'a@b.test' });

      expect(signedIn.authTime).toEqual(expect.any(Number));
      expect(signedIn.sessionVersion).toBeUndefined();
    });
  });
});

describe('the session options', () => {
  it('lasts 7 days and is renewed once a day while active (D-5)', () => {
    expect(authOptions.session).toEqual({
      strategy: 'jwt',
      maxAge: 7 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    });
  });
});

describe('a demoted admin behind requireAdmin() and requireAdminPage()', () => {
  /** What NextAuth's getServerSession does: the jwt callback, then the session callback. */
  function serveCookieToken(cookieToken: Record<string, unknown>): void {
    mockGetServerSession.mockImplementation(async () => {
      let token: Record<string, unknown>;
      try {
        token = await runJwt({ ...cookieToken });
      } catch {
        return null;
      }
      const callback = authOptions.callbacks?.session;
      if (!callback) throw new Error('session callback missing');
      return callback({
        session: { user: { email: token['email'] }, expires: '2099-01-01' },
        token,
      } as never);
    });
  }

  const adminCookie = (): Record<string, unknown> => ({
    id: 'admin-1',
    email: 'admin@example.com',
    role: 'ADMIN',
    tier: 'PRO',
    isAffiliate: false,
    authTime: nowSec(),
  });

  it('is refused by requireAdmin() once the 30 s cache window has passed', async () => {
    jest.useFakeTimers({ now: Date.now() });
    db.row = userRow({
      id: 'admin-1',
      role: 'ADMIN',
      tier: 'PRO',
      twoFactorEnabled: true,
    });
    serveCookieToken(adminCookie());

    await expect(requireAdmin()).resolves.toMatchObject({
      user: { role: 'ADMIN' },
    });

    // The demotion lands in the database. The cached answer is still ADMIN inside the window.
    db.row = userRow({ id: 'admin-1', role: 'USER', tier: 'PRO' });
    await expect(requireAdmin()).resolves.toMatchObject({
      user: { role: 'ADMIN' },
    });

    jest.setSystemTime(Date.now() + 31_000);
    const refused = requireAdmin();
    await expect(refused).rejects.toBeInstanceOf(AuthError);
    await expect(refused).rejects.toMatchObject({
      code: 'ADMIN_REQUIRED',
      statusCode: 403,
    });
  });

  it('is sent to the dashboard by requireAdminPage() after the window', async () => {
    jest.useFakeTimers({ now: Date.now() });
    db.row = userRow({ id: 'admin-1', role: 'USER', tier: 'PRO' });
    serveCookieToken(adminCookie());

    // First read: the snapshot is fresh, so the token's role is already USER.
    await expect(requireAdminPage()).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard?error=forbidden'
    );
  });

  it('no longer reaches the page once the session itself was revoked (version bumped)', async () => {
    db.row = userRow({
      id: 'admin-1',
      role: 'ADMIN',
      sessionVersion: 1,
      twoFactorEnabled: true,
    });
    serveCookieToken({ ...adminCookie(), sessionVersion: 0 });

    await expect(requireAdminPage()).rejects.toThrow('NEXT_REDIRECT:/login');
  });
});

describe('an admin without two-factor authentication behind the real callbacks (CODE-09)', () => {
  function serveAdminCookie(): void {
    mockGetServerSession.mockImplementation(async () => {
      const token = await runJwt({
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'ADMIN',
        tier: 'PRO',
        isAffiliate: false,
        authTime: nowSec(),
      });
      const callback = authOptions.callbacks?.session;
      if (!callback) throw new Error('session callback missing');
      return callback({
        session: { user: { email: token['email'] }, expires: '2099-01-01' },
        token,
      } as never);
    });
  }

  it('is refused by requireAdmin() with ADMIN_2FA_REQUIRED, and still signs in', async () => {
    db.row = userRow({ id: 'admin-1', role: 'ADMIN', twoFactorEnabled: false });
    serveAdminCookie();

    // The session itself is alive: the admin must be able to reach /settings/security.
    await expect(mockGetServerSession()).resolves.toMatchObject({
      user: { role: 'ADMIN' },
    });

    const refused = requireAdmin();
    await expect(refused).rejects.toBeInstanceOf(AuthError);
    await expect(refused).rejects.toMatchObject({
      code: 'ADMIN_2FA_REQUIRED',
      statusCode: 403,
    });
  });

  it('is sent to /settings/security by requireAdminPage()', async () => {
    db.row = userRow({ id: 'admin-1', role: 'ADMIN', twoFactorEnabled: false });
    serveAdminCookie();

    await expect(requireAdminPage()).rejects.toThrow(
      'NEXT_REDIRECT:/settings/security'
    );
  });

  it('is let in within 30 s of switching two-factor authentication on, and refused again within 30 s of switching it off', async () => {
    jest.useFakeTimers({ now: Date.now() });
    db.row = userRow({ id: 'admin-1', role: 'ADMIN', twoFactorEnabled: false });
    serveAdminCookie();
    await expect(requireAdmin()).rejects.toMatchObject({
      code: 'ADMIN_2FA_REQUIRED',
    });

    db.row = userRow({ id: 'admin-1', role: 'ADMIN', twoFactorEnabled: true });
    forgetSessionState('admin-1');
    await expect(requireAdmin()).resolves.toMatchObject({
      user: { role: 'ADMIN' },
    });

    db.row = userRow({ id: 'admin-1', role: 'ADMIN', twoFactorEnabled: false });
    jest.setSystemTime(Date.now() + 31_000);
    await expect(requireAdmin()).rejects.toMatchObject({
      code: 'ADMIN_2FA_REQUIRED',
    });
  });

  it('does not touch a USER: no two-factor requirement for anyone but an ADMIN', async () => {
    db.row = userRow({ id: 'user-1', role: 'USER', twoFactorEnabled: false });
    mockGetServerSession.mockImplementation(async () => {
      const token = await runJwt({
        id: 'user-1',
        email: 'alice@example.com',
        role: 'USER',
        tier: 'FREE',
        isAffiliate: false,
      });
      const callback = authOptions.callbacks?.session;
      if (!callback) throw new Error('session callback missing');
      return callback({
        session: { user: { email: token['email'] }, expires: '2099-01-01' },
        token,
      } as never);
    });

    await expect(requireAdmin()).rejects.toMatchObject({
      code: 'ADMIN_REQUIRED',
      statusCode: 403,
    });
  });
});
