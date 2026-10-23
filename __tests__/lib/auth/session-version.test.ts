/**
 * @jest-environment node
 */
/**
 * CODE-02B (WS-5): the write side of the session version. WS-4 made every session compare its
 * token's `sessionVersion` with the account's; this is what raises it. A security change (a new
 * password, 2FA switched on or off, a new e-mail address, "log out all", a suspension, a confirmed
 * deletion) now raises `User.sessionVersion` and deletes the user's refresh tokens IN THE SAME
 * TRANSACTION as the change, so no moment exists in which the password is new and the old sessions
 * still live, and a failed write leaves the version alone.
 *
 * The database here is an in-memory fake that really applies `{ increment }`, really deletes rows
 * and really rolls a transaction back (`__tests__/helpers/account-db-fake.ts`).
 */

import {
  createAccountDbFake,
  type AccountDbFake,
} from '../../helpers/account-db-fake';

let mockFake: AccountDbFake;
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: {
      findUnique: (...a: [never]) => mockFake.client.user.findUnique(...a),
    },
    $transaction: (...a: [never]) => mockFake.$transaction(...a),
  },
}));

jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: jest.fn(),
  default: (options: { id: string }) => ({ id: options.id, options }),
}));

import { authOptions } from '@/lib/auth/auth-options';
import {
  bumpSessionVersion,
  endAllSessions,
  raiseSessionVersion,
  withSessionBump,
} from '@/lib/auth/session-version';
import { clearUserActiveCache, getSessionState } from '@/lib/auth/user-active';

const USER = 'user-1';
const OTHER = 'user-2';

function seed(): AccountDbFake {
  return createAccountDbFake({
    users: [
      {
        id: USER,
        sessionVersion: 0,
        role: 'USER',
        tier: 'FREE',
        isActive: true,
        deletedAt: null,
        password: 'old-hash',
      },
      {
        id: OTHER,
        sessionVersion: 4,
        role: 'USER',
        tier: 'PRO',
        isActive: true,
        deletedAt: null,
        password: 'other-hash',
      },
    ],
    refreshTokens: [
      { id: 'rt-1', userId: USER, hashedToken: 'a' },
      { id: 'rt-2', userId: USER, hashedToken: 'b' },
      { id: 'rt-3', userId: OTHER, hashedToken: 'c' },
    ],
  });
}

async function runJwt(
  token: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const callback = authOptions.callbacks?.jwt;
  if (!callback) throw new Error('jwt callback missing');
  return (await callback({ token, trigger: undefined } as never)) as never;
}

