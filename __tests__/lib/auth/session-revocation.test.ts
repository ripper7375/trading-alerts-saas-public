/**
 * @jest-environment node
 */
/**
 * CODE-02C (WS-12): "log out this device".
 *
 * Until now the sessions list (`UserSession`) was decoration: `DELETE /api/user/sessions/[id]` set
 * `isActive = false` on a row, but the NextAuth session is a stateless JWT that never looked at the
 * row, so a revoked device (or a stolen cookie) kept working until the token expired.
 *
 * Now every sign-in writes a `UserSession` row and stamps its id on the token as `sid`. Every
 * session read checks the row through a 30 s snapshot keyed by `sid` (like the account snapshot of
 * `lib/auth/user-active.ts`): a row that is revoked, gone or somebody else's ends the session.
 * A token without `sid` (minted before the deploy, or when the row could not be written) is judged
 * by the account's `sessionVersion` alone, as before.
 *
 * Blocks: the state module on its own, the real `jwt` callback, the session tracker, and the
 * DELETE route (in `user-session-revoke.test.ts`).
 */

type Row = {
  id: string;
  userId: string;
  sessionToken: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  deviceType: string | null;
  city: string | null;
  country: string | null;
  isActive: boolean;
  lastActiveAt: Date;
  createdAt: Date;
  expiresAt: Date;
};

const db: {
  user: Record<string, unknown> | null;
  userFails: Error | null;
  sessions: Map<string, Row>;
  sessionFails: Error | null;
  createFails: Error | null;
  nextId: number;
} = {
  user: null,
  userFails: null,
  sessions: new Map(),
  sessionFails: null,
  createFails: null,
  nextId: 1,
};

/** The SQL a Prisma `where` stands for: `not` is never true for NULL. */
function matches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (cond === undefined) return true;
    if (key === 'OR') {
      return (cond as Record<string, unknown>[]).some((w) => matches(row, w));
    }
    const value = (row as unknown as Record<string, unknown>)[key];
    if (cond !== null && typeof cond === 'object') {
      const c = cond as { not?: unknown; in?: unknown[] };
      if ('not' in c) return value !== null && value !== c.not;
      if ('in' in c) return (c.in as unknown[]).includes(value);
    }
    return value === cond;
  });
}

function pick(row: Row, select?: Record<string, boolean>): unknown {
  if (!select) return { ...row };
  return Object.fromEntries(
    Object.entries(select)
      .filter(([, wanted]) => wanted)
      .map(([column]) => [
        column,
        (row as unknown as Record<string, unknown>)[column],
      ])
  );
}

function newRow(data: Partial<Row>): Row {
  const id = data.id ?? `sess-${db.nextId++}`;
  return {
    id,
    userId: 'user-1',
    sessionToken: null,
    userAgent: null,
    ipAddress: null,
    browser: null,
    browserVersion: null,
    os: null,
    osVersion: null,
    deviceType: null,
    city: null,
    country: null,
    isActive: true,
    lastActiveAt: new Date(),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 86_400_000),
    ...data,
  };
}

