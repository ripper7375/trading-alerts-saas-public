import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import hkdf from '@panva/hkdf';
import { EncryptJWT } from 'jose';

import type { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard, AuthenticatedRequest } from './jwt-auth.guard';
import { clearUserActiveCache } from './user-active.util';

const TEST_SECRET = 'test-nextauth-secret-value-not-real';

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

describe('JwtAuthGuard', () => {
  const originalSecret = process.env['NEXTAUTH_SECRET'];
  const findUnique = jest.fn();

  function makeGuard(): JwtAuthGuard {
    return new JwtAuthGuard({
      user: { findUnique },
    } as unknown as PrismaService);
  }

  beforeEach(() => {
    process.env['NEXTAUTH_SECRET'] = TEST_SECRET;
    findUnique.mockReset();
    findUnique.mockResolvedValue({ isActive: true });
    clearUserActiveCache();
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

  describe('deactivated accounts (F21)', () => {
    const claims = {
      sub: 'user-1',
      id: 'user-1',
      email: 'alice@example.com',
      tier: 'PRO',
      role: 'USER',
      isAffiliate: false,
    };

    it('rejects a valid token whose user is deactivated, with the ACCOUNT_DEACTIVATED code', async () => {
      findUnique.mockResolvedValue({ isActive: false });
      const token = await mintTestToken(claims);

      const attempt = makeGuard().canActivate(
        contextWithAuthHeader(`Bearer ${token}`)
      );

      await expect(attempt).rejects.toThrow(UnauthorizedException);
      await expect(attempt).rejects.toMatchObject({
        response: expect.objectContaining({ error: 'ACCOUNT_DEACTIVATED' }),
      });
      expect(findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { isActive: true },
      });
    });

    it('asks the database once per user inside the cache window', async () => {
      const guard = makeGuard();
      const token = await mintTestToken(claims);

      await guard.canActivate(contextWithAuthHeader(`Bearer ${token}`));
      await guard.canActivate(contextWithAuthHeader(`Bearer ${token}`));

      expect(findUnique).toHaveBeenCalledTimes(1);
    });

    it('re-reads a deactivated user every time, so a cancelled deletion lets them back in at once', async () => {
      findUnique.mockResolvedValueOnce({ isActive: false });
      const guard = makeGuard();
      const token = await mintTestToken(claims);

      await expect(
        guard.canActivate(contextWithAuthHeader(`Bearer ${token}`))
      ).rejects.toThrow(UnauthorizedException);

      findUnique.mockResolvedValueOnce({ isActive: true });
      await expect(
        guard.canActivate(contextWithAuthHeader(`Bearer ${token}`))
      ).resolves.toBe(true);
    });

    it('lets the request through when the lookup fails (a database blip must not sign everyone out)', async () => {
      findUnique.mockRejectedValue(new Error('connection reset'));
      const token = await mintTestToken(claims);

      await expect(
        makeGuard().canActivate(contextWithAuthHeader(`Bearer ${token}`))
      ).resolves.toBe(true);
    });

    it('lets the request through when the row is not found (the F58 flaky id lookup)', async () => {
      findUnique.mockResolvedValue(null);
      const token = await mintTestToken(claims);

      await expect(
        makeGuard().canActivate(contextWithAuthHeader(`Bearer ${token}`))
      ).resolves.toBe(true);
    });

    it('does not touch the database for a token that fails to decode', async () => {
      await expect(
        makeGuard().canActivate(contextWithAuthHeader('Bearer not-a-real-jwe'))
      ).rejects.toThrow(UnauthorizedException);

      expect(findUnique).not.toHaveBeenCalled();
    });
  });
});
