/**
 * @jest-environment node
 */
/**
 * F21 (Option B): a user who confirmed an account deletion has `User.isActive = false` from that
 * moment, and every way back in is closed:
 *
 * - sign-in with a password answers ACCOUNT_DEACTIVATED (after the password check),
 * - OAuth sign-in is sent back to /login?error=ACCOUNT_DEACTIVATED,
 * - a session that already exists stops working on the next read (the `jwt` callback throws,
 *   which NextAuth turns into "no session" and a cleared cookie).
 */

import bcrypt from 'bcryptjs';

// jest.config.js maps every `next-auth/*` import to one stub that drops the options, so the
// credentials provider's `authorize` would be unreachable. Keep the options for this file.
jest.mock('next-auth/providers/credentials', () => ({
  __esModule: true,
  default: (options: { id: string }) => ({ id: options.id, options }),
}));

const mockUserFindUnique = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
  },
}));

import { authOptions } from '@/lib/auth/auth-options';
import { clearUserActiveCache, isUserActive } from '@/lib/auth/user-active';

type Authorize = (credentials: {
  email: string;
  password: string;
}) => Promise<unknown>;

function credentialsAuthorize(): Authorize {
  const provider = authOptions.providers.find((p) => p.id === 'credentials') as
    | { options: { authorize: Authorize } }
    | undefined;
  if (!provider) throw new Error('credentials provider missing');
  return provider.options.authorize;
}

async function runJwt(
  token: Record<string, unknown>,
  user?: Record<string, unknown>
): Promise<unknown> {
  const callback = authOptions.callbacks?.jwt;
  if (!callback) throw new Error('jwt callback missing');
  return callback({ token, user, trigger: undefined } as never);
}

