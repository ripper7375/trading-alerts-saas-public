import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import hkdf from '@panva/hkdf';
import { EncryptJWT } from 'jose';

import type { PrismaService } from '../prisma/prisma.service';
import type { RedisService } from '../redis/redis.service';
import {
  createAccountDbFake,
  type AccountDbFake,
} from '../../test/account-db-fake';
import { AuthService } from './auth.service';
import { JwtAuthGuard, AuthenticatedRequest } from './jwt-auth.guard';
import type { RefreshTokenService } from './refresh-token.service';
import {
  bumpSessionVersion,
  raiseSessionVersion,
  withSessionBump,
} from './session-version.util';
import { clearUserActiveCache, getSessionState } from './user-active.util';

jest.mock('../email/email.util', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
  sendVerificationEmail: jest.fn().mockResolvedValue({ success: true }),
  sendWelcomeEmail: jest.fn().mockResolvedValue({ success: true }),
}));

/**
 * CODE-02B (WS-5): the write side of the session version. WS-4 made every request compare its
 * token's `sessionVersion` with the account's; this is what raises it. A security change now raises
 * `User.sessionVersion` and deletes the user's refresh tokens IN THE SAME TRANSACTION as the change.
 *
 * The database is an in-memory fake that really applies `{ increment }`, really deletes rows and
 * really rolls a transaction back (`test/account-db-fake.ts`).
 */

const USER = 'user-1';
const OTHER = 'user-2';
const TEST_SECRET = 'test-nextauth-secret-value-not-real';

