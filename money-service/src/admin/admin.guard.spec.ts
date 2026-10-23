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

const ADMIN_BODY = {
  error: 'You must be an administrator to access this resource',
};
const TWO_FACTOR_BODY = {
  error: 'Two-factor authentication is required for administrator access',
  code: 'ADMIN_2FA_REQUIRED',
};
const UNVERIFIABLE_BODY = {
  error: 'Unable to verify administrator status',
  code: 'ADMIN_ERROR',
};

function contextWithUser(
  user?: Partial<AuthenticatedRequest['user']>
): ExecutionContext {
  const request: Partial<AuthenticatedRequest> = { user: user as never };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

/** What the database holds for one account (the columns of user-active.util.ts). */
function accountRow(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    isActive: true,
    deletedAt: null,
    sessionVersion: 0,
    role: 'ADMIN',
    tier: 'PRO',
    twoFactorEnabled: true,
    ...overrides,
  };
}

async function refusalOf(
  attempt: Promise<boolean>
): Promise<ForbiddenException> {
  try {
    await attempt;
  } catch (error) {
    expect(error).toBeInstanceOf(ForbiddenException);
    return error as ForbiddenException;
  }
  throw new Error('the guard did not refuse');
}

describe('AdminGuard', () => {
  const findUnique = jest.fn();
  const prisma = { user: { findUnique } } as unknown as PrismaService;
  const makeGuard = (): AdminGuard => new AdminGuard(prisma);

  beforeEach(() => {
    findUnique.mockReset();
    clearUserActiveCache();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows a request whose user has role ADMIN and an account with two-factor authentication', async () => {
    findUnique.mockResolvedValue(accountRow());

    await expect(
      makeGuard().canActivate(contextWithUser({ id: 'admin-1', role: 'ADMIN' }))
    ).resolves.toBe(true);
  });

  it('rejects a non-admin user with the exact source 403 body, without reading the database', async () => {
    const error = await refusalOf(
      makeGuard().canActivate(contextWithUser({ id: 'user-1', role: 'USER' }))
    );

    expect(error.getResponse()).toEqual(ADMIN_BODY);
    expect(error.getStatus()).toBe(403);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects when request.user is undefined, without reading the database', async () => {
    await expect(
      makeGuard().canActivate(contextWithUser(undefined))
    ).rejects.toThrow(ForbiddenException);

    expect(findUnique).not.toHaveBeenCalled();
  });

  // CODE-09 (WS-8): an ADMIN account without two-factor authentication is refused with 403.
  describe('an admin without two-factor authentication (CODE-09)', () => {
    it('is refused with 403 and ADMIN_2FA_REQUIRED', async () => {
      findUnique.mockResolvedValue(accountRow({ twoFactorEnabled: false }));

      const error = await refusalOf(
        makeGuard().canActivate(
          contextWithUser({ id: 'admin-1', role: 'ADMIN' })
        )
      );

      expect(error.getStatus()).toBe(403);
      expect(error.getResponse()).toEqual(TWO_FACTOR_BODY);
    });

    it('is told apart from a non-admin: the body is not the source administrator body', async () => {
      findUnique.mockResolvedValue(accountRow({ twoFactorEnabled: false }));

      const error = await refusalOf(
        makeGuard().canActivate(
          contextWithUser({ id: 'admin-1', role: 'ADMIN' })
        )
      );

      expect(error.getResponse()).not.toEqual(ADMIN_BODY);
    });

    it('reads the flag of the account behind the request user, from the 30 s snapshot', async () => {
      findUnique.mockResolvedValue(accountRow());
      const guard = makeGuard();
      const admin = contextWithUser({ id: 'admin-1', role: 'ADMIN' });

      await guard.canActivate(admin);
      await guard.canActivate(admin);

      expect(findUnique).toHaveBeenCalledTimes(1);
      expect(findUnique).toHaveBeenCalledWith({
        where: { id: 'admin-1' },
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

    it('treats a flag that is not exactly true as no two-factor authentication', async () => {
      for (const flag of [undefined, null, 0, 'true', 1]) {
        clearUserActiveCache();
        findUnique.mockResolvedValue(accountRow({ twoFactorEnabled: flag }));

        const error = await refusalOf(
          makeGuard().canActivate(
            contextWithUser({ id: 'admin-1', role: 'ADMIN' })
          )
        );

        expect(error.getResponse()).toEqual(TWO_FACTOR_BODY);
      }
    });

    it('fails closed when the account state cannot be read', async () => {
      findUnique.mockRejectedValue(new Error('connection reset'));

      const error = await refusalOf(
        makeGuard().canActivate(
          contextWithUser({ id: 'admin-1', role: 'ADMIN' })
        )
      );

      expect(error.getStatus()).toBe(403);
      expect(error.getResponse()).toEqual(UNVERIFIABLE_BODY);
    });

    it('refuses a request user that claims ADMIN for an account that no longer exists', async () => {
      findUnique.mockResolvedValue(null);

      const error = await refusalOf(
        makeGuard().canActivate(contextWithUser({ id: 'ghost', role: 'ADMIN' }))
      );

      expect(error.getStatus()).toBe(403);
      expect(error.getResponse()).toEqual(ADMIN_BODY);
    });
  });
});

// CODE-02A: AdminGuard reads `request.user.role`, which JwtAuthGuard takes from the database
// (cached 30 s), not from the token. The two guards, run the way a controller runs them, refuse an
// account that is no longer an admin with the exact 403 body. CODE-09: and an admin without
// two-factor authentication, with ADMIN_2FA_REQUIRED, from the same one read of the account.
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
    const prisma = { user: { findUnique } } as unknown as PrismaService;
    await new JwtAuthGuard(prisma).canActivate(context);
    return new AdminGuard(prisma).canActivate(context);
  }

  beforeEach(() => {
    process.env['NEXTAUTH_SECRET'] = SECRET;
    findUnique.mockReset();
    clearUserActiveCache();
  });

  afterAll(() => {
    process.env['NEXTAUTH_SECRET'] = originalSecret;
  });

  it('lets an admin through while the database still says ADMIN and the account has two-factor authentication', async () => {
    findUnique.mockResolvedValue(accountRow());

    await expect(runBoth(await adminBearerContext())).resolves.toBe(true);
  });

  it('reads the account once for both guards', async () => {
    findUnique.mockResolvedValue(accountRow());

    await runBoth(await adminBearerContext());

    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('answers 403 with ADMIN_2FA_REQUIRED for an admin without two-factor authentication', async () => {
    findUnique.mockResolvedValue(accountRow({ twoFactorEnabled: false }));

    const attempt = runBoth(await adminBearerContext());

    await expect(attempt).rejects.toBeInstanceOf(ForbiddenException);
    await expect(attempt).rejects.toMatchObject({
      response: TWO_FACTOR_BODY,
      status: 403,
    });
  });

  it('answers 403 with the exact source body once the database says USER', async () => {
    findUnique.mockResolvedValue(accountRow({ role: 'USER' }));

    const attempt = runBoth(await adminBearerContext());

    await expect(attempt).rejects.toBeInstanceOf(ForbiddenException);
    await expect(attempt).rejects.toMatchObject({
      response: ADMIN_BODY,
      status: 403,
    });
  });

  it('answers 401 before AdminGuard runs when the account was locked', async () => {
    findUnique.mockResolvedValue(accountRow({ isActive: false }));

    await expect(runBoth(await adminBearerContext())).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });
});