describe('F21: deactivated accounts', () => {
  let consoleError: jest.SpyInstance;
  let consoleLog: jest.SpyInstance;
  let consoleWarn: jest.SpyInstance;

  beforeEach(() => {
    mockUserFindUnique.mockReset();
    clearUserActiveCache();
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
    consoleLog.mockRestore();
    consoleWarn.mockRestore();
  });

  describe('password sign-in (CredentialsProvider.authorize)', () => {
    async function userRow(overrides: Record<string, unknown> = {}) {
      return {
        id: 'user-1',
        email: 'alice@example.com',
        name: 'Alice',
        image: null,
        password: await bcrypt.hash('correct-password', 4),
        tier: 'FREE',
        role: 'USER',
        isAffiliate: false,
        isActive: true,
        emailVerified: new Date('2026-01-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
      };
    }

    it('answers ACCOUNT_DEACTIVATED to the right password on a deactivated account', async () => {
      mockUserFindUnique.mockResolvedValue(await userRow({ isActive: false }));

      await expect(
        credentialsAuthorize()({
          email: 'alice@example.com',
          password: 'correct-password',
        })
      ).rejects.toThrow('ACCOUNT_DEACTIVATED');
    });

    it('does not reveal a deactivated account to a wrong password', async () => {
      mockUserFindUnique.mockResolvedValue(await userRow({ isActive: false }));

      await expect(
        credentialsAuthorize()({
          email: 'alice@example.com',
          password: 'wrong-password',
        })
      ).rejects.toThrow('INVALID_CREDENTIALS');
    });

    it('still signs an active account in', async () => {
      mockUserFindUnique.mockResolvedValue(await userRow());

      await expect(
        credentialsAuthorize()({
          email: 'alice@example.com',
          password: 'correct-password',
        })
      ).resolves.toMatchObject({ id: 'user-1', isActive: true });
    });
  });

  describe('OAuth sign-in (signIn callback)', () => {
    const account = {
      provider: 'google',
      providerAccountId: 'g-1',
      type: 'oauth',
    };
    const oauthUser = { id: 'user-1', email: 'alice@example.com' };

    function runSignIn(): Promise<unknown> {
      const callback = authOptions.callbacks?.signIn;
      if (!callback) throw new Error('signIn callback missing');
      return callback({ user: oauthUser, account } as never);
    }

    it('sends a deactivated account back to /login with the code', async () => {
      mockUserFindUnique.mockResolvedValue({
        id: 'user-1',
        isActive: false,
        emailVerified: new Date(),
        accounts: [{ id: 'a' }],
        image: 'x',
      });

      await expect(runSignIn()).resolves.toBe(
        '/login?error=ACCOUNT_DEACTIVATED'
      );
    });

    it('lets an active account through', async () => {
      mockUserFindUnique.mockResolvedValue({
        id: 'user-1',
        isActive: true,
        emailVerified: new Date(),
        accounts: [{ id: 'a' }],
        image: 'x',
      });

      await expect(runSignIn()).resolves.toBe(true);
    });
  });

  describe('a session that already exists (jwt callback)', () => {
    const token = { id: 'user-1', email: 'alice@example.com' };

    it('throws once the account is deactivated, which NextAuth turns into no session', async () => {
      mockUserFindUnique.mockResolvedValue({ isActive: false });

      await expect(runJwt(token)).rejects.toThrow('ACCOUNT_DEACTIVATED');
      expect(mockUserFindUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { isActive: true },
      });
    });

    it('returns the token while the account is active, asking the database once per window', async () => {
      mockUserFindUnique.mockResolvedValue({ isActive: true });

      await expect(runJwt(token)).resolves.toMatchObject({ id: 'user-1' });
      await runJwt(token);
      await runJwt(token);

      expect(mockUserFindUnique).toHaveBeenCalledTimes(1);
    });

    it('reads a deactivated account again every time, so a cancelled deletion lets them back in', async () => {
      mockUserFindUnique.mockResolvedValueOnce({ isActive: false });
      await expect(runJwt(token)).rejects.toThrow('ACCOUNT_DEACTIVATED');

      mockUserFindUnique.mockResolvedValueOnce({ isActive: true });
      await expect(runJwt(token)).resolves.toMatchObject({ id: 'user-1' });
    });

    it('does not check at sign-in itself (the credentials and OAuth paths already did)', async () => {
      // The jwt callback's sign-in branch reads the row; it does not go through isUserActive.
      mockUserFindUnique.mockResolvedValue({
        id: 'user-1',
        email: 'alice@example.com',
        name: 'Alice',
        image: null,
        tier: 'FREE',
        role: 'USER',
        isAffiliate: false,
      });

      await expect(
        runJwt({}, { id: 'user-1', email: 'alice@example.com' })
      ).resolves.toMatchObject({ id: 'user-1' });
      expect(mockUserFindUnique).toHaveBeenCalledTimes(1);
      expect(mockUserFindUnique.mock.calls[0][0]).not.toEqual({
        where: { id: 'user-1' },
        select: { isActive: true },
      });
    });

    it('lets the session through when the lookup fails (a blip must not sign everyone out)', async () => {
      mockUserFindUnique.mockRejectedValue(new Error('connection reset'));

      await expect(runJwt(token)).resolves.toMatchObject({ id: 'user-1' });
    });

    it('lets the session through when the row is missing (dev test accounts with a made-up id)', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await expect(
        runJwt({ id: 'test-user-free-test-trading-alerts-test' })
      ).resolves.toMatchObject({
        id: 'test-user-free-test-trading-alerts-test',
      });
    });
  });

  describe('isUserActive', () => {
    it('does not cache a negative answer', async () => {
      mockUserFindUnique.mockResolvedValue({ isActive: false });

      await expect(isUserActive('user-1')).resolves.toBe(false);
      await expect(isUserActive('user-1')).resolves.toBe(false);

      expect(mockUserFindUnique).toHaveBeenCalledTimes(2);
    });

    it('forgets an answer after 30 seconds', async () => {
      jest.useFakeTimers({ now: 1_000_000 });
      try {
        mockUserFindUnique.mockResolvedValue({ isActive: true });
        await isUserActive('user-1');

        jest.setSystemTime(1_000_000 + 29_000);
        await isUserActive('user-1');
        expect(mockUserFindUnique).toHaveBeenCalledTimes(1);

        jest.setSystemTime(1_000_000 + 31_000);
        await isUserActive('user-1');
        expect(mockUserFindUnique).toHaveBeenCalledTimes(2);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
