import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import hkdf from '@panva/hkdf';
import { EncryptJWT } from 'jose';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { clearUserActiveCache } from '../auth/user-active.util';
import type { PrismaService } from '../prisma/prisma.service';

import { AdminGuard } from './admin.guard';

function contextWithUser(
  user?: Partial<AuthenticatedRequest['user']>
): ExecutionContext {
  const request: Partial<AuthenticatedRequest> = { user: user as never };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  it('allows a request whose user has role ADMIN', () => {
    const guard = new AdminGuard();
    expect(guard.canActivate(contextWithUser({ role: 'ADMIN' }))).toBe(true);
  });

  it('rejects a non-admin user with the exact source 403 body', () => {
    const guard = new AdminGuard();
    try {
      guard.canActivate(contextWithUser({ role: 'USER' }));
      fail('expected ForbiddenException');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toEqual({
        error: 'You must be an administrator to access this resource',
      });
      expect((error as ForbiddenException).getStatus()).toBe(403);
    }
  });

  it('rejects when request.user is undefined', () => {
    const guard = new AdminGuard();
    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(
      ForbiddenException
    );
  });
});

// CODE-02A: AdminGuard reads `request.user.role`, which JwtAuthGuard takes from the database
// (cached 30 s), not from the token. The two guards, run the way a controller runs them, refuse an
// account that is no longer an admin with the exact 403 body.
describe('JwtAuthGuard followed by AdminGuard (an account that is no longer an admin)', () => {
  const SECRET = 'test-nextauth-secret-value-not-real';
  const originalSecret = process.env['NEXTAUTH_SECRET'];
  const findUnique = jest.fn();

  async function adminBearerContext(): Promise<ExecutionContext> {
    const key = await hkdf(
      'sha256',
      SECRET,
      '',
      'NextAuth.js Generated Encryption Key',
      32
    );
    const token = await new EncryptJWT({
      sub: 'admin-1',
      id: 'admin-1',
      email: 'admin@example.com',
      tier: 'PRO',
      role: 'ADMIN',
      isAffiliate: false,
      authTime: Math.floor(Date.now() / 1000),
    })
      .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
      .encrypt(key);
    const request: Partial<AuthenticatedRequest> = {
      headers: { authorization: `Bearer ${token}` },
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  async function runBoth(context: ExecutionContext): Promise<boolean> {
    const jwtGuard = new JwtAuthGuard({
      user: { findUnique },
    } as unknown as PrismaService);
    await jwtGuard.canActivate(context);
    return new AdminGuard().canActivate(context);
  }

  beforeEach(() => {
    process.env['NEXTAUTH_SECRET'] = SECRET;
    findUnique.mockReset();
    clearUserActiveCache();
  });

  afterAll(() => {
    process.env['NEXTAUTH_SECRET'] = originalSecret;
  });

  it('lets an admin through while the database still says ADMIN', async () => {
    findUnique.mockResolvedValue({
      isActive: true,
      deletedAt: null,
      sessionVersion: 0,
      role: 'ADMIN',
      tier: 'PRO',
    });

    await expect(runBoth(await adminBearerContext())).resolves.toBe(true);
  });

  it('answers 403 with the exact source body once the database says USER', async () => {
    findUnique.mockResolvedValue({
      isActive: true,
      deletedAt: null,
      sessionVersion: 0,
      role: 'USER',
      tier: 'PRO',
    });

    const attempt = runBoth(await adminBearerContext());

    await expect(attempt).rejects.toBeInstanceOf(ForbiddenException);
    await expect(attempt).rejects.toMatchObject({
      response: {
        error: 'You must be an administrator to access this resource',
      },
      status: 403,
    });
  });

  it('answers 401 before AdminGuard runs when the account was locked', async () => {
    findUnique.mockResolvedValue({
      isActive: false,
      deletedAt: null,
      sessionVersion: 0,
      role: 'ADMIN',
      tier: 'PRO',
    });

    await expect(runBoth(await adminBearerContext())).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });
});
