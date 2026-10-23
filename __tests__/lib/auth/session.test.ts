/**
 * Unit Tests: Session Helper Functions
 * Tests all session utilities in lib/auth/session.ts
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

import { AuthError } from '@/lib/auth/errors';

// Mock Prisma BEFORE any imports that use it
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    affiliateProfile: { findUnique: jest.fn() },
  },
}));

// Mock the getServerSession from next-auth
const mockGetServerSession = jest.fn();

jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

// Mock auth-options to avoid loading the full auth configuration
jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));

import { prisma } from '@/lib/db/prisma';
import { clearUserActiveCache } from '@/lib/auth/user-active';

const mockFindUnique = prisma.user.findUnique as unknown as jest.Mock;

/** What the database holds for one account; only the selected columns come back, like the client. */
function accountRow(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: 'admin-1',
    isActive: true,
    deletedAt: null,
    sessionVersion: 0,
    role: 'ADMIN',
    tier: 'PRO',
    twoFactorEnabled: true,
    ...overrides,
  };
}

function serveAccount(row: Record<string, unknown> | null): void {
  mockFindUnique.mockImplementation(
    async (args: { select: Record<string, boolean> }) => {
      if (!row) return null;
      return Object.fromEntries(
        Object.entries(args.select)
          .filter(([, wanted]) => wanted)
          .map(([column]) => [column, row[column]])
      );
    }
  );
}

// Import after mocks are set up
import {
  getSession,
  requireAuth,
  getUserSession,
  getUserTier,
  isAffiliate,
  requireAffiliate,
  getAffiliateProfile,
  isAdmin,
  requireAdmin,
  hasAnyRole,
  hasAllRoles,
  requireAnyRole,
} from '@/lib/auth/session';