const mockSessionFindUnique = jest.fn();
const mockSessionCreate = jest.fn();
const mockSessionUpdateMany = jest.fn();
const mockSessionDeleteMany = jest.fn();
const mockRefreshDeleteMany = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: {
      findUnique: async (args: { select: Record<string, boolean> }) => {
        if (db.userFails) throw db.userFails;
        if (!db.user) return null;
        return Object.fromEntries(
          Object.entries(args.select)
            .filter(([, wanted]) => wanted)
            .map(([column]) => [column, db.user![column]])
        );
      },
    },
    userSession: {
      findUnique: (...a: unknown[]) => mockSessionFindUnique(...a),
      create: (...a: unknown[]) => mockSessionCreate(...a),
      updateMany: (...a: unknown[]) => mockSessionUpdateMany(...a),
      findMany: async (args: {
        where: Record<string, unknown>;
        orderBy?: unknown;
        select?: Record<string, boolean>;
      }) =>
        [...db.sessions.values()]
          .filter((row) => matches(row, args.where))
          .sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime())
          .map((row) => pick(row, args.select)),
      upsert: async (args: {
        where: { sessionToken: string };
        create: Partial<Row>;
        update: Partial<Row>;
      }) => {
        const existing = [...db.sessions.values()].find(
          (row) => row.sessionToken === args.where.sessionToken
        );
        if (existing) {
          Object.assign(existing, args.update);
          return existing;
        }
        const row = newRow({
          ...args.create,
          sessionToken: args.where.sessionToken,
        });
        db.sessions.set(row.id, row);
        return row;
      },
    },
    session: { deleteMany: (...a: unknown[]) => mockSessionDeleteMany(...a) },
    refreshToken: {
      deleteMany: (...a: unknown[]) => mockRefreshDeleteMany(...a),
    },
  },
}));

// jest.config.js maps `next-auth` and every `next-auth/*` import to ONE stub, so this single factory
// is also what `next-auth/jwt` (`decode`) and `next-auth/providers/credentials` resolve to.
const mockDecode = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: jest.fn(),
  default: (options: { id: string }) => ({ id: options.id, options }),
  decode: (...a: unknown[]) => mockDecode(...a),
}));

const mockHeaders = jest.fn();
jest.mock('next/headers', () => ({
  __esModule: true,
  headers: () => mockHeaders(),
  cookies: jest.fn(),
}));

import { authOptions } from '@/lib/auth/auth-options';
import {
  getUserSessions,
  revokeAllSessions,
  revokeSession,
  trackSession,
} from '@/lib/auth/session-tracker';
import {
  clearUserActiveCache,
  forgetDeviceSession,
  getDeviceSessionState,
  judgeDeviceSession,
  startSession,
} from '@/lib/auth/user-active';

const CHROME_ON_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function userRow(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: 'user-1',
    email: 'alice@example.com',
    name: 'Alice',
    image: null,
    isAffiliate: false,
    isActive: true,
    deletedAt: null,
    sessionVersion: 0,
    role: 'USER',
    tier: 'FREE',
    twoFactorEnabled: false,
    ...overrides,
  };
}

function seedSession(data: Partial<Row>): Row {
  const row = newRow(data);
  db.sessions.set(row.id, row);
  return row;
}

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

const sessionToken = (extra: Record<string, unknown> = {}) => ({
  id: 'user-1',
  email: 'alice@example.com',
  role: 'USER',
  tier: 'FREE',
  isAffiliate: false,
  ...extra,
});

/** What the cookie holds: the claims `decode` hands back for a given cookie value. */
function cookieHolds(cookie: string, claims: Record<string, unknown> | null) {
  const previous = mockDecode.getMockImplementation();
  mockDecode.mockImplementation(async (args: { token: string }) =>
    args.token === cookie ? claims : previous ? previous(args) : null
  );
}

