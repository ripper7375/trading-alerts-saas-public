/**
 * Unit Tests: Session Helper Functions
 * Tests all session utilities in lib/auth/session.ts
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

import { AuthError } from '@/lib/auth/errors';

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

    it('should return null (placeholder) for affiliate user', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', isAffiliate: true },
        expires: '2025-12-31',
      });

      const profile = await getAffiliateProfile();

      // Currently returns null as placeholder (TODO in code)
      expect(profile).toBeNull();
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
    it('should return session when user is admin', async () => {
      const mockSession = {
        user: { id: 'user-123', role: 'ADMIN' },
        expires: '2025-12-31',
      };

      mockGetServerSession.mockResolvedValue(mockSession);

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