describe('Session Helper Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockReset();
  });

  describe('getSession', () => {
    it('should return session when authenticated', async () => {
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          tier: 'FREE',
          role: 'USER',
          isAffiliate: false,
        },
        expires: '2025-12-31',
      };

      mockGetServerSession.mockResolvedValue(mockSession);

      const session = await getSession();

      expect(session).toEqual(mockSession);
      expect(mockGetServerSession).toHaveBeenCalledTimes(1);
    });

    it('should return null when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const session = await getSession();

      expect(session).toBeNull();
    });

    it('should return null on error', async () => {
      mockGetServerSession.mockRejectedValue(new Error('Session error'));

      const session = await getSession();

      expect(session).toBeNull();
    });
  });

  describe('requireAuth', () => {
    it('should return session when authenticated', async () => {
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          tier: 'FREE',
        },
        expires: '2025-12-31',
      };

      mockGetServerSession.mockResolvedValue(mockSession);

      const session = await requireAuth();

      expect(session).toEqual(mockSession);
    });

    it('should throw AuthError when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      await expect(requireAuth()).rejects.toThrow(AuthError);

      try {
        mockGetServerSession.mockResolvedValue(null);
        await requireAuth();
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).code).toBe('UNAUTHORIZED');
        expect((error as AuthError).statusCode).toBe(401);
      }
    });

    it('should throw AuthError when session has no user id', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: 'test@example.com' },
        expires: '2025-12-31',
      });

      await expect(requireAuth()).rejects.toThrow(AuthError);
    });

    it('should throw AuthError on session error', async () => {
      mockGetServerSession.mockRejectedValue(new Error('Session failed'));

      await expect(requireAuth()).rejects.toThrow(AuthError);
    });
  });

  describe('getUserSession', () => {
    it('should return session when authenticated', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        expires: '2025-12-31',
      };

      mockGetServerSession.mockResolvedValue(mockSession);

      const session = await getUserSession();

      expect(session).toEqual(mockSession);
    });

    it('should return null when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const session = await getUserSession();

      expect(session).toBeNull();
    });

    it('should return null on error', async () => {
      mockGetServerSession.mockRejectedValue(new Error('Error'));

      const session = await getUserSession();

      expect(session).toBeNull();
    });
  });

  describe('getUserTier', () => {
    it('should return user tier when authenticated', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'PRO' },
        expires: '2025-12-31',
      });

      const tier = await getUserTier();

      expect(tier).toBe('PRO');
    });

    it('should return FREE when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const tier = await getUserTier();

      expect(tier).toBe('FREE');
    });

    it('should return FREE when tier is not set', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123' },
        expires: '2025-12-31',
      });

      const tier = await getUserTier();

      expect(tier).toBe('FREE');
    });

    it('should return FREE on error', async () => {
      mockGetServerSession.mockRejectedValue(new Error('Error'));

      const tier = await getUserTier();

      expect(tier).toBe('FREE');
    });
  });

  describe('isAffiliate', () => {
    it('should return true when user is affiliate', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', isAffiliate: true },
        expires: '2025-12-31',
      });

      const result = await isAffiliate();

      expect(result).toBe(true);
    });

    it('should return false when user is not affiliate', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', isAffiliate: false },
        expires: '2025-12-31',
      });

      const result = await isAffiliate();

      expect(result).toBe(false);
    });

    it('should return false when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const result = await isAffiliate();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockGetServerSession.mockRejectedValue(new Error('Error'));

      const result = await isAffiliate();

      expect(result).toBe(false);
    });
  });

  describe('requireAffiliate', () => {
    it('should return session when user is affiliate', async () => {
      const mockSession = {
        user: { id: 'user-123', isAffiliate: true },
        expires: '2025-12-31',
      };

      mockGetServerSession.mockResolvedValue(mockSession);

      const session = await requireAffiliate();

      expect(session).toEqual(mockSession);
    });

    it('should throw AuthError when user is not affiliate', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', isAffiliate: false },
        expires: '2025-12-31',
      });

      await expect(requireAffiliate()).rejects.toThrow(AuthError);

      try {
        mockGetServerSession.mockResolvedValue({
          user: { id: 'user-123', isAffiliate: false },
          expires: '2025-12-31',
        });
        await requireAffiliate();
      } catch (error) {
        expect((error as AuthError).code).toBe('AFFILIATE_REQUIRED');
        expect((error as AuthError).statusCode).toBe(403);
      }
    });

    it('should throw AuthError when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      await expect(requireAffiliate()).rejects.toThrow(AuthError);
    });
  });

  describe('getAffiliateProfile', () => {
    it('should return null when user is not affiliate', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', isAffiliate: false },
        expires: '2025-12-31',
      });

      const profile = await getAffiliateProfile();

      expect(profile).toBeNull();
    });

    it('should return null when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const profile = await getAffiliateProfile();

      expect(profile).toBeNull();
    });

    it('should return profile from database for affiliate user', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', isAffiliate: true },
        expires: '2025-12-31',
      });

      const profile = await getAffiliateProfile();

      // Returns undefined when mock doesn't set return value (null if not found in real DB)
      expect(profile).toBeFalsy();
    });
  });

  describe('isAdmin', () => {
    it('should return true when user is admin', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', role: 'ADMIN' },
        expires: '2025-12-31',
      });

      const result = await isAdmin();

      expect(result).toBe(true);
    });

    it('should return false when user is not admin', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', role: 'USER' },
        expires: '2025-12-31',
      });

      const result = await isAdmin();

      expect(result).toBe(false);
    });

    it('should return false when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const result = await isAdmin();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockGetServerSession.mockRejectedValue(new Error('Error'));

      const result = await isAdmin();

      expect(result).toBe(false);
    });
  });

  describe('requireAdmin', () => {
    beforeEach(() => {
      mockFindUnique.mockReset();
      clearUserActiveCache();
    });

    it('should return session when user is admin and has two-factor authentication', async () => {
      const mockSession = {
        user: { id: 'user-123', role: 'ADMIN' },
        expires: '2025-12-31',
      };

      mockGetServerSession.mockResolvedValue(mockSession);
      serveAccount(accountRow({ role: 'ADMIN', twoFactorEnabled: true }));

      const session = await requireAdmin();

      expect(session).toEqual(mockSession);
    });

    it('should throw AuthError when user is not admin', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', role: 'USER' },
        expires: '2025-12-31',
      });

      await expect(requireAdmin()).rejects.toThrow(AuthError);

      try {
        mockGetServerSession.mockResolvedValue({
          user: { id: 'user-123', role: 'USER' },
          expires: '2025-12-31',
        });
        await requireAdmin();
      } catch (error) {
        expect((error as AuthError).code).toBe('ADMIN_REQUIRED');
        expect((error as AuthError).statusCode).toBe(403);
      }
    });

    it('should throw AuthError when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      await expect(requireAdmin()).rejects.toThrow(AuthError);
    });
  });

  // CODE-09 (WS-8): an ADMIN account without two-factor authentication is refused. The flag comes
  // from the same 30 s snapshot as the session version, role and tier (lib/auth/user-active.ts).
  describe('requireAdmin and two-factor authentication (CODE-09)', () => {
    const adminSession = (role = 'ADMIN') => ({
      user: { id: 'admin-1', role },
      expires: '2025-12-31',
    });

    async function refusal(): Promise<AuthError> {
      try {
        await requireAdmin();
      } catch (error) {
        return error as AuthError;
      }
      throw new Error('requireAdmin() did not refuse');
    }

    beforeEach(() => {
      mockFindUnique.mockReset();
      clearUserActiveCache();
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('refuses an ADMIN without two-factor authentication with 403 ADMIN_2FA_REQUIRED', async () => {
      mockGetServerSession.mockResolvedValue(adminSession());
      serveAccount(accountRow({ role: 'ADMIN', twoFactorEnabled: false }));

      const error = await refusal();

      expect(error).toBeInstanceOf(AuthError);
      expect(error.code).toBe('ADMIN_2FA_REQUIRED');
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe(
        'Two-factor authentication is required for administrator access'
      );
    });

    it('refuses a freshly promoted admin (stale USER claim, ADMIN in the database) who has no two-factor authentication', async () => {
      mockGetServerSession.mockResolvedValue(adminSession('USER'));
      serveAccount(accountRow({ role: 'ADMIN', twoFactorEnabled: false }));

      const error = await refusal();

      expect(error.code).toBe('ADMIN_2FA_REQUIRED');
      expect(error.statusCode).toBe(403);
    });

    it('does not promote the shared session to ADMIN in memory when it refuses, so later readers in the same render do not see an admin', async () => {
      const session = adminSession('USER');
      mockGetServerSession.mockResolvedValue(session);
      serveAccount(accountRow({ role: 'ADMIN', twoFactorEnabled: false }));

      await refusal();

      expect(session.user.role).toBe('USER');
    });

    it('lets a freshly promoted admin through once they have two-factor authentication, and promotes the session in memory', async () => {
      const session = adminSession('USER');
      mockGetServerSession.mockResolvedValue(session);
      serveAccount(accountRow({ role: 'ADMIN', twoFactorEnabled: true }));

      await expect(requireAdmin()).resolves.toBe(session);

      expect(session.user.role).toBe('ADMIN');
    });

    it('keeps the role check first: a USER without two-factor authentication gets ADMIN_REQUIRED, not the two-factor code', async () => {
      mockGetServerSession.mockResolvedValue(adminSession('USER'));
      serveAccount(accountRow({ role: 'USER', twoFactorEnabled: false }));

      const error = await refusal();

      expect(error.code).toBe('ADMIN_REQUIRED');
      expect(error.statusCode).toBe(403);
    });

    it('fails closed when the account state cannot be read: never returns the session', async () => {
      mockGetServerSession.mockResolvedValue(adminSession());
      mockFindUnique.mockRejectedValue(new Error('connection reset'));

      const error = await refusal();

      expect(error.code).toBe('ADMIN_ERROR');
      expect(error.statusCode).toBe(403);
    });

    it('refuses a token that claims ADMIN when the account no longer exists', async () => {
      mockGetServerSession.mockResolvedValue(adminSession());
      serveAccount(null);

      const error = await refusal();

      expect(error.code).toBe('ADMIN_REQUIRED');
      expect(error.statusCode).toBe(403);
    });

    it('treats a flag that is not exactly true as no two-factor authentication', async () => {
      mockGetServerSession.mockResolvedValue(adminSession());
      for (const flag of [undefined, null, 0, 'true', 1]) {
        clearUserActiveCache();
        serveAccount(accountRow({ role: 'ADMIN', twoFactorEnabled: flag }));

        const error = await refusal();

        expect(error.code).toBe('ADMIN_2FA_REQUIRED');
      }
    });

    it('asks the database once for the check inside the 30 s window', async () => {
      mockGetServerSession.mockResolvedValue(adminSession());
      serveAccount(accountRow({ role: 'ADMIN', twoFactorEnabled: true }));

      await requireAdmin();
      await requireAdmin();
      await requireAdmin();

      expect(mockFindUnique).toHaveBeenCalledTimes(1);
    });

    it('does not read the account for a signed-out visitor', async () => {
      mockGetServerSession.mockResolvedValue(null);

      await expect(requireAdmin()).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        statusCode: 401,
      });

      expect(mockFindUnique).not.toHaveBeenCalled();
    });
  });

  describe('hasAnyRole', () => {
    it('should return true when user has one of the roles', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', role: 'ADMIN' },
        expires: '2025-12-31',
      });

      const result = await hasAnyRole(['USER', 'ADMIN']);

      expect(result).toBe(true);
    });

    it('should return false when user has none of the roles', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', role: 'USER' },
        expires: '2025-12-31',
      });

      const result = await hasAnyRole(['ADMIN', 'MODERATOR']);

      expect(result).toBe(false);
    });

    it('should return false when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const result = await hasAnyRole(['USER', 'ADMIN']);

      expect(result).toBe(false);
    });
  });

  describe('hasAllRoles', () => {
    it('should return true when user has the matching role', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', role: 'ADMIN' },
        expires: '2025-12-31',
      });

      const result = await hasAllRoles(['ADMIN']);

      expect(result).toBe(true);
    });

    it('should return false when roles do not match', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', role: 'USER' },
        expires: '2025-12-31',
      });

      const result = await hasAllRoles(['ADMIN']);

      expect(result).toBe(false);
    });

    it('should return false when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const result = await hasAllRoles(['USER']);

      expect(result).toBe(false);
    });
  });

  describe('requireAnyRole', () => {
    it('should return session when user has one of the roles', async () => {
      const mockSession = {
        user: { id: 'user-123', role: 'ADMIN' },
        expires: '2025-12-31',
      };

      mockGetServerSession.mockResolvedValue(mockSession);

      const session = await requireAnyRole(['USER', 'ADMIN']);

      expect(session).toEqual(mockSession);
    });

    it('should throw AuthError when user has none of the roles', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', role: 'USER' },
        expires: '2025-12-31',
      });

      await expect(requireAnyRole(['ADMIN', 'MODERATOR'])).rejects.toThrow(
        AuthError
      );

      try {
        mockGetServerSession.mockResolvedValue({
          user: { id: 'user-123', role: 'USER' },
          expires: '2025-12-31',
        });
        await requireAnyRole(['ADMIN']);
      } catch (error) {
        expect((error as AuthError).code).toBe('INSUFFICIENT_ROLE');
        expect((error as AuthError).statusCode).toBe(403);
      }
    });

    it('should throw AuthError when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      await expect(requireAnyRole(['USER'])).rejects.toThrow(AuthError);
    });
  });
});
