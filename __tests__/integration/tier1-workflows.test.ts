/**
 * Integration Tests: Tier 1 Workflows
 * Tests cross-cutting workflows across Auth, Billing, Tier, and Database modules
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// Mock dependencies
const mockGetSession = jest.fn();
const mockUserUpdate = jest.fn();
const mockUserFindUnique = jest.fn();
const mockSubscriptionFindFirst = jest.fn();
const mockSubscriptionUpdate = jest.fn();
const mockSubscriptionUpsert = jest.fn();
const mockSendSubscriptionConfirmationEmail = jest.fn();
const mockSendSubscriptionCanceledEmail = jest.fn();

jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: (...args: unknown[]) => mockGetSession(...args),
}));

jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: {
      update: (...args: unknown[]) => mockUserUpdate(...args),
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    subscription: {
      findFirst: (...args: unknown[]) => mockSubscriptionFindFirst(...args),
      update: (...args: unknown[]) => mockSubscriptionUpdate(...args),
      upsert: (...args: unknown[]) => mockSubscriptionUpsert(...args),
    },
  },
}));

jest.mock('@/lib/email/subscription-emails', () => ({
  __esModule: true,
  sendSubscriptionCanceledEmail: (...args: unknown[]) =>
    mockSendSubscriptionCanceledEmail(...args),
  sendPaymentFailedEmail: jest.fn(),
  sendPaymentReceiptEmail: jest.fn(),
  sendAffiliateCommissionEmail: jest.fn(),
}));

jest.mock('@/lib/email/email', () => ({
  __esModule: true,
  sendSubscriptionConfirmationEmail: (...args: unknown[]) =>
    mockSendSubscriptionConfirmationEmail(...args),
}));

jest.mock('@/lib/affiliate/commission-calculator', () => ({
  __esModule: true,
  calculateFullBreakdown: jest.fn().mockReturnValue({
    grossRevenue: 29,
    discountAmount: 0,
    netRevenue: 29,
    commissionAmount: 5.8,
  }),
}));

jest.mock('@/lib/affiliate/constants', () => ({
  __esModule: true,
  AFFILIATE_CONFIG: {
    BASE_PRICE_USD: 29,
  },
}));

// Import after mocks
import { hasPermission, getUserPermissions } from '@/lib/auth/permissions';
import {
  validateTierAccess,
  canAccessSymbol,
  canCreateAlert,
} from '@/lib/tier-validation';
import { FREE_TIER_CONFIG, PRO_TIER_CONFIG } from '@/lib/tier-config';
import {
  handleCheckoutCompleted,
  handleSubscriptionDeleted,
} from '@/lib/stripe/webhook-handlers';
import type Stripe from 'stripe';

describe('Tier 1 Integration: Auth + Tier + Permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Workflow 1: User Registration → Tier Assignment → Permission Validation', () => {
    it('should assign FREE tier by default and grant appropriate permissions (V8)', () => {
      const newUser = { tier: 'FREE' as const, role: 'USER' };

      // Verify FREE tier permissions
      expect(hasPermission(newUser, 'view_dashboard')).toBe(true);
      expect(hasPermission(newUser, 'view_symbols')).toBe(true);

      // Verify FREE tier symbol access (V8: XAUUSD only, for everyone)
      expect(canAccessSymbol('XAUUSD', 'FREE')).toBe(true);
      expect(canAccessSymbol('EURUSD', 'FREE')).toBe(false);
      expect(canAccessSymbol('BTCUSD', 'FREE')).toBe(false);

      // Verify PRO features are blocked
      expect(hasPermission(newUser, 'create_alerts')).toBe(false);
      expect(hasPermission(newUser, 'drawing_line_alerts')).toBe(false);
      expect(hasPermission(newUser, 'export_data')).toBe(false);
    });

    it('should block alert creation entirely for FREE tier (V8)', () => {
      // V8: alerts are a PRO feature — FREE can never create
      expect(canCreateAlert('FREE', 0).allowed).toBe(false);
      expect(canCreateAlert('FREE', 0).reason).toContain('PRO');

      // PRO can create up to 100
      expect(canCreateAlert('PRO', 0).allowed).toBe(true);
      expect(canCreateAlert('PRO', 100).allowed).toBe(false);
    });

    it('should validate permissions match tier configuration', () => {
      const freeUser = { tier: 'FREE' as const };
      const permissions = getUserPermissions(freeUser);

      // Permissions should match FREE tier config (V8: 3 permissions)
      expect(permissions.length).toBe(3);
      expect(permissions).toContain('view_dashboard');
      expect(permissions).not.toContain('create_alerts');
    });
  });

  describe('Workflow 2: Subscription Checkout → Tier Upgrade → Permission Change', () => {
    const mockCheckoutSession = {
      id: 'cs_test_123',
      metadata: { userId: 'user-123' },
      customer: 'cus_test_123',
      subscription: 'sub_test_123',
    } as unknown as Stripe.Checkout.Session;

    it('should upgrade user to PRO and expand permissions after checkout', async () => {
      // Setup: User starts as FREE (V8: no alerts, no line alerts)
      const freeUser = { tier: 'FREE' as const, role: 'USER' };
      expect(hasPermission(freeUser, 'create_alerts')).toBe(false);
      expect(hasPermission(freeUser, 'drawing_line_alerts')).toBe(false);

      // Mock successful checkout
      mockUserUpdate.mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        tier: 'PRO',
      });
      mockSubscriptionUpsert.mockResolvedValue({ id: 'sub-db-123' });
      mockSendSubscriptionConfirmationEmail.mockResolvedValue(undefined);

      // Process checkout completion
      await handleCheckoutCompleted(mockCheckoutSession);

      // Verify user was upgraded
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          tier: 'PRO',
          hasUsedFreeTrial: true,
          trialStatus: 'CONVERTED',
        }),
      });

      // After upgrade: PRO user has expanded permissions (V8 feature set)
      const proUser = { tier: 'PRO' as const, role: 'USER' };
      expect(hasPermission(proUser, 'create_alerts')).toBe(true);
      expect(hasPermission(proUser, 'drawing_line_alerts')).toBe(true);
      expect(hasPermission(proUser, 'multi_timeframe_visualization')).toBe(
        true
      );
      expect(hasPermission(proUser, 'export_data')).toBe(true);
    });

    it('should unlock alert creation after upgrade (V8: 0 -> 100)', async () => {
      // FREE tier: alerts blocked entirely
      expect(canCreateAlert('FREE', 0).allowed).toBe(false);

      // PRO tier limit is 100
      expect(canCreateAlert('PRO', 5).allowed).toBe(true);
      expect(canCreateAlert('PRO', 99).allowed).toBe(true);
      expect(canCreateAlert('PRO', 100).allowed).toBe(false);
    });

    it('should keep data access identical after upgrade (V8)', () => {
      // Both tiers: XAUUSD allowed, everything else rejected
      expect(validateTierAccess('FREE', 'XAUUSD').allowed).toBe(true);
      expect(validateTierAccess('PRO', 'XAUUSD').allowed).toBe(true);
      expect(validateTierAccess('FREE', 'GBPUSD').allowed).toBe(false);
      expect(validateTierAccess('PRO', 'GBPUSD').allowed).toBe(false);
    });
  });

  describe('Workflow 3: Subscription Cancellation → Tier Downgrade → Permission Revocation', () => {
    const mockCanceledSubscription = {
      id: 'sub_test_123',
      status: 'canceled',
    } as unknown as Stripe.Subscription;

    it('should downgrade user to FREE and revoke PRO permissions', async () => {
      // Setup: User is PRO
      const proUser = { tier: 'PRO' as const, role: 'USER' };
      expect(hasPermission(proUser, 'create_alerts')).toBe(true);
      expect(hasPermission(proUser, 'drawing_line_alerts')).toBe(true);

      // Mock subscription cancellation
      const mockDbSubscription = {
        id: 'sub-db-123',
        userId: 'user-123',
        stripeSubscriptionId: 'sub_test_123',
        user: { id: 'user-123', email: 'user@example.com', name: 'Test User' },
      };
      mockSubscriptionFindFirst.mockResolvedValue(mockDbSubscription);
      mockUserUpdate.mockResolvedValue({ id: 'user-123', tier: 'FREE' });
      mockSubscriptionUpdate.mockResolvedValue({ id: 'sub-db-123' });
      mockSendSubscriptionCanceledEmail.mockResolvedValue(undefined);

      // Process subscription deletion
      await handleSubscriptionDeleted(mockCanceledSubscription);

      // Verify downgrade
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          tier: 'FREE',
          trialStatus: 'CANCELLED',
        }),
      });

      // After downgrade: User loses PRO permissions (V8)
      const downgradedUser = { tier: 'FREE' as const, role: 'USER' };
      expect(hasPermission(downgradedUser, 'create_alerts')).toBe(false);
      expect(hasPermission(downgradedUser, 'drawing_line_alerts')).toBe(false);
      expect(hasPermission(downgradedUser, 'export_data')).toBe(false);
    });

    it('should block alert creation entirely after downgrade (V8)', () => {
      // Before downgrade (PRO): can have up to 100 alerts
      expect(canCreateAlert('PRO', 15).allowed).toBe(true);

      // After downgrade (FREE): alerts are a PRO feature - always blocked
      expect(canCreateAlert('FREE', 0).allowed).toBe(false);
      expect(canCreateAlert('FREE', 15).allowed).toBe(false);
    });
  });

  describe('Workflow 4: Tier Configuration Consistency', () => {
    it('should have consistent limits across auth and tier modules', () => {
      // FREE tier consistency (V8)
      expect(FREE_TIER_CONFIG.maxAlerts).toBe(0);
      expect(FREE_TIER_CONFIG.symbols).toBe(1);
      expect(FREE_TIER_CONFIG.timeframes).toBe(2);

      // PRO tier consistency (V8)
      expect(PRO_TIER_CONFIG.maxAlerts).toBe(100);
      expect(PRO_TIER_CONFIG.symbols).toBe(1);
      expect(PRO_TIER_CONFIG.timeframes).toBe(2);
    });

    it('should validate tier access matches config limits', () => {
      // V8: single symbol for both tiers
      expect(canAccessSymbol('XAUUSD', 'FREE')).toBe(true);
      expect(canAccessSymbol('XAUUSD', 'PRO')).toBe(true);
      expect(FREE_TIER_CONFIG.symbols).toBe(1);

      // No tier unlocks additional symbols
      expect(canAccessSymbol('GBPUSD', 'PRO')).toBe(false);
      expect(canAccessSymbol('ETHUSD', 'PRO')).toBe(false);
    });

    it('should enforce rate limits per tier', () => {
      expect(FREE_TIER_CONFIG.rateLimit).toBe(60);
      expect(PRO_TIER_CONFIG.rateLimit).toBe(300);

      // PRO has 5x more rate limit than FREE
      expect(PRO_TIER_CONFIG.rateLimit / FREE_TIER_CONFIG.rateLimit).toBe(5);
    });
  });

  describe('Workflow 5: Admin + Affiliate Permission Integration', () => {
    it('should grant admin all permissions regardless of tier', () => {
      const adminUser = { tier: 'FREE' as const, role: 'ADMIN' };

      // Admin has all permissions even on FREE tier
      expect(hasPermission(adminUser, 'view_dashboard')).toBe(true);
      expect(hasPermission(adminUser, 'create_alerts')).toBe(true);
      expect(hasPermission(adminUser, 'admin_dashboard')).toBe(true);
      expect(hasPermission(adminUser, 'admin_users')).toBe(true);
    });

    it('should grant affiliate permissions independently of tier', () => {
      const freeAffiliate = { tier: 'FREE' as const, isAffiliate: true };
      const proAffiliate = { tier: 'PRO' as const, isAffiliate: true };

      // Both should have affiliate permissions
      expect(hasPermission(freeAffiliate, 'affiliate_dashboard')).toBe(true);
      expect(hasPermission(proAffiliate, 'affiliate_dashboard')).toBe(true);

      // Non-affiliate should not have affiliate permissions
      const proNonAffiliate = { tier: 'PRO' as const, isAffiliate: false };
      expect(hasPermission(proNonAffiliate, 'affiliate_dashboard')).toBe(false);
    });

    it('should combine tier + affiliate + admin permissions', () => {
      const superUser = {
        tier: 'PRO' as const,
        role: 'ADMIN',
        isAffiliate: true,
      };

      const permissions = getUserPermissions(superUser);

      // Should have PRO permissions (V8)
      expect(permissions).toContain('create_alerts');
      expect(permissions).toContain('drawing_line_alerts');
      expect(permissions).toContain('export_data');

      // Should have affiliate permissions
      expect(permissions).toContain('affiliate_dashboard');
      expect(permissions).toContain('affiliate_codes');

      // Should have admin permissions
      expect(permissions).toContain('admin_dashboard');
      expect(permissions).toContain('admin_users');
    });
  });
});
