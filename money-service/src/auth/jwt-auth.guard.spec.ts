import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import hkdf from '@panva/hkdf';
import { EncryptJWT } from 'jose';

import type { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard, AuthenticatedRequest } from './jwt-auth.guard';
import {
  clearUserActiveCache,
  forgetSessionState,
  judgeSession,
} from './user-active.util';

const TEST_SECRET = 'test-nextauth-secret-value-not-real';
const HOUR = 3600;
const nowSec = (): number => Math.floor(Date.now() / 1000);

// Mirrors next-auth/jwt's own encode() (verified against the real function
// in Session 3-1's F7 round-trip check, DECISION-LOG.md) without depending
// on the next-auth package in this service.
async function mintTestToken(
  claims: Record<string, unknown>,
  secret = TEST_SECRET,
  opts: { expiresInSeconds?: number } = {}
): Promise<string> {
  const key = await hkdf(
    'sha256',
    secret,
    '',
    'NextAuth.js Generated Encryption Key',
    32
  );
  const expiresIn = opts.expiresInSeconds ?? 30 * 24 * 60 * 60;
  return new EncryptJWT(claims)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn)
    .encrypt(key);
}

function contextWithAuthHeader(header?: string): ExecutionContext {
  const request: Partial<AuthenticatedRequest> = {
    headers: header ? { authorization: header } : {},
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

/** What the session-state read selects (CODE-02A): what the database says about a user now. */
function stateRow(overrides: Record<string, unknown> = {}) {
  return {
    isActive: true,
    deletedAt: null,
    sessionVersion: 0,
    role: 'USER',
    tier: 'PRO',
    ...overrides,
  };
}

describe('JwtAuthGuard', () => {
  const originalSecret = process.env['NEXTAUTH_SECRET'];
  const originalNodeEnv = process.env['NODE_ENV'];
  const findUnique = jest.fn();

  function makeGuard(): JwtAuthGuard {
    return new JwtAuthGuard({
      user: { findUnique },
    } as unknown as PrismaService);
  }

  beforeEach(() => {
    process.env['NEXTAUTH_SECRET'] = TEST_SECRET;
    findUnique.mockReset();
    findUnique.mockResolvedValue(stateRow());
    clearUserActiveCache();
  });

  afterEach(() => {
    process.env['NODE_ENV'] = originalNodeEnv;
  });

  afterAll(() => {
    process.env['NEXTAUTH_SECRET'] = originalSecret;
  });

  it('lets a valid token through and attaches the correct claims to the request', async () => {
    const guard = makeGuard();
    const token = await mintTestToken({
      sub: 'user-1',
      id: 'user-1',
      email: 'alice@example.com',
      tier: 'PRO',
      role: 'USER',
      isAffiliate: true,
    });

    const request: Partial<AuthenticatedRequest> = {
      headers: { authorization: `Bearer ${token}` },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual({
      id: 'user-1',
      email: 'alice@example.com',
      tier: 'PRO',
      role: 'USER',
      isAffiliate: true,
    });
  });

  it('rejects a request with no Authorization header (401, not a silent pass-through)', async () => {
    const guard = makeGuard();
    await expect(guard.canActivate(contextWithAuthHeader())).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('rejects a non-Bearer Authorization header', async () => {
    const guard = makeGuard();
    await expect(
      guard.canActivate(contextWithAuthHeader('Basic sometoken'))
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a malformed token (401, not a 500)', async () => {
    const guard = makeGuard();
    await expect(
      guard.canActivate(contextWithAuthHeader('Bearer not-a-real-jwe'))
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token encrypted with a different secret', async () => {
    const guard = makeGuard();
    const token = await mintTestToken(
      {
        sub: 'user-1',
        id: 'user-1',
        email: 'alice@example.com',
        tier: 'PRO',
        role: 'USER',
        isAffiliate: false,
      },
      'a-completely-different-secret'
    );

    await expect(
      guard.canActivate(contextWithAuthHeader(`Bearer ${token}`))
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an expired token', async () => {
    const guard = makeGuard();
    const token = await mintTestToken(
      {
        sub: 'user-1',
        id: 'user-1',
        email: 'alice@example.com',
        tier: 'PRO',
        role: 'USER',
        isAffiliate: false,
      },
      TEST_SECRET,
      { expiresInSeconds: -60 }
    );

    await expect(
      guard.canActivate(contextWithAuthHeader(`Bearer ${token}`))
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a validly-decrypted token missing required claims', async () => {
    const guard = makeGuard();
    const token = await mintTestToken({ sub: 'user-1' }); // no id/email

    await expect(
      guard.canActivate(contextWithAuthHeader(`Bearer ${token}`))
    ).rejects.toThrow(UnauthorizedException);
  });

  it('does not touch the database for a token that fails to decode', async () => {
    await expect(
      makeGuard().canActivate(contextWithAuthHeader('Bearer not-a-real-jwe'))
    ).rejects.toThrow(UnauthorizedException);

    expect(findUnique).not.toHaveBeenCalled();
  });

  // CODE-02A: after decoding, the token is compared with the account behind it, as in
  // operation-service's guard (cached 30 s).
  describe('session state (CODE-02A)', () => {
    const claims = {
      sub: 'user-1',
      id: 'user-1',
      email: 'alice@example.com',
      tier: 'PRO',
      role: 'USER',
      isAffiliate: false,
    };

    async function request(
      tokenClaims: Record<string, unknown>
    ): Promise<{ result: Promise<boolean>; user: () => unknown }> {
      const token = await mintTestToken(tokenClaims);
      const req: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${token}` },
      };
      const context = {
        switchToHttp: () => ({ getRequest: () => req }),
      } as unknown as ExecutionContext;
      return {
        result: makeGuard().canActivate(context),
        user: () => req.user,
      };
    }

    it('reads exactly the five columns the check needs', async () => {
      const { result } = await request(claims);
      await result;

      expect(findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: {
          isActive: true,
          deletedAt: true,
          sessionVersion: true,
          role: true,
          tier: true,
        },
      });
    });

    it('answers 401 with ACCOUNT_DEACTIVATED for a locked account', async () => {
      findUnique.mockResolvedValue(stateRow({ isActive: false }));
      const { result } = await request(claims);

      await expect(result).rejects.toThrow(UnauthorizedException);
      await expect(result).rejects.toMatchObject({
        response: expect.objectContaining({
          statusCode: 401,
          error: 'ACCOUNT_DEACTIVATED',
        }),
      });
    });

    it('answers 401 for a soft-deleted account', async () => {
      findUnique.mockResolvedValue(
        stateRow({ deletedAt: new Date('2026-10-01') })
      );
      const { result } = await request(claims);

      await expect(result).rejects.toMatchObject({
        response: expect.objectContaining({ error: 'ACCOUNT_DEACTIVATED' }),
      });
    });

    it('answers 401 with SESSION_REVOKED when the token is behind the database sessionVersion', async () => {
      findUnique.mockResolvedValue(stateRow({ sessionVersion: 1 }));
      const { result } = await request({ ...claims, sessionVersion: 0 });

      await expect(result).rejects.toMatchObject({
        response: expect.objectContaining({
          statusCode: 401,
          error: 'SESSION_REVOKED',
        }),
      });
    });

    it('accepts a token with no sessionVersion claim while the row is still 0, and a matching bumped one', async () => {
      const unclaimed = await request(claims);
      await expect(unclaimed.result).resolves.toBe(true);

      clearUserActiveCache();
      findUnique.mockResolvedValue(stateRow({ sessionVersion: 3 }));
      const matching = await request({ ...claims, sessionVersion: 3 });
      await expect(matching.result).resolves.toBe(true);
    });

    it('overwrites role and tier on the request from the database, whatever the token says', async () => {
      findUnique.mockResolvedValue(stateRow({ role: 'USER', tier: 'FREE' }));
      const { result, user } = await request({
        ...claims,
        role: 'ADMIN',
        tier: 'PRO',
        authTime: nowSec(),
      });

      await expect(result).resolves.toBe(true);
      expect(user()).toEqual({
        id: 'user-1',
        email: 'alice@example.com',
        tier: 'FREE',
        role: 'USER',
        isAffiliate: false,
      });
    });

    it('ends an ADMIN session 13 hours after sign-in, and keeps a USER session of the same age', async () => {
      findUnique.mockResolvedValue(stateRow({ role: 'ADMIN' }));
      const stale = await request({
        ...claims,
        role: 'ADMIN',
        authTime: nowSec() - 13 * HOUR,
      });
      await expect(stale.result).rejects.toMatchObject({
        response: expect.objectContaining({ error: 'SESSION_EXPIRED' }),
      });

      clearUserActiveCache();
      findUnique.mockResolvedValue(stateRow({ role: 'USER' }));
      const user = await request({ ...claims, authTime: nowSec() - 13 * HOUR });
      await expect(user.result).resolves.toBe(true);
    });

    it('keeps an ADMIN session that is 11 hours old, and ends one with no authTime at all', async () => {
      findUnique.mockResolvedValue(stateRow({ role: 'ADMIN' }));
      const fresh = await request({
        ...claims,
        role: 'ADMIN',
        authTime: nowSec() - 11 * HOUR,
      });
      await expect(fresh.result).resolves.toBe(true);

      clearUserActiveCache();
      const noAuthTime = await request({ ...claims, role: 'ADMIN' });
      await expect(noAuthTime.result).rejects.toMatchObject({
        response: expect.objectContaining({ error: 'SESSION_EXPIRED' }),
      });
    });

    it('lets the request through when the lookup fails (D-7), with the claims of the token', async () => {
      findUnique.mockRejectedValue(new Error('connection reset'));
      process.env['NODE_ENV'] = 'production';
      const { result, user } = await request({ ...claims, sessionVersion: 4 });

      await expect(result).resolves.toBe(true);
      expect(user()).toMatchObject({ role: 'USER', tier: 'PRO' });
    });

    it('rejects a token whose row is missing in production, and keeps one outside production (D-7)', async () => {
      findUnique.mockResolvedValue(null);
      process.env['NODE_ENV'] = 'production';
      const prod = await request(claims);
      await expect(prod.result).rejects.toMatchObject({
        response: expect.objectContaining({ error: 'ACCOUNT_DEACTIVATED' }),
      });

      process.env['NODE_ENV'] = 'test';
      const dev = await request(claims);
      await expect(dev.result).resolves.toBe(true);
    });

    it('asks the database once per user inside the 30 s window, and sees a bump once the snapshot is forgotten', async () => {
      const guard = makeGuard();
      const token = await mintTestToken({ ...claims, sessionVersion: 0 });
      const call = (): Promise<boolean> =>
        guard.canActivate(contextWithAuthHeader(`Bearer ${token}`));

      await call();
      await call();
      expect(findUnique).toHaveBeenCalledTimes(1);

      forgetSessionState('user-1');
      findUnique.mockResolvedValue(stateRow({ sessionVersion: 1 }));
      await expect(call()).rejects.toMatchObject({
        response: expect.objectContaining({ error: 'SESSION_REVOKED' }),
      });
    });
  });
});

// The same pure rules as the monolith's `judgeSession` (lib/auth/user-active.ts); a JWT cannot
// carry NaN or Infinity, so the non-finite `authTime` guard is only reachable here.
describe('judgeSession (CODE-02A)', () => {
  const admin = {
    isActive: true,
    deletedAt: null,
    sessionVersion: 0,
    role: 'ADMIN',
    tier: 'PRO',
  };
  const nowMs = 2_000_000_000_000;

  it('treats an authTime that is not a finite number as missing for an ADMIN', () => {
    for (const authTime of ['yesterday', NaN, Infinity, null, {}]) {
      expect(judgeSession({ authTime }, admin, { nowMs })).toEqual({
        ok: false,
        code: 'SESSION_EXPIRED',
      });
    }
  });

  it('ends an ADMIN session just past 12 hours and keeps one just inside', () => {
    const at = (seconds: number): number => Math.floor(nowMs / 1000) - seconds;

    expect(
      judgeSession({ authTime: at(12 * HOUR - 60) }, admin, { nowMs })
    ).toMatchObject({ ok: true });
    expect(
      judgeSession({ authTime: at(12 * HOUR + 60) }, admin, { nowMs })
    ).toEqual({ ok: false, code: 'SESSION_EXPIRED' });
  });

  it("lets the request through on 'error', and refuses 'missing' in production only", () => {
    expect(judgeSession({}, 'error', { production: true })).toEqual({
      ok: true,
      state: null,
    });
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