beforeEach(() => {
  db.user = userRow();
  db.userFails = null;
  db.sessions = new Map();
  db.sessionFails = null;
  db.createFails = null;
  db.nextId = 1;

  mockSessionFindUnique.mockReset();
  mockSessionFindUnique.mockImplementation(
    async (args: {
      where: { id?: string; sessionToken?: string };
      select?: Record<string, boolean>;
    }) => {
      if (db.sessionFails) throw db.sessionFails;
      const row =
        args.where.id !== undefined
          ? db.sessions.get(args.where.id)
          : [...db.sessions.values()].find(
              (r) => r.sessionToken === args.where.sessionToken
            );
      return row ? pick(row, args.select) : null;
    }
  );
  mockSessionCreate.mockReset();
  mockSessionCreate.mockImplementation(async (args: { data: Partial<Row> }) => {
    if (db.createFails) throw db.createFails;
    const row = newRow(args.data);
    db.sessions.set(row.id, row);
    return pick(row, undefined);
  });
  mockSessionUpdateMany.mockReset();
  mockSessionUpdateMany.mockImplementation(
    async (args: { where: Record<string, unknown>; data: Partial<Row> }) => {
      let count = 0;
      for (const row of db.sessions.values()) {
        if (matches(row, args.where)) {
          Object.assign(row, args.data);
          count += 1;
        }
      }
      return { count };
    }
  );
  mockSessionDeleteMany.mockReset();
  mockSessionDeleteMany.mockResolvedValue({ count: 0 });
  mockRefreshDeleteMany.mockReset();
  mockRefreshDeleteMany.mockResolvedValue({ count: 0 });
  mockDecode.mockReset();
  mockDecode.mockResolvedValue(null);
  mockHeaders.mockReset();
  mockHeaders.mockResolvedValue(
    new Headers({
      'user-agent': CHROME_ON_WINDOWS,
      'x-forwarded-for': '203.0.113.7, 10.0.0.1',
    })
  );

  clearUserActiveCache();
  Reflect.set(process.env, 'NEXTAUTH_SECRET', 'test-nextauth-secret');
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('getDeviceSessionState', () => {
  it('reads exactly the two columns the check needs, by the sid', async () => {
    const row = seedSession({});

    await getDeviceSessionState('user-1', row.id);

    expect(mockSessionFindUnique).toHaveBeenCalledWith({
      where: { id: row.id },
      select: { userId: true, isActive: true },
    });
  });

  it('answers with the state of an active row of that user', async () => {
    const row = seedSession({});

    await expect(getDeviceSessionState('user-1', row.id)).resolves.toEqual({
      isActive: true,
    });
  });

  it("answers 'missing' for no row, and for a row that belongs to somebody else", async () => {
    const theirs = seedSession({ userId: 'user-2' });

    await expect(getDeviceSessionState('user-1', 'ghost')).resolves.toBe(
      'missing'
    );
    await expect(getDeviceSessionState('user-1', theirs.id)).resolves.toBe(
      'missing'
    );
  });

  it("answers 'error' when the lookup throws", async () => {
    db.sessionFails = new Error('connection reset');

    await expect(getDeviceSessionState('user-1', 'any')).resolves.toBe('error');
  });

  it('asks the database once per sid inside the 30 s window, and again after it', async () => {
    jest.useFakeTimers({ now: 1_000_000 });
    const row = seedSession({});

    await getDeviceSessionState('user-1', row.id);
    jest.setSystemTime(1_000_000 + 29_000);
    await getDeviceSessionState('user-1', row.id);
    expect(mockSessionFindUnique).toHaveBeenCalledTimes(1);

    jest.setSystemTime(1_000_000 + 31_000);
    await getDeviceSessionState('user-1', row.id);
    expect(mockSessionFindUnique).toHaveBeenCalledTimes(2);
  });

  it('never caches a revoked row, so the answer cannot outlive the revocation', async () => {
    const row = seedSession({ isActive: false });

    await expect(getDeviceSessionState('user-1', row.id)).resolves.toEqual({
      isActive: false,
    });
    await getDeviceSessionState('user-1', row.id);
    expect(mockSessionFindUnique).toHaveBeenCalledTimes(2);
  });

  it('does not answer for another user from a snapshot held for the sid: the row is not theirs', async () => {
    const row = seedSession({});
    await getDeviceSessionState('user-1', row.id); // held as active

    await expect(getDeviceSessionState('user-2', row.id)).resolves.toBe(
      'missing'
    );
  });

  it('forgetDeviceSession drops one sid and leaves the others', async () => {
    const a = seedSession({});
    const b = seedSession({});
    await getDeviceSessionState('user-1', a.id);
    await getDeviceSessionState('user-1', b.id);
    mockSessionFindUnique.mockClear();

    forgetDeviceSession(a.id);
    await getDeviceSessionState('user-1', a.id);
    await getDeviceSessionState('user-1', b.id);

    expect(mockSessionFindUnique).toHaveBeenCalledTimes(1);
  });

  it('clearUserActiveCache forgets the device snapshots too', async () => {
    const row = seedSession({});
    await getDeviceSessionState('user-1', row.id);
    mockSessionFindUnique.mockClear();

    clearUserActiveCache();
    await getDeviceSessionState('user-1', row.id);

    expect(mockSessionFindUnique).toHaveBeenCalledTimes(1);
  });
});

describe('judgeDeviceSession', () => {
  it('accepts a token that carries no sid (minted before the deploy)', () => {
    expect(judgeDeviceSession({}, { isActive: false })).toEqual({ ok: true });
    expect(judgeDeviceSession({ sid: undefined }, 'missing')).toEqual({
      ok: true,
    });
  });

  it('treats a sid that is not a non-empty string as no sid', () => {
    for (const sid of ['', 7, null, {}, ['a']]) {
      expect(judgeDeviceSession({ sid }, 'missing')).toEqual({ ok: true });
    }
  });

  it('accepts an active row', () => {
    expect(judgeDeviceSession({ sid: 's' }, { isActive: true })).toEqual({
      ok: true,
    });
  });

  it('refuses a revoked row with SESSION_REVOKED', () => {
    expect(judgeDeviceSession({ sid: 's' }, { isActive: false })).toEqual({
      ok: false,
      code: 'SESSION_REVOKED',
    });
  });

  it('refuses a row that is gone: a purged revocation must not bring the token back', () => {
    expect(judgeDeviceSession({ sid: 's' }, 'missing')).toEqual({
      ok: false,
      code: 'SESSION_REVOKED',
    });
  });

  it("lets the token through on 'error' (a blip must not sign everyone out)", () => {
    expect(judgeDeviceSession({ sid: 's' }, 'error')).toEqual({ ok: true });
  });
});

describe('the jwt callback and the device session', () => {
  describe('at sign-in', () => {
    it('writes a UserSession row for the user and stamps its id on the token as sid', async () => {
      const signedIn = await runJwt(
        {},
        { id: 'user-1', email: 'alice@example.com' }
      );

      expect(db.sessions.size).toBe(1);
      const [row] = [...db.sessions.values()];
      expect(row).toMatchObject({ userId: 'user-1', isActive: true });
      expect(signedIn['sid']).toBe(row!.id);
    });

    it('still stamps sessionVersion and authTime next to the sid', async () => {
      db.user = userRow({ sessionVersion: 3 });

      const signedIn = await runJwt(
        {},
        { id: 'user-1', email: 'alice@example.com' }
      );

      expect(signedIn['sessionVersion']).toBe(3);
      expect(signedIn['authTime']).toEqual(expect.any(Number));
      expect(signedIn['sid']).toEqual(expect.any(String));
    });

    it('signs in without a sid when the row cannot be written, and says so in the log', async () => {
      db.createFails = new Error('connection reset');

      const signedIn = await runJwt(
        {},
        { id: 'user-1', email: 'alice@example.com' }
      );

      expect(signedIn['sid']).toBeUndefined();
      expect(signedIn['id']).toBe('user-1');
      expect(console.error).toHaveBeenCalled();
    });

    it('starts one session per sign-in', async () => {
      const first = await runJwt({}, { id: 'user-1', email: 'a@b.test' });
      const second = await runJwt({}, { id: 'user-1', email: 'a@b.test' });

      expect(db.sessions.size).toBe(2);
      expect(first['sid']).not.toBe(second['sid']);
    });
  });

  describe('on a session read', () => {
    it('refuses a token whose sid row was revoked (SESSION_REVOKED)', async () => {
      const row = seedSession({ isActive: false });

      await expect(runJwt(sessionToken({ sid: row.id }))).rejects.toThrow(
        'SESSION_REVOKED'
      );
    });

    it('refuses a token whose sid row is gone', async () => {
      await expect(runJwt(sessionToken({ sid: 'purged' }))).rejects.toThrow(
        'SESSION_REVOKED'
      );
    });

    it("refuses a sid that belongs to another user's row", async () => {
      const theirs = seedSession({ userId: 'user-2' });

      await expect(runJwt(sessionToken({ sid: theirs.id }))).rejects.toThrow(
        'SESSION_REVOKED'
      );
    });

    it('accepts a token whose sid row is active, and keeps the sid on the token', async () => {
      const row = seedSession({});

      await expect(
        runJwt(sessionToken({ sid: row.id }))
      ).resolves.toMatchObject({ id: 'user-1', sid: row.id });
    });

    it('does not look at user_sessions for a token without a sid', async () => {
      await expect(runJwt(sessionToken())).resolves.toMatchObject({
        id: 'user-1',
      });

      expect(mockSessionFindUnique).not.toHaveBeenCalled();
    });

    it('lets the token through when the row lookup fails (a blip must not sign everyone out)', async () => {
      const row = seedSession({});
      db.sessionFails = new Error('connection reset');

      await expect(
        runJwt(sessionToken({ sid: row.id }))
      ).resolves.toMatchObject({ id: 'user-1' });
    });

    it('checks the account first: a locked account with a live sid gets ACCOUNT_DEACTIVATED', async () => {
      const row = seedSession({});
      db.user = userRow({ isActive: false });

      await expect(runJwt(sessionToken({ sid: row.id }))).rejects.toThrow(
        'ACCOUNT_DEACTIVATED'
      );
    });

    it('still refreshes role and tier from the database for a token with a sid', async () => {
      const row = seedSession({});
      db.user = userRow({ role: 'USER', tier: 'PRO' });

      await expect(
        runJwt(sessionToken({ sid: row.id, tier: 'FREE' }))
      ).resolves.toMatchObject({ tier: 'PRO' });
    });

    it('revoking one device leaves the other devices of the same account signed in', async () => {
      const phone = seedSession({});
      const laptop = seedSession({});

      await revokeSession(phone.id, 'user-1');

      await expect(runJwt(sessionToken({ sid: phone.id }))).rejects.toThrow(
        'SESSION_REVOKED'
      );
      await expect(
        runJwt(sessionToken({ sid: laptop.id }))
      ).resolves.toMatchObject({ id: 'user-1' });
    });

    it('ends the session at once on the instance that revoked it, though the active answer was cached', async () => {
      const row = seedSession({});
      await runJwt(sessionToken({ sid: row.id })); // cached as active for 30 s

      await revokeSession(row.id, 'user-1');

      await expect(runJwt(sessionToken({ sid: row.id }))).rejects.toThrow(
        'SESSION_REVOKED'
      );
    });

    it('within the 30 s window another instance still has the old answer, and sees the revocation after it', async () => {
      jest.useFakeTimers({ now: 5_000_000 });
      const row = seedSession({});
      await runJwt(sessionToken({ sid: row.id }));

      // Another instance revoked it: this one is not told (no forgetDeviceSession here).
      row.isActive = false;
      await expect(
        runJwt(sessionToken({ sid: row.id }))
      ).resolves.toMatchObject({ id: 'user-1' });

      jest.setSystemTime(5_000_000 + 31_000);
      await expect(runJwt(sessionToken({ sid: row.id }))).rejects.toThrow(
        'SESSION_REVOKED'
      );
    });
  });
});

describe('startSession', () => {
  it('writes one active row for the user with the request metadata and no session token', async () => {
    const before = Date.now();

    const id = await startSession('user-1');

    const row = db.sessions.get(id)!;
    expect(row).toMatchObject({
      userId: 'user-1',
      isActive: true,
      sessionToken: null,
      userAgent: CHROME_ON_WINDOWS,
      ipAddress: '203.0.113.7',
    });
    // Exactly these columns: the raw user agent and address, no session token.
    expect(mockSessionCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        userAgent: CHROME_ON_WINDOWS,
        ipAddress: '203.0.113.7',
        expiresAt: expect.any(Date),
      },
      select: { id: true },
    });
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    expect(row.expiresAt.getTime()).toBeGreaterThanOrEqual(before + thirtyDays);
    expect(row.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + thirtyDays
    );
  });

  it('falls back to x-real-ip, then to Unknown, like the sessions list does', async () => {
    mockHeaders.mockResolvedValue(
      new Headers({ 'user-agent': 'x', 'x-real-ip': '198.51.100.9' })
    );
    const viaRealIp = await startSession('user-1');
    expect(db.sessions.get(viaRealIp)!.ipAddress).toBe('198.51.100.9');

    mockHeaders.mockResolvedValue(new Headers({ 'user-agent': 'x' }));
    const none = await startSession('user-1');
    expect(db.sessions.get(none)!.ipAddress).toBe('Unknown');
  });

  it('still writes the row when there is no request to read the headers of', async () => {
    mockHeaders.mockRejectedValue(new Error('called outside a request scope'));

    const id = await startSession('user-1');

    expect(db.sessions.get(id)).toMatchObject({
      userId: 'user-1',
      isActive: true,
      userAgent: null,
      ipAddress: null,
    });
  });

  it('lets a failed write escape, so the caller decides', async () => {
    db.createFails = new Error('connection reset');

    await expect(startSession('user-1')).rejects.toThrow('connection reset');
  });
});