function seed(): AccountDbFake {
  return createAccountDbFake({
    users: [
      {
        id: USER,
        sessionVersion: 0,
        role: 'USER',
        tier: 'PRO',
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

/** The Prisma service as far as the util and the guard use it, backed by the fake. */
function prismaOf(fake: AccountDbFake): PrismaService {
  return {
    user: fake.client.user,
    refreshToken: fake.client.refreshToken,
    $transaction: fake.$transaction,
  } as unknown as PrismaService;
}

// Mirrors next-auth/jwt's own encode() (see jwt-auth.guard.spec.ts).
async function mintTestToken(claims: Record<string, unknown>): Promise<string> {
  const key = await hkdf(
    'sha256',
    TEST_SECRET,
    '',
    'NextAuth.js Generated Encryption Key',
    32
  );
  return new EncryptJWT(claims)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 7 * 24 * 3600)
    .encrypt(key);
}

function contextWith(token: string): ExecutionContext {
  const request: Partial<AuthenticatedRequest> = {
    headers: { authorization: `Bearer ${token}` },
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('session-version.util', () => {
  const originalSecret = process.env['NEXTAUTH_SECRET'];
  let fake: AccountDbFake;

  beforeEach(() => {
    process.env['NEXTAUTH_SECRET'] = TEST_SECRET;
    fake = seed();
    clearUserActiveCache();
  });

  afterAll(() => {
    process.env['NEXTAUTH_SECRET'] = originalSecret;
  });

  describe('raiseSessionVersion', () => {
    it('raises only the version of that user; the caller deletes the tokens itself', async () => {
      await raiseSessionVersion(prismaOf(fake), USER);

      expect(fake.user(USER)['sessionVersion']).toBe(1);
      expect(fake.refreshTokensOf(USER)).toHaveLength(2);
      expect(fake.user(OTHER)['sessionVersion']).toBe(4);
    });

    it('does not fail for an account that is already gone', async () => {
      await expect(
        raiseSessionVersion(prismaOf(fake), 'ghost')
      ).resolves.toBeUndefined();
    });
  });

  describe('bumpSessionVersion', () => {
    it('raises the version by one and deletes every refresh token of that user, and nobody else', async () => {
      await bumpSessionVersion(prismaOf(fake), USER);

      expect(fake.user(USER)['sessionVersion']).toBe(1);
      expect(fake.refreshTokensOf(USER)).toEqual([]);
      expect(fake.user(OTHER)['sessionVersion']).toBe(4);
      expect(fake.refreshTokensOf(OTHER)).toHaveLength(1);
    });

    it('changes nothing about the account except the version', async () => {
      await bumpSessionVersion(prismaOf(fake), USER);

      expect(fake.user(USER)).toEqual({
        id: USER,
        sessionVersion: 1,
        role: 'USER',
        tier: 'PRO',
        isActive: true,
        deletedAt: null,
        password: 'old-hash',
      });
    });

    it('counts up on every call', async () => {
      await bumpSessionVersion(prismaOf(fake), USER);
      await bumpSessionVersion(prismaOf(fake), USER);

      expect(fake.user(USER)['sessionVersion']).toBe(2);
    });

    it('does not fail for an account that is already gone (a deletion racing a bump)', async () => {
      await expect(
        bumpSessionVersion(prismaOf(fake), 'ghost')
      ).resolves.toBeUndefined();

      expect(fake.user(USER)['sessionVersion']).toBe(0);
      expect(fake.refreshTokensOf(USER)).toHaveLength(2);
    });

    it('rejects when the tokens cannot be deleted, so the caller can roll back', async () => {
      fake.failNext('refreshToken.deleteMany');

      await expect(bumpSessionVersion(prismaOf(fake), USER)).rejects.toThrow(
        'refreshToken.deleteMany failed'
      );
    });
  });

  describe('withSessionBump', () => {
    const writePassword = (tx: unknown) =>
      (tx as AccountDbFake['client']).user.update({
        where: { id: USER },
        data: { password: 'new-hash' },
        select: { id: true },
      });

    it('writes, raises the version and deletes the refresh tokens, all inside one transaction', async () => {
      await withSessionBump(prismaOf(fake), USER, writePassword);

      expect(fake.user(USER)['password']).toBe('new-hash');
      expect(fake.user(USER)['sessionVersion']).toBe(1);
      expect(fake.refreshTokensOf(USER)).toEqual([]);
      expect(fake.log[0]).toBe('begin');
      expect(fake.log[fake.log.length - 1]).toBe('commit');
      expect(fake.writesOutsideTransaction()).toEqual([]);
    });

    it('bumps AFTER the write, so the version is the last thing the transaction changes', async () => {
      await withSessionBump(prismaOf(fake), USER, writePassword);

      const writes = fake.log.filter((entry) => entry.startsWith('tx:'));
      expect(writes[0]).toBe('tx:user.update');
      expect(writes.slice(1)).toEqual([
        'tx:user.updateMany',
        'tx:refreshToken.deleteMany',
      ]);
    });

    it('returns what the write returned', async () => {
      await expect(
        withSessionBump(prismaOf(fake), USER, async () => 'done')
      ).resolves.toBe('done');
    });

    it('leaves the version, the tokens and the account alone when the write fails', async () => {
      fake.failNext('user.update', new Error('write refused'));

      await expect(
        withSessionBump(prismaOf(fake), USER, writePassword)
      ).rejects.toThrow('write refused');

      expect(fake.user(USER)['sessionVersion']).toBe(0);
      expect(fake.user(USER)['password']).toBe('old-hash');
      expect(fake.refreshTokensOf(USER)).toHaveLength(2);
      expect(fake.log).toContain('rollback');
    });

    it('rolls the write back when the version cannot be raised', async () => {
      fake.failNext('user.updateMany');

      await expect(
        withSessionBump(prismaOf(fake), USER, writePassword)
      ).rejects.toThrow('user.updateMany failed');

      expect(fake.user(USER)['password']).toBe('old-hash');
      expect(fake.user(USER)['sessionVersion']).toBe(0);
      expect(fake.refreshTokensOf(USER)).toHaveLength(2);
    });

    it('rolls the write and the version back when the tokens cannot be deleted', async () => {
      fake.failNext('refreshToken.deleteMany');

      await expect(
        withSessionBump(prismaOf(fake), USER, writePassword)
      ).rejects.toThrow('refreshToken.deleteMany failed');

      expect(fake.user(USER)['password']).toBe('old-hash');
      expect(fake.user(USER)['sessionVersion']).toBe(0);
      expect(fake.refreshTokensOf(USER)).toHaveLength(2);
    });

    it('a request that reads just before the commit does not leave the old state cached', async () => {
      const prisma = prismaOf(fake);
      // Another request lands in the middle of the transaction: it still sees the row as it was
      // (read committed) and caches it. Forgetting before the commit would keep that for 30 s.
      fake.beforeNextCommit(async () => {
        expect(await getSessionState(prisma, USER)).toMatchObject({
          sessionVersion: 0,
        });
      });

      await withSessionBump(prisma, USER, writePassword);

      expect(await getSessionState(prisma, USER)).toMatchObject({
        sessionVersion: 1,
      });
    });

    it('forgets the cached snapshot AFTER the commit, not before', async () => {
      const prisma = prismaOf(fake);
      expect(await getSessionState(prisma, USER)).toMatchObject({
        sessionVersion: 0,
      });

      // A read inside the transaction caches the state as it is before the commit; forgetting at
      // that point would leave it there for 30 s.
      await withSessionBump(prisma, USER, async (tx) => {
        await writePassword(tx);
        await getSessionState(prisma, USER);
      });

      expect(await getSessionState(prisma, USER)).toMatchObject({
        sessionVersion: 1,
      });
    });

    it('keeps the snapshot when the transaction fails (nothing changed)', async () => {
      const prisma = prismaOf(fake);
      await getSessionState(prisma, USER);
      fake.failNext('user.update');

      await expect(
        withSessionBump(prisma, USER, writePassword)
      ).rejects.toThrow();

      expect(fake.user(USER)['sessionVersion']).toBe(0);
      expect(await getSessionState(prisma, USER)).toMatchObject({
        sessionVersion: 0,
      });
    });
  });

  describe('end to end: a token minted before a security change is refused after it', () => {
    function guardFor(f: AccountDbFake): JwtAuthGuard {
      return new JwtAuthGuard(prismaOf(f));
    }

    const claims = (overrides: Record<string, unknown> = {}) => ({
      sub: USER,
      id: USER,
      email: 'alice@example.com',
      tier: 'PRO',
      role: 'USER',
      sessionVersion: 0,
      ...overrides,
    });

    it('a token at version 0 passes the guard, then is refused with SESSION_REVOKED once the password is replaced', async () => {
      const guard = guardFor(fake);
      const token = await mintTestToken(claims());
      await expect(guard.canActivate(contextWith(token))).resolves.toBe(true);

      await withSessionBump(prismaOf(fake), USER, (tx) =>
        (tx as unknown as AccountDbFake['client']).user.update({
          where: { id: USER },
          data: { password: 'reset-hash' },
          select: { id: true },
        })
      );

      const refused = guard.canActivate(contextWith(token));
      await expect(refused).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(guard.canActivate(contextWith(token))).rejects.toMatchObject(
        { response: expect.objectContaining({ error: 'SESSION_REVOKED' }) }
      );
    });

    it('with the real reset: a token at version 0 is refused once AuthService.resetPassword has run', async () => {
      const resetFake = createAccountDbFake({
        users: [
          {
            id: USER,
            sessionVersion: 0,
            role: 'USER',
            tier: 'PRO',
            isActive: true,
            deletedAt: null,
            password: 'old-hash',
            resetToken: 'reset-tok',
            resetTokenExpiry: new Date(Date.now() + 60_000),
          },
        ],
        refreshTokens: [{ id: 'rt-1', userId: USER, hashedToken: 'a' }],
      });
      const guard = guardFor(resetFake);
      const service = new AuthService(
        prismaOf(resetFake),
        {} as unknown as RefreshTokenService,
        {} as unknown as RedisService
      );
      const token = await mintTestToken(claims());
      await expect(guard.canActivate(contextWith(token))).resolves.toBe(true);

      await service.resetPassword('reset-tok', 'a-new-password-1');

      await expect(guard.canActivate(contextWith(token))).rejects.toMatchObject(
        { response: expect.objectContaining({ error: 'SESSION_REVOKED' }) }
      );
      expect(resetFake.refreshTokensOf(USER)).toEqual([]);
    });

    it('a token minted after the change (version 1) is accepted', async () => {
      await withSessionBump(prismaOf(fake), USER, async () => undefined);

      const token = await mintTestToken(claims({ sessionVersion: 1 }));
      await expect(
        guardFor(fake).canActivate(contextWith(token))
      ).resolves.toBe(true);
    });

    it('the token of someone else is not affected', async () => {
      await withSessionBump(prismaOf(fake), USER, async () => undefined);

      const token = await mintTestToken(
        claims({
          id: OTHER,
          sub: OTHER,
          email: 'bob@example.com',
          sessionVersion: 4,
        })
      );
      await expect(
        guardFor(fake).canActivate(contextWith(token))
      ).resolves.toBe(true);
    });
  });
});
