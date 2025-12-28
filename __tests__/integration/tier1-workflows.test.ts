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
import {
  hasPermission,
  getUserPermissions,
  checkFeatureAccess,
} from '@/lib/auth/permissions';
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
    it('should assign FREE tier by default and grant appropriate permissions', () => {
      const newUser = { tier: 'FREE' as const, role: 'USER' };

      // Verify FREE tier permissions
      expect(hasPermission(newUser, 'view_dashboard')).toBe(true);
      expect(hasPermission(newUser, 'create_alerts')).toBe(true);
      expect(hasPermission(newUser, 'view_watchlist')).toBe(true);

      // Verify FREE tier symbol access
      expect(canAccessSymbol('FREE', 'XAUUSD')).toBe(true);
      expect(canAccessSymbol('FREE', 'EURUSD')).toBe(true);
      expect(canAccessSymbol('FREE', 'BTCUSD')).toBe(true);

      // Verify PRO features are blocked
      expect(hasPermission(newUser, 'view_all_symbols')).toBe(false);
      expect(hasPermission(newUser, 'export_data')).toBe(false);
      expect(canAccessSymbol('FREE', 'GBPUSD')).toBe(false);
    });

    it('should grant correct alert limits for FREE tier', () => {
      const freeUser = { tier: 'FREE' as const };

      // Can create alerts under limit
      expect(canCreateAlert('FREE', 0).allowed).toBe(true);
      expect(canCreateAlert('FREE', 4).allowed).toBe(true);

      // Cannot exceed limit
      expect(canCreateAlert('FREE', 5).allowed).toBe(false);
      expect(canCreateAlert('FREE', 5).reason).toContain('Alert limit reached');
    });

    it('should validate permissions match tier configuration', () => {
      const freeUser = { tier: 'FREE' as const };
      const permissions = getUserPermissions(freeUser);

      // Permissions should match FREE tier config
      expect(permissions.length).toBe(5); // 5 FREE tier permissions
      expect(permissions).toContain('view_dashboard');
      expect(permissions).toContain('create_alerts');
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
      // Setup: User starts as FREE
      const freeUser = { tier: 'FREE' as const, role: 'USER' };
      expect(hasPermission(freeUser, 'view_all_symbols')).toBe(false);
      expect(canAccessSymbol('FREE', 'GBPUSD')).toBe(false);

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

      // After upgrade: PRO user has expanded permissions
      const proUser = { tier: 'PRO' as const, role: 'USER' };
      expect(hasPermission(proUser, 'view_all_symbols')).toBe(true);
      expect(hasPermission(proUser, 'export_data')).toBe(true);
      expect(canAccessSymbol('PRO', 'GBPUSD')).toBe(true);
      expect(canAccessSymbol('PRO', 'ETHUSD')).toBe(true);
    });

    it('should expand alert limits after upgrade', async () => {
      // FREE tier limit is 5
      expect(canCreateAlert('FREE', 5).allowed).toBe(false);

      // PRO tier limit is 20
      expect(canCreateAlert('PRO', 5).allowed).toBe(true);
      expect(canCreateAlert('PRO', 19).allowed).toBe(true);
      expect(canCreateAlert('PRO', 20).allowed).toBe(false);
    });

    it('should expand timeframe access after upgrade', () => {
      // FREE tier: limited timeframes
      const freeAccess = validateTierAccess('FREE', 'XAUUSD');
      expect(freeAccess.allowed).toBe(true);

      const freeM5 = validateTierAccess('FREE', 'GBPUSD');
      expect(freeM5.allowed).toBe(false);

      // PRO tier: all timeframes
      const proAccess = validateTierAccess('PRO', 'GBPUSD');
      expect(proAccess.allowed).toBe(true);
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
      expect(hasPermission(proUser, 'view_all_symbols')).toBe(true);
      expect(canAccessSymbol('PRO', 'GBPUSD')).toBe(true);

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

      // After downgrade: User loses PRO permissions
      const downgradedUser = { tier: 'FREE' as const, role: 'USER' };
      expect(hasPermission(downgradedUser, 'view_all_symbols')).toBe(false);
      expect(hasPermission(downgradedUser, 'export_data')).toBe(false);
      expect(canAccessSymbol('FREE', 'GBPUSD')).toBe(false);
    });

    it('should reduce alert limits after downgrade', () => {
      // Before downgrade (PRO): can have 20 alerts
      expect(canCreateAlert('PRO', 15).allowed).toBe(true);

      // After downgrade (FREE): limit reduced to 5
      // If user had 15 alerts, they cannot create new ones
      expect(canCreateAlert('FREE', 6).allowed).toBe(false);
      expect(canCreateAlert('FREE', 5).allowed).toBe(false);
      expect(canCreateAlert('FREE', 4).allowed).toBe(true);
    });
  });

  describe('Workflow 4: Tier Configuration Consistency', () => {
    it('should have consistent limits across auth and tier modules', () => {
      // FREE tier consistency
      expect(FREE_TIER_CONFIG.maxAlerts).toBe(5);
      expect(FREE_TIER_CONFIG.symbols).toBe(5);
      expect(FREE_TIER_CONFIG.timeframes).toBe(3);

      // PRO tier consistency
      expect(PRO_TIER_CONFIG.maxAlerts).toBe(20);
      expect(PRO_TIER_CONFIG.symbols).toBe(15);
      expect(PRO_TIER_CONFIG.timeframes).toBe(9);
    });

    it('should validate tier access matches config limits', () => {
      // Validate symbol counts match
      const freeSymbols = ['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD'];
      freeSymbols.forEach((symbol) => {
        expect(canAccessSymbol('FREE', symbol)).toBe(true);
      });
      expect(freeSymbols.length).toBe(FREE_TIER_CONFIG.symbols);

      // PRO should have access to more symbols
      expect(canAccessSymbol('PRO', 'GBPUSD')).toBe(true);
      expect(canAccessSymbol('PRO', 'ETHUSD')).toBe(true);
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
      expect(hasPermission(adminUser, 'view_all_symbols')).toBe(true);
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

      // Should have PRO permissions
      expect(permissions).toContain('view_all_symbols');
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