describe('revokeSession', () => {
  it("marks the caller's row inactive and answers true", async () => {
    const row = seedSession({});

    await expect(revokeSession(row.id, 'user-1')).resolves.toBe(true);

    expect(db.sessions.get(row.id)!.isActive).toBe(false);
  });

  it('keeps the row, so a token that still carries its sid is refused as revoked and not as unknown', async () => {
    const row = seedSession({});

    await revokeSession(row.id, 'user-1');

    expect(db.sessions.has(row.id)).toBe(true);
  });

  it("answers false and changes nothing for another user's row", async () => {
    const theirs = seedSession({
      userId: 'user-2',
      sessionToken: 'their-token',
    });

    await expect(revokeSession(theirs.id, 'user-1')).resolves.toBe(false);

    expect(db.sessions.get(theirs.id)!.isActive).toBe(true);
    expect(mockSessionDeleteMany).not.toHaveBeenCalled();
    expect(mockRefreshDeleteMany).not.toHaveBeenCalled();
  });

  it('answers false for a row that does not exist', async () => {
    await expect(revokeSession('ghost', 'user-1')).resolves.toBe(false);
  });

  it('deletes the linked NextAuth session and the refresh token bound to the same token', async () => {
    const row = seedSession({ sessionToken: 'token-or-refresh-hash' });

    await revokeSession(row.id, 'user-1');

    expect(mockSessionDeleteMany).toHaveBeenCalledWith({
      where: { sessionToken: 'token-or-refresh-hash' },
    });
    expect(mockRefreshDeleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', hashedToken: 'token-or-refresh-hash' },
    });
  });

  it('touches no NextAuth session or refresh token for a row without a token', async () => {
    const row = seedSession({ sessionToken: null });

    await revokeSession(row.id, 'user-1');

    expect(mockSessionDeleteMany).not.toHaveBeenCalled();
    expect(mockRefreshDeleteMany).not.toHaveBeenCalled();
  });
});

