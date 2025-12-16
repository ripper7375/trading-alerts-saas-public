/**
 * Unit Tests: Permission System
 * Tests all permission utilities in lib/auth/permissions.ts
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

import { AuthError } from '@/lib/auth/errors';

// Mock session module with a wrapper before any imports
const mockGetSession = jest.fn();

jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  getSession: () => mockGetSession(),
}));

import {
  TIER_PERMISSIONS,
  AFFILIATE_PERMISSIONS,
  ADMIN_PERMISSIONS,
  hasPermission,
  checkFeatureAccess,
  requirePro,
  getUserPermissions,
  hasAllPermissions,
  hasAnyPermission,
  validateMultiplePermissions,
  createPermissionMiddleware,
  createMultiplePermissionMiddleware,
  createAnyPermissionMiddleware,
} from '@/lib/auth/permissions';

describe('Permission System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockReset();
  });

  describe('Permission Constants', () => {
    describe('TIER_PERMISSIONS', () => {
      it('should define FREE tier permissions', () => {
        expect(TIER_PERMISSIONS.FREE).toContain('view_dashboard');
        expect(TIER_PERMISSIONS.FREE).toContain('create_alerts');
        expect(TIER_PERMISSIONS.FREE).toContain('view_watchlist');
        expect(TIER_PERMISSIONS.FREE).toContain('view_symbols');
        expect(TIER_PERMISSIONS.FREE).toContain('view_timeframes');
        expect(TIER_PERMISSIONS.FREE).toHaveLength(5);
      });

      it('should define PRO tier permissions', () => {
        expect(TIER_PERMISSIONS.PRO).toContain('view_dashboard');
        expect(TIER_PERMISSIONS.PRO).toContain('view_all_symbols');
        expect(TIER_PERMISSIONS.PRO).toContain('view_all_timeframes');
        expect(TIER_PERMISSIONS.PRO).toContain('export_data');
        expect(TIER_PERMISSIONS.PRO).toContain('priority_support');
        expect(TIER_PERMISSIONS.PRO.length).toBeGreaterThan(TIER_PERMISSIONS.FREE.length);
      });

      it('should include all FREE permissions in PRO', () => {
        TIER_PERMISSIONS.FREE.forEach((permission) => {
          expect(TIER_PERMISSIONS.PRO).toContain(permission);
        });
      });
    });

    describe('AFFILIATE_PERMISSIONS', () => {
      it('should define affiliate-specific permissions', () => {
        expect(AFFILIATE_PERMISSIONS).toContain('affiliate_dashboard');
        expect(AFFILIATE_PERMISSIONS).toContain('affiliate_codes');
        expect(AFFILIATE_PERMISSIONS).toContain('affiliate_commission_reports');
        expect(AFFILIATE_PERMISSIONS).toContain('affiliate_earnings');
      });
    });

    describe('ADMIN_PERMISSIONS', () => {
      it('should define admin-specific permissions', () => {
        expect(ADMIN_PERMISSIONS).toContain('admin_dashboard');
        expect(ADMIN_PERMISSIONS).toContain('admin_users');
        expect(ADMIN_PERMISSIONS).toContain('admin_settings');
        expect(ADMIN_PERMISSIONS).toContain('admin_billing');
      });
    });
  });

  describe('hasPermission', () => {
    describe('Tier-based permissions', () => {
      it('should allow FREE tier permissions for FREE users', () => {
        const user = { tier: 'FREE' as const };

        expect(hasPermission(user, 'view_dashboard')).toBe(true);
        expect(hasPermission(user, 'create_alerts')).toBe(true);
        expect(hasPermission(user, 'view_watchlist')).toBe(true);
      });

      it('should deny PRO-only permissions for FREE users', () => {
        const user = { tier: 'FREE' as const };

        expect(hasPermission(user, 'view_all_symbols')).toBe(false);
        expect(hasPermission(user, 'export_data')).toBe(false);
        expect(hasPermission(user, 'priority_support')).toBe(false);
      });

      it('should allow all tier permissions for PRO users', () => {
        const user = { tier: 'PRO' as const };

        expect(hasPermission(user, 'view_dashboard')).toBe(true);
        expect(hasPermission(user, 'view_all_symbols')).toBe(true);
        expect(hasPermission(user, 'export_data')).toBe(true);
      });

      it('should default to FREE tier when tier not specified', () => {
        const user = {};

        expect(hasPermission(user, 'view_dashboard')).toBe(true);
        expect(hasPermission(user, 'view_all_symbols')).toBe(false);
      });
    });

    describe('Affiliate permissions', () => {
      it('should allow affiliate permissions for affiliates', () => {
        const user = { tier: 'FREE' as const, isAffiliate: true };

        expect(hasPermission(user, 'affiliate_dashboard')).toBe(true);
        expect(hasPermission(user, 'affiliate_codes')).toBe(true);
        expect(hasPermission(user, 'affiliate_earnings')).toBe(true);
      });

      it('should deny affiliate permissions for non-affiliates', () => {
        const user = { tier: 'PRO' as const, isAffiliate: false };

        expect(hasPermission(user, 'affiliate_dashboard')).toBe(false);
        expect(hasPermission(user, 'affiliate_codes')).toBe(false);
      });
    });

    describe('Admin permissions', () => {
      it('should grant all permissions to admin', () => {
        const user = { role: 'ADMIN' };

        // Admin has all permissions
        expect(hasPermission(user, 'view_dashboard')).toBe(true);
        expect(hasPermission(user, 'view_all_symbols')).toBe(true);
        expect(hasPermission(user, 'admin_dashboard')).toBe(true);
        expect(hasPermission(user, 'admin_users')).toBe(true);
        expect(hasPermission(user, 'affiliate_dashboard')).toBe(true);
      });

      it('should deny admin permissions to non-admin', () => {
        const user = { tier: 'PRO' as const, role: 'USER' };

        expect(hasPermission(user, 'admin_dashboard')).toBe(false);
        expect(hasPermission(user, 'admin_users')).toBe(false);
      });
    });
  });

  describe('checkFeatureAccess', () => {
    it('should pass for authenticated user with permission', async () => {
      mockGetSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'FREE', role: 'USER' },
        expires: '2025-12-31',
      });

      await expect(checkFeatureAccess('view_dashboard')).resolves.toBeUndefined();
    });

    it('should throw AuthError for unauthenticated user', async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(checkFeatureAccess('view_dashboard')).rejects.toThrow(AuthError);
    });

    it('should throw AuthError when user lacks permission', async () => {
      mockGetSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'FREE', role: 'USER' },
        expires: '2025-12-31',
      });

      await expect(checkFeatureAccess('view_all_symbols')).rejects.toThrow(AuthError);
    });

    it('should provide user-friendly message for PRO features', async () => {
      mockGetSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'FREE', role: 'USER' },
        expires: '2025-12-31',
      });

      try {
        await checkFeatureAccess('view_all_symbols');
      } catch (error) {
        expect((error as AuthError).message).toContain('PRO subscription required');
      }
    });

    it('should provide user-friendly message for admin features', async () => {
      mockGetSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'PRO', role: 'USER' },
        expires: '2025-12-31',
      });

      try {
        await checkFeatureAccess('admin_dashboard');
      } catch (error) {
        expect((error as AuthError).message).toContain('Administrator access required');
      }
    });

    it('should provide user-friendly message for affiliate features', async () => {
      mockGetSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'PRO', role: 'USER', isAffiliate: false },
        expires: '2025-12-31',
      });

      try {
        await checkFeatureAccess('affiliate_dashboard');
      } catch (error) {
        expect((error as AuthError).message).toContain('Affiliate access required');
      }
    });
  });

  describe('requirePro', () => {
    it('should return session for PRO user', async () => {
      const mockSession = {
        user: { id: 'user-123', tier: 'PRO' },
        expires: '2025-12-31',
      };

      mockGetSession.mockResolvedValue(mockSession);

      const session = await requirePro();

      expect(session).toEqual(mockSession);
    });

    it('should throw AuthError for FREE user', async () => {
      mockGetSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'FREE' },
        expires: '2025-12-31',
      });

      await expect(requirePro()).rejects.toThrow(AuthError);
    });

    it('should throw AuthError for unauthenticated user', async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(requirePro()).rejects.toThrow(AuthError);
    });
  });

  describe('getUserPermissions', () => {
    it('should return FREE tier permissions for FREE user', () => {
      const user = { tier: 'FREE' as const };
      const permissions = getUserPermissions(user);

      expect(permissions).toEqual(expect.arrayContaining([...TIER_PERMISSIONS.FREE]));
      expect(permissions).not.toContain('view_all_symbols');
    });

    it('should return PRO tier permissions for PRO user', () => {
      const user = { tier: 'PRO' as const };
      const permissions = getUserPermissions(user);

      expect(permissions).toEqual(expect.arrayContaining([...TIER_PERMISSIONS.PRO]));
    });

    it('should include affiliate permissions for affiliate user', () => {
      const user = { tier: 'FREE' as const, isAffiliate: true };
      const permissions = getUserPermissions(user);

      expect(permissions).toEqual(
        expect.arrayContaining([...AFFILIATE_PERMISSIONS])
      );
    });

    it('should include admin permissions for admin user', () => {
      const user = { tier: 'FREE' as const, role: 'ADMIN' };
      const permissions = getUserPermissions(user);

      expect(permissions).toEqual(
        expect.arrayContaining([...ADMIN_PERMISSIONS])
      );
    });

    it('should return combined permissions for PRO affiliate admin', () => {
      const user = { tier: 'PRO' as const, role: 'ADMIN', isAffiliate: true };
      const permissions = getUserPermissions(user);

      expect(permissions).toEqual(
        expect.arrayContaining([...TIER_PERMISSIONS.PRO])
      );
      expect(permissions).toEqual(
        expect.arrayContaining([...AFFILIATE_PERMISSIONS])
      );
      expect(permissions).toEqual(
        expect.arrayContaining([...ADMIN_PERMISSIONS])
      );
    });

    it('should default to FREE tier when tier not specified', () => {
      const user = {};
      const permissions = getUserPermissions(user);

      expect(permissions).toEqual(expect.arrayContaining([...TIER_PERMISSIONS.FREE]));
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true when user has all permissions', () => {
      const user = { tier: 'PRO' as const };

      const result = hasAllPermissions(user, [
        'view_dashboard',
        'view_all_symbols',
      ]);

      expect(result).toBe(true);
    });

    it('should return false when user lacks any permission', () => {
      const user = { tier: 'FREE' as const };

      const result = hasAllPermissions(user, [
        'view_dashboard',
        'view_all_symbols',
      ]);

      expect(result).toBe(false);
    });

    it('should return true for empty permission array', () => {
      const user = { tier: 'FREE' as const };

      const result = hasAllPermissions(user, []);

      expect(result).toBe(true);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true when user has at least one permission', () => {
      const user = { tier: 'FREE' as const };

      const result = hasAnyPermission(user, [
        'view_dashboard',
        'view_all_symbols',
      ]);

      expect(result).toBe(true);
    });

    it('should return false when user has none of the permissions', () => {
      const user = { tier: 'FREE' as const };

      const result = hasAnyPermission(user, [
        'view_all_symbols',
        'export_data',
      ]);

      expect(result).toBe(false);
    });

    it('should return false for empty permission array', () => {
      const user = { tier: 'PRO' as const };

      const result = hasAnyPermission(user, []);

      expect(result).toBe(false);
    });
  });

  describe('validateMultiplePermissions', () => {
    it('should pass when user has all permissions', async () => {
      mockGetSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'PRO', role: 'USER' },
        expires: '2025-12-31',
      });

      await expect(
        validateMultiplePermissions(['view_dashboard', 'view_all_symbols'])
      ).resolves.toBeUndefined();
    });

    it('should throw AuthError when user lacks any permission', async () => {
      mockGetSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'FREE', role: 'USER' },
        expires: '2025-12-31',
      });

      await expect(
        validateMultiplePermissions(['view_dashboard', 'view_all_symbols'])
      ).rejects.toThrow(AuthError);
    });

    it('should list missing permissions in error message', async () => {
      mockGetSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'FREE', role: 'USER' },
        expires: '2025-12-31',
      });

      try {
        await validateMultiplePermissions(['view_all_symbols', 'export_data']);
      } catch (error) {
        expect((error as AuthError).message).toContain('view_all_symbols');
        expect((error as AuthError).message).toContain('export_data');
      }
    });

    it('should throw AuthError when not authenticated', async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(
        validateMultiplePermissions(['view_dashboard'])
      ).rejects.toThrow(AuthError);
    });
  });

  describe('Middleware Factories', () => {
    describe('createPermissionMiddleware', () => {
      it('should create middleware that checks single permission', async () => {
        mockGetSession.mockResolvedValue({
          user: { id: 'user-123', tier: 'PRO', role: 'USER' },
          expires: '2025-12-31',
        });

        const middleware = createPermissionMiddleware('view_all_symbols');

        await expect(middleware()).resolves.toBeUndefined();
      });

      it('should throw when permission is denied', async () => {
        mockGetSession.mockResolvedValue({
          user: { id: 'user-123', tier: 'FREE', role: 'USER' },
          expires: '2025-12-31',
        });

        const middleware = createPermissionMiddleware('view_all_symbols');

        await expect(middleware()).rejects.toThrow(AuthError);
      });
    });

    describe('createMultiplePermissionMiddleware', () => {
      it('should create middleware that checks all permissions', async () => {
        mockGetSession.mockResolvedValue({
          user: { id: 'user-123', tier: 'PRO', role: 'USER' },
          expires: '2025-12-31',
        });

        const middleware = createMultiplePermissionMiddleware([
          'view_dashboard',
          'view_all_symbols',
        ]);

        await expect(middleware()).resolves.toBeUndefined();
      });

      it('should throw when any permission is denied', async () => {
        mockGetSession.mockResolvedValue({
          user: { id: 'user-123', tier: 'FREE', role: 'USER' },
          expires: '2025-12-31',
        });

        const middleware = createMultiplePermissionMiddleware([
          'view_dashboard',
          'view_all_symbols',
        ]);

        await expect(middleware()).rejects.toThrow(AuthError);
      });
    });

    describe('createAnyPermissionMiddleware', () => {
      it('should pass when user has at least one permission', async () => {
        mockGetSession.mockResolvedValue({
          user: { id: 'user-123', tier: 'FREE', role: 'USER' },
          expires: '2025-12-31',
        });

        const middleware = createAnyPermissionMiddleware([
          'view_dashboard',
          'view_all_symbols',
        ]);

        await expect(middleware()).resolves.toBeUndefined();
      });

      it('should throw when user has none of the permissions', async () => {
        mockGetSession.mockResolvedValue({
          user: { id: 'user-123', tier: 'FREE', role: 'USER' },
          expires: '2025-12-31',
        });

        const middleware = createAnyPermissionMiddleware([
          'view_all_symbols',
          'export_data',
        ]);

        await expect(middleware()).rejects.toThrow(AuthError);
      });

      it('should throw when not authenticated', async () => {
        mockGetSession.mockResolvedValue(null);

        const middleware = createAnyPermissionMiddleware(['view_dashboard']);

        await expect(middleware()).rejects.toThrow(AuthError);
      });
    });
  });
});
