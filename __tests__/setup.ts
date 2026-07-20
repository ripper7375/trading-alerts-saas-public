/**
 * Jest Test Setup - Centralized Prisma Mock Configuration
 *
 * This file provides a consistent Prisma mock across all tests
 * using jest-mock-extended for deep mocking.
 *
 * IMPORTANT: jest.mock() calls are hoisted to the top of THIS file so they
 * execute before any of ITS OWN imports. That hoisting is per-file — it
 * does NOT reach into files that import this one. Root-caused during
 * Session 2-4 after an extensive, initially-misdirected investigation
 * (earlier revisions of this comment wrongly suspected type-only imports
 * of '.prisma/non-market-client'/'.prisma/market-client'; ruled out —
 * mockDeep() is 100% runtime-type-erased, confirmed from jest-mock-
 * extended's own source):
 *
 * Every consuming test file MUST import from this file (`'../../setup'`
 * or equivalent) BEFORE any import that transitively pulls in
 * '@/lib/db/prisma' or '@/lib/db/market-prisma' (e.g. the module under
 * test). ES imports execute in declaration order; if the module-under-test
 * import runs first, it requires the REAL, unmocked client and caches it
 * before this file's jest.mock() calls ever register — silently. There is
 * no error, no console warning, just a "prisma.x.y.mockResolvedValue is
 * not a function" failure (or worse, a real-looking pass) later.
 *
 * lib/jobs/alert-checker.test.ts never imports this file at all (it
 * imports `{ prisma }` directly from '@/lib/db/prisma'), so it always got
 * the real client regardless of order — fixed with its own local
 * jest.mock() override instead (hoisting works fine for jest.mock() calls
 * written directly in the consuming file). Session 2-4 also hit this for
 * real via eslint's `import/order` auto-fix, which reordered this import
 * after the module-under-test import in 5 files during a routine commit,
 * silently breaking their Prisma mocks. Every consumer of this file now
 * carries a comment at its import site warning against reordering — if
 * you add a new one, keep that comment.
 *
 * @module __tests__/setup
 */

import { jest, beforeEach } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
// '@prisma/client' (not '.prisma/non-market-client'/'.prisma/market-client')
// is used here deliberately — mockDeep()'s type parameter has zero runtime
// effect (see header above), and '@prisma/client's types, while already
// stale (Session 2-4 deleted prisma/schema.prisma, so nothing regenerates
// node_modules/.prisma/client anymore), are a stable, low-risk source for
// IDE/tsc ergonomics in this file specifically.

const mockPrismaInstance = mockDeep<PrismaClient>();
const mockMarketPrismaInstance = mockDeep<PrismaClient>();

// Mock the prisma modules - this is hoisted to the top by Jest
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  default: mockPrismaInstance,
  prisma: mockPrismaInstance,
}));

jest.mock('@/lib/db/market-prisma', () => ({
  __esModule: true,
  default: mockMarketPrismaInstance,
  marketPrisma: mockMarketPrismaInstance,
}));

/**
 * Type-safe Prisma mock for use in tests
 *
 * @example
 * ```typescript
 * import { prismaMock } from '../../setup';
 *
 * prismaMock.user.findUnique.mockResolvedValue({ id: 'test' });
 * ```
 */
export const prismaMock = mockPrismaInstance as DeepMockProxy<PrismaClient>;

/**
 * Type-safe mock for the market-data client (MarketDataV6 only) — see
 * @/lib/db/market-prisma for why this is a separate singleton from `prisma`.
 */
export const marketPrismaMock =
  mockMarketPrismaInstance as DeepMockProxy<PrismaClient>;

/**
 * Reset all mocks before each test
 */
beforeEach(() => {
  mockReset(prismaMock);
  mockReset(marketPrismaMock);
});

/**
 * Test Factories - Helper functions to create test data
 */
export const testFactories = {
  /**
   * Create a mock user object
   */
  createUser: (
    overrides: Partial<{
      id: string;
      email: string;
      name: string;
      tier: 'FREE' | 'PRO';
      isAffiliate: boolean;
      role: string;
    }> = {}
  ) => ({
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    password: null,
    image: null,
    emailVerified: new Date(),
    tier: 'FREE' as const,
    role: 'USER',
    isActive: true,
    isAffiliate: false,
    trialStatus: 'NOT_STARTED' as const,
    trialStartDate: null,
    trialEndDate: null,
    trialConvertedAt: null,
    trialCancelledAt: null,
    hasUsedFreeTrial: false,
    hasUsedStripeTrial: false,
    stripeTrialStartedAt: null,
    hasUsedThreeDayPlan: false,
    threeDayPlanUsedAt: null,
    signupIP: null,
    lastLoginIP: null,
    deviceFingerprint: null,
    verificationToken: null,
    resetToken: null,
    resetTokenExpiry: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  /**
   * Create a mock affiliate profile object
   */
  createAffiliateProfile: (
    overrides: Partial<{
      id: string;
      userId: string;
      fullName: string;
      country: string;
      status: 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
      paymentMethod: string;
    }> = {}
  ) => ({
    id: 'aff-profile-123',
    userId: 'user-123',
    fullName: 'John Doe',
    country: 'US',
    facebookUrl: null,
    instagramUrl: null,
    twitterUrl: null,
    youtubeUrl: null,
    tiktokUrl: null,
    paymentMethod: 'PAYPAL',
    paymentDetails: { email: 'john@paypal.com' },
    totalCodesDistributed: 0,
    totalCodesUsed: 0,
    totalEarnings: 0,
    pendingCommissions: 0,
    paidCommissions: 0,
    status: 'ACTIVE' as const,
    verifiedAt: new Date(),
    suspendedAt: null,
    suspensionReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  /**
   * Create a mock affiliate code object
   */
  createAffiliateCode: (
    overrides: Partial<{
      id: string;
      code: string;
      affiliateProfileId: string;
      status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';
    }> = {}
  ) => ({
    id: 'aff-code-123',
    code: 'TESTCODE',
    affiliateProfileId: 'aff-profile-123',
    discountPercent: 20,
    commissionPercent: 20,
    status: 'ACTIVE' as const,
    distributedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    usedAt: null,
    cancelledAt: null,
    distributionReason: 'MONTHLY' as const,
    usedBy: null,
    subscriptionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  /**
   * Create a mock commission object
   */
  createCommission: (
    overrides: Partial<{
      id: string;
      affiliateProfileId: string;
      affiliateCodeId: string;
      status: 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED';
    }> = {}
  ) => ({
    id: 'commission-123',
    affiliateProfileId: 'aff-profile-123',
    affiliateCodeId: 'aff-code-123',
    userId: 'user-456',
    subscriptionId: 'sub-123',
    grossRevenue: 29.0,
    discountAmount: 5.8,
    netRevenue: 23.2,
    commissionAmount: 4.64,
    status: 'PENDING' as const,
    earnedAt: new Date(),
    approvedAt: null,
    paidAt: null,
    cancelledAt: null,
    paymentBatchId: null,
    paymentMethod: null,
    paymentReference: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  /**
   * Create a mock NextAuth session
   */
  createSession: (
    overrides: Partial<{
      id: string;
      email: string;
      tier: 'FREE' | 'PRO';
      isAffiliate: boolean;
      role: string;
    }> = {}
  ) => ({
    user: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      tier: 'FREE' as const,
      role: 'USER',
      isAffiliate: false,
      ...overrides,
    },
    expires: '2025-12-31T00:00:00.000Z',
  }),
};
