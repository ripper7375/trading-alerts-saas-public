import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import hkdf from '@panva/hkdf';
import { EncryptJWT } from 'jose';

import { JwtAuthGuard, AuthenticatedRequest } from './jwt-auth.guard';

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

  beforeEach(() => {
    process.env['NEXTAUTH_SECRET'] = TEST_SECRET;
  });

  afterAll(() => {
    process.env['NEXTAUTH_SECRET'] = originalSecret;
  });

  it('lets a valid token through and attaches the correct claims to the request', async () => {
    const guard = new JwtAuthGuard();
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
    const guard = new JwtAuthGuard();
    await expect(guard.canActivate(contextWithAuthHeader())).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('rejects a non-Bearer Authorization header', async () => {
    const guard = new JwtAuthGuard();
    await expect(
      guard.canActivate(contextWithAuthHeader('Basic sometoken'))
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a malformed token (401, not a 500)', async () => {
    const guard = new JwtAuthGuard();
    await expect(
      guard.canActivate(contextWithAuthHeader('Bearer not-a-real-jwe'))
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token encrypted with a different secret', async () => {
    const guard = new JwtAuthGuard();
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
    const guard = new JwtAuthGuard();
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
    const guard = new JwtAuthGuard();
    const token = await mintTestToken({ sub: 'user-1' }); // no id/email

    await expect(
      guard.canActivate(contextWithAuthHeader(`Bearer ${token}`))
    ).rejects.toThrow(UnauthorizedException);
  });
});
