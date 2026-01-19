/**
 * Jest Test Setup - Centralized Prisma Mock Configuration
 *
 * This file provides a consistent Prisma mock across all tests
 * using jest-mock-extended for deep mocking.
 *
 * IMPORTANT: jest.mock() calls are hoisted to the top of the file
 * so they execute before any imports.
 *
 * @module __tests__/setup
 */

import { jest, beforeEach } from '@jest/globals';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import type { PrismaClient } from '@prisma/client';

// Create the mock BEFORE the jest.mock call
const prismaMockInstance = mockDeep<PrismaClient>();

// Mock the prisma module - this is hoisted to the top by Jest
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  default: prismaMockInstance,
  prisma: prismaMockInstance,
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
export const prismaMock = prismaMockInstance as DeepMockProxy<PrismaClient>;

/**
 * Reset all mocks before each test
 */
beforeEach(() => {
  mockReset(prismaMock);
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
