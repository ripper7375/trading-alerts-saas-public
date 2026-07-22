/**
 * Shared Prisma mock + test factories for File 6/6's ported suites.
 *
 * Mirrors the monolith's __tests__/setup.ts convention (jest-mock-extended's
 * mockDeep<PrismaClient>()) but wired through NestJS's own testing module
 * (.overrideProvider(PrismaService).useValue(...)) instead of jest.mock()
 * module hoisting, per this order's File 6/6 instruction ("Use NestJS
 * testing module to mock PrismaService").
 */
import type { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

export function createPrismaMock(): DeepMockProxy<PrismaClient> {
  return mockDeep<PrismaClient>();
}

export const testFactories = {
  createUser: (
    overrides: Partial<{
      id: string;
      email: string;
      name: string | null;
      tier: 'FREE' | 'PRO';
      hasUsedThreeDayPlan: boolean;
      threeDayPlanUsedAt: Date | null;
    }> = {}
  ) => ({
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    tier: 'FREE' as const,
    hasUsedThreeDayPlan: false,
    threeDayPlanUsedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  createAffiliateProfile: (
    overrides: Partial<{
      id: string;
      userId: string;
      fullName: string;
      country: string;
      status: 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
      paymentMethod: string;
      pendingCommissions: number;
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
};