beforeEach(() => {
  mockFake = seed();
  clearUserActiveCache();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('raiseSessionVersion', () => {
  it('raises only the version of that user; the caller deletes the tokens itself', async () => {
    await raiseSessionVersion(mockFake.client, USER);

    expect(mockFake.user(USER)['sessionVersion']).toBe(1);
    expect(mockFake.refreshTokensOf(USER)).toHaveLength(2);
    expect(mockFake.user(OTHER)['sessionVersion']).toBe(4);
  });

  it('does not fail for an account that is already gone', async () => {
    await expect(
      raiseSessionVersion(mockFake.client, 'ghost')
    ).resolves.toBeUndefined();
  });
});

describe('bumpSessionVersion', () => {
  it('raises the version by one and deletes every refresh token of that user, and nobody else', async () => {
    await bumpSessionVersion(mockFake.client, USER);

    expect(mockFake.user(USER)['sessionVersion']).toBe(1);
    expect(mockFake.refreshTokensOf(USER)).toEqual([]);
    expect(mockFake.user(OTHER)['sessionVersion']).toBe(4);
    expect(mockFake.refreshTokensOf(OTHER)).toHaveLength(1);
  });

  it('changes nothing about the account except the version', async () => {
    await bumpSessionVersion(mockFake.client, USER);

    expect(mockFake.user(USER)).toEqual({
      id: USER,
      sessionVersion: 1,
      role: 'USER',
      tier: 'FREE',
      isActive: true,
      deletedAt: null,
      password: 'old-hash',
    });
  });

  it('counts up on every call', async () => {
    await bumpSessionVersion(mockFake.client, USER);
    await bumpSessionVersion(mockFake.client, USER);

    expect(mockFake.user(USER)['sessionVersion']).toBe(2);
  });

  it('does not fail for an account that is already gone (a deletion racing a bump)', async () => {
    await expect(
      bumpSessionVersion(mockFake.client, 'ghost')
    ).resolves.toBeUndefined();

    expect(mockFake.user(USER)['sessionVersion']).toBe(0);
    expect(mockFake.refreshTokensOf(USER)).toHaveLength(2);
  });

  it('rejects when the tokens cannot be deleted, so the caller can roll back', async () => {
    mockFake.failNext('refreshToken.deleteMany');

    await expect(bumpSessionVersion(mockFake.client, USER)).rejects.toThrow(
      'refreshToken.deleteMany failed'
    );
  });
});

describe('withSessionBump', () => {
  // The callback gets the real transaction client in production and the fake here.
  const writePassword = (tx: unknown) =>
    (tx as AccountDbFake['client']).user.update({
      where: { id: USER },
      data: { password: 'new-hash' },
      select: { id: true },
    });

  it('writes, raises the version and deletes the refresh tokens, all inside one transaction', async () => {
    await withSessionBump(USER, writePassword);

    expect(mockFake.user(USER)['password']).toBe('new-hash');
    expect(mockFake.user(USER)['sessionVersion']).toBe(1);
    expect(mockFake.refreshTokensOf(USER)).toEqual([]);
    expect(mockFake.log[0]).toBe('begin');
    expect(mockFake.log[mockFake.log.length - 1]).toBe('commit');
    expect(mockFake.writesOutsideTransaction()).toEqual([]);
  });

  it('bumps AFTER the write, so the version is the last thing the transaction changes', async () => {
    await withSessionBump(USER, writePassword);

    const writes = mockFake.log.filter((entry) => entry.startsWith('tx:'));
    expect(writes[0]).toBe('tx:user.update');
    expect(writes.slice(1)).toEqual([
      'tx:user.updateMany',
      'tx:refreshToken.deleteMany',
    ]);
  });

  it('returns what the write returned', async () => {
    const result = await withSessionBump(USER, async () => 'done');

    expect(result).toBe('done');
  });

  it('leaves the version, the tokens and the account alone when the write fails', async () => {
    mockFake.failNext('user.update', new Error('write refused'));

    await expect(withSessionBump(USER, writePassword)).rejects.toThrow(
      'write refused'
    );

    expect(mockFake.user(USER)['sessionVersion']).toBe(0);
    expect(mockFake.user(USER)['password']).toBe('old-hash');
    expect(mockFake.refreshTokensOf(USER)).toHaveLength(2);
    expect(mockFake.log).toContain('rollback');
  });

  it('rolls the write back when the version cannot be raised', async () => {
    mockFake.failNext('user.updateMany');

    await expect(withSessionBump(USER, writePassword)).rejects.toThrow(
      'user.updateMany failed'
    );

    expect(mockFake.user(USER)['password']).toBe('old-hash');
    expect(mockFake.user(USER)['sessionVersion']).toBe(0);
    expect(mockFake.refreshTokensOf(USER)).toHaveLength(2);
  });

  it('rolls the write and the version back when the tokens cannot be deleted', async () => {
    mockFake.failNext('refreshToken.deleteMany');

    await expect(withSessionBump(USER, writePassword)).rejects.toThrow(
      'refreshToken.deleteMany failed'
    );

    expect(mockFake.user(USER)['password']).toBe('old-hash');
    expect(mockFake.user(USER)['sessionVersion']).toBe(0);
    expect(mockFake.refreshTokensOf(USER)).toHaveLength(2);
  });

  it('a request that reads just before the commit does not leave the old state cached', async () => {
    // Another request lands in the middle of the transaction: it still sees the row as it was
    // (read committed) and caches it. Forgetting before the commit would keep that for 30 s.
    mockFake.beforeNextCommit(async () => {
      expect(await getSessionState(USER)).toMatchObject({ sessionVersion: 0 });
    });

    await withSessionBump(USER, writePassword);

    expect(await getSessionState(USER)).toMatchObject({ sessionVersion: 1 });
  });

  it('forgets the cached snapshot AFTER the commit, not before', async () => {
    expect(
      (await getSessionState(USER)) as { sessionVersion: number }
    ).toMatchObject({ sessionVersion: 0 });

    // A read inside the transaction caches the state as it is before the commit; forgetting at
    // that point would leave it there for 30 s.
    await withSessionBump(USER, async (tx) => {
      await writePassword(tx);
      await getSessionState(USER);
    });

    expect(
      (await getSessionState(USER)) as { sessionVersion: number }
    ).toMatchObject({ sessionVersion: 1 });
  });

  it('keeps the snapshot when the transaction fails (nothing changed)', async () => {
    await getSessionState(USER);
    mockFake.failNext('user.update');

    await expect(withSessionBump(USER, writePassword)).rejects.toThrow();

    expect(mockFake.user(USER)['sessionVersion']).toBe(0);
    expect(await getSessionState(USER)).toMatchObject({ sessionVersion: 0 });
  });
});

describe('endAllSessions (log out all)', () => {
  it('raises the version and deletes the refresh tokens in one transaction, with nothing else written', async () => {
    await endAllSessions(USER);

    expect(mockFake.user(USER)['sessionVersion']).toBe(1);
    expect(mockFake.refreshTokensOf(USER)).toEqual([]);
    expect(mockFake.user(USER)['password']).toBe('old-hash');
    expect(mockFake.log).toEqual([
      'begin',
      'tx:user.updateMany',
      'tx:refreshToken.deleteMany',
      'commit',
    ]);
  });

  it('rejects, and changes nothing, when the tokens cannot be deleted', async () => {
    mockFake.failNext('refreshToken.deleteMany');

    await expect(endAllSessions(USER)).rejects.toThrow();

    expect(mockFake.user(USER)['sessionVersion']).toBe(0);
    expect(mockFake.refreshTokensOf(USER)).toHaveLength(2);
  });
});

describe('end to end: a session minted before a security change is refused after it', () => {
  it('a token at version 0 passes, then the jwt callback refuses it once the password is replaced', async () => {
    const token = {
      id: USER,
      sessionVersion: 0,
      role: 'USER',
      tier: 'FREE',
    };
    await expect(runJwt(token)).resolves.toMatchObject({ id: USER });

    await withSessionBump(USER, (tx) =>
      (tx as AccountDbFake['client']).user.update({
        where: { id: USER },
        data: { password: 'reset-hash' },
        select: { id: true },
      })
    );

    await expect(runJwt(token)).rejects.toThrow('SESSION_REVOKED');
  });

  it('a token minted after the change (version 1) is accepted', async () => {
    await withSessionBump(USER, async () => undefined);

    await expect(
      runJwt({ id: USER, sessionVersion: 1, role: 'USER', tier: 'FREE' })
    ).resolves.toMatchObject({ id: USER });
  });

  it('the account of someone else is not affected', async () => {
    await withSessionBump(USER, async () => undefined);

    await expect(
      runJwt({ id: OTHER, sessionVersion: 4, role: 'USER', tier: 'PRO' })
    ).resolves.toMatchObject({ id: OTHER });
  });
});