describe('signing out', () => {
  const signOut = async (token: Record<string, unknown>): Promise<void> => {
    const handler = authOptions.events?.signOut;
    if (!handler) throw new Error('signOut event missing');
    await handler({ token } as never);
  };

  it('ends the device row of the token, so the list does not keep a device that is gone', async () => {
    const row = seedSession({});

    await signOut({ id: 'user-1', sid: row.id });

    expect(db.sessions.get(row.id)!.isActive).toBe(false);
  });

  it('makes a copy of the cookie useless: the token is refused from then on', async () => {
    const row = seedSession({});
    await runJwt(sessionToken({ sid: row.id })); // cached as active for 30 s

    await signOut({ id: 'user-1', sid: row.id });

    await expect(runJwt(sessionToken({ sid: row.id }))).rejects.toThrow(
      'SESSION_REVOKED'
    );
  });

  it("ends only the signing-out user's own device", async () => {
    const theirs = seedSession({ userId: 'user-2' });
    const other = seedSession({});

    await signOut({ id: 'user-1', sid: theirs.id });

    expect(db.sessions.get(theirs.id)!.isActive).toBe(true);
    expect(db.sessions.get(other.id)!.isActive).toBe(true);
  });

  it('writes nothing for a token without a sid', async () => {
    await signOut({ id: 'user-1' });

    expect(mockSessionUpdateMany).not.toHaveBeenCalled();
  });

  it('never fails the sign-out when the row cannot be written', async () => {
    mockSessionUpdateMany.mockRejectedValue(new Error('connection reset'));

    await expect(
      signOut({ id: 'user-1', sid: 'any' })
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});

describe('trackSession', () => {
  const track = (cookie: string) =>
    trackSession({
      userId: 'user-1',
      sessionToken: cookie,
      userAgent: CHROME_ON_WINDOWS,
      ipAddress: '203.0.113.7',
    });

  it('fills in the row the sign-in wrote, and writes no second row for the same device', async () => {
    const row = seedSession({});
    cookieHolds('cookie-1', { id: 'user-1', sid: row.id });

    await expect(track('cookie-1')).resolves.toBe(row.id);

    expect(db.sessions.size).toBe(1);
    expect(db.sessions.get(row.id)).toMatchObject({
      userAgent: CHROME_ON_WINDOWS,
      ipAddress: '203.0.113.7',
      browser: 'Chrome',
      os: 'Windows',
    });
  });

  it('does not store the cookie value (a bearer credential) on a row with a sid', async () => {
    const row = seedSession({});
    cookieHolds('cookie-1', { id: 'user-1', sid: row.id });

    await track('cookie-1');

    expect(db.sessions.get(row.id)!.sessionToken).toBeNull();
    expect(
      [...db.sessions.values()].some((r) => r.sessionToken === 'cookie-1')
    ).toBe(false);
  });

  it("does not touch another user's row named by the sid, and does not write a row for the cookie instead", async () => {
    const theirs = seedSession({ userId: 'user-2' });
    cookieHolds('cookie-1', { id: 'user-1', sid: theirs.id });

    await track('cookie-1');

    expect(db.sessions.get(theirs.id)!.userAgent).toBeNull();
    expect(db.sessions.size).toBe(1);
  });

  it('does not bring a revoked row back to life, and does not write a row for the cookie instead', async () => {
    const row = seedSession({ isActive: false });
    cookieHolds('cookie-1', { id: 'user-1', sid: row.id });

    await track('cookie-1');

    expect(db.sessions.get(row.id)!.isActive).toBe(false);
    // Not even its details are rewritten: a revoked device is left as it was.
    expect(db.sessions.get(row.id)!.userAgent).toBeNull();
    expect(db.sessions.size).toBe(1);
  });

  it('keeps the old behaviour for a cookie with no sid: one row per cookie value', async () => {
    cookieHolds('legacy-cookie', { id: 'user-1' });

    const id = await track('legacy-cookie');
    await track('legacy-cookie');

    expect(db.sessions.size).toBe(1);
    expect(db.sessions.get(id)).toMatchObject({
      sessionToken: 'legacy-cookie',
      userId: 'user-1',
    });
  });

  it('keeps the old behaviour for a cookie that cannot be decoded', async () => {
    mockDecode.mockRejectedValue(new Error('bad token'));

    const id = await track('garbage');

    expect(db.sessions.get(id)!.sessionToken).toBe('garbage');
  });
});

describe('getUserSessions', () => {
  it('marks the device of the cookie as current by its sid, though the row holds no token', async () => {
    const mine = seedSession({ browser: 'Chrome', os: 'Windows' });
    const other = seedSession({ browser: 'Safari', os: 'iOS' });
    cookieHolds('cookie-1', { id: 'user-1', sid: mine.id });

    const list = await getUserSessions('user-1', 'cookie-1');

    expect(list.find((s) => s.id === mine.id)).toMatchObject({
      isCurrent: true,
      lastActive: 'Current session',
    });
    expect(list.find((s) => s.id === other.id)).toMatchObject({
      isCurrent: false,
    });
  });

  it('names a row the sign-in wrote from its user agent, since nobody has listed the sessions on that device yet', async () => {
    const id = await startSession('user-1');

    const list = await getUserSessions('user-1');

    expect(list.find((s) => s.id === id)).toMatchObject({
      device: 'Chrome on Windows',
      browser: 'Chrome',
      os: 'Windows',
    });
  });

  it('keeps the stored browser and os over the user agent, and says Unknown when there is neither', async () => {
    const stored = seedSession({
      browser: 'Firefox',
      os: 'Linux',
      userAgent: CHROME_ON_WINDOWS,
    });
    const bare = seedSession({});

    const list = await getUserSessions('user-1');

    expect(list.find((s) => s.id === stored.id)).toMatchObject({
      device: 'Firefox on Linux',
    });
    expect(list.find((s) => s.id === bare.id)).toMatchObject({
      device: 'Unknown device',
      browser: 'Unknown',
      os: 'Unknown',
    });
  });

  it('still marks a legacy row current by its token', async () => {
    const legacy = seedSession({ sessionToken: 'legacy-cookie' });
    cookieHolds('legacy-cookie', { id: 'user-1' });

    const list = await getUserSessions('user-1', 'legacy-cookie');

    expect(list.find((s) => s.id === legacy.id)!.isCurrent).toBe(true);
  });

  it('marks nothing current when there is no cookie, and lists no revoked row', async () => {
    seedSession({});
    seedSession({ isActive: false });

    const list = await getUserSessions('user-1');

    expect(list).toHaveLength(1);
    expect(list[0]!.isCurrent).toBe(false);
  });
});

describe('revokeAllSessions (log out all)', () => {
  it('ends every device row except the current one, including rows that hold no token', async () => {
    const current = seedSession({});
    const phone = seedSession({});
    const legacy = seedSession({ sessionToken: 'legacy-cookie' });
    const theirs = seedSession({ userId: 'user-2' });
    cookieHolds('cookie-1', { id: 'user-1', sid: current.id });

    const count = await revokeAllSessions('user-1', 'cookie-1');

    expect(count).toBe(2);
    expect(db.sessions.get(current.id)!.isActive).toBe(true);
    expect(db.sessions.get(phone.id)!.isActive).toBe(false);
    expect(db.sessions.get(legacy.id)!.isActive).toBe(false);
    expect(db.sessions.get(theirs.id)!.isActive).toBe(true);
  });

  it('ends every row of the user when no current session is named', async () => {
    seedSession({});
    seedSession({ sessionToken: 'legacy-cookie' });

    await expect(revokeAllSessions('user-1')).resolves.toBe(2);
  });

  it('keeps a legacy current row by its token', async () => {
    const current = seedSession({ sessionToken: 'legacy-cookie' });
    const phone = seedSession({});
    cookieHolds('legacy-cookie', { id: 'user-1' });

    await revokeAllSessions('user-1', 'legacy-cookie');

    expect(db.sessions.get(current.id)!.isActive).toBe(true);
    expect(db.sessions.get(phone.id)!.isActive).toBe(false);
  });

  it('forgets the cached answer of every row it ended', async () => {
    const phone = seedSession({});
    await getDeviceSessionState('user-1', phone.id); // cached as active
    mockSessionFindUnique.mockClear();

    await revokeAllSessions('user-1');
    await runJwt(sessionToken({ sid: phone.id })).catch(() => undefined);

    expect(mockSessionFindUnique).toHaveBeenCalled();
  });
});
