/**
 * 3-Day Plan Validator Service Tests
 *
 * Ported from __tests__/lib/dlocal/three-day-validator.test.ts (Session
 * 4A-4, File 4/4). Assertions unchanged (parity oracle) — only the call
 * site changed from the free function to `ThreeDayValidatorService`'s
 * method, and `prismaMock` is wired via NestJS's testing module
 * (`.overrideProvider`-style DI) instead of `jest.mock()` module hoisting,
 * same pattern as Session 4A-2's cron service specs.
 *
 * Tests for anti-abuse validation of the 3-day plan:
 * - Prevents repeat usage
 * - Blocks purchase with active subscription
 * - Marks plan as used after purchase
 */
import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, testFactories } from '../test-utils/prisma-mock';

import { ThreeDayValidatorService } from './three-day-validator.service';

describe('ThreeDayValidatorService', () => {
  let service: ThreeDayValidatorService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ThreeDayValidatorService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = moduleRef.get(ThreeDayValidatorService);
  });

  describe('canPurchaseThreeDayPlan', () => {
    it('should allow new user to purchase 3-day plan', async () => {
      const mockUser = testFactories.createUser({
        id: 'user-new',
        hasUsedThreeDayPlan: false,
      });

      prismaMock.user.findUnique.mockResolvedValue(mockUser as never);
      prismaMock.subscription.findUnique.mockResolvedValue(null as never);

      const result = await service.canPurchaseThreeDayPlan('user-new');

      expect(result.canPurchase).toBe(true);
      expect(result.details?.hasUsedThreeDayPlan).toBe(false);
      expect(result.details?.hasActiveSubscription).toBe(false);
    });

    it('should reject if user already used 3-day plan', async () => {
      const mockUser = testFactories.createUser({
        id: 'user-used',
        hasUsedThreeDayPlan: true,
      });

      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        threeDayPlanUsedAt: new Date('2024-01-01'),
      } as never);
      prismaMock.subscription.findUnique.mockResolvedValue(null as never);

      const result = await service.canPurchaseThreeDayPlan('user-used');

      expect(result.canPurchase).toBe(false);
      expect(result.reason).toContain('already used');
      expect(result.reason).toContain('once per account');
      expect(result.details?.hasUsedThreeDayPlan).toBe(true);
    });

    it('should reject if user has active subscription', async () => {
      const mockUser = testFactories.createUser({
        id: 'user-active-sub',
        hasUsedThreeDayPlan: false,
        tier: 'PRO',
      });

      const mockSubscription = {
        id: 'sub-123',
        userId: 'user-active-sub',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      };

      prismaMock.user.findUnique.mockResolvedValue(mockUser as never);
      prismaMock.subscription.findUnique.mockResolvedValue(
        mockSubscription as never
      );

      const result = await service.canPurchaseThreeDayPlan('user-active-sub');

      expect(result.canPurchase).toBe(false);
      expect(result.reason).toContain('active subscription');
      expect(result.details?.hasActiveSubscription).toBe(true);
    });

    it('should allow if subscription is expired', async () => {
      const mockUser = testFactories.createUser({
        id: 'user-expired-sub',
        hasUsedThreeDayPlan: false,
        tier: 'FREE',
      });

      const mockSubscription = {
        id: 'sub-456',
        userId: 'user-expired-sub',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired yesterday
      };

      prismaMock.user.findUnique.mockResolvedValue(mockUser as never);
      prismaMock.subscription.findUnique.mockResolvedValue(
        mockSubscription as never
      );

      const result = await service.canPurchaseThreeDayPlan('user-expired-sub');

      expect(result.canPurchase).toBe(true);
    });

    it('should allow if subscription is cancelled', async () => {
      const mockUser = testFactories.createUser({
        id: 'user-cancelled-sub',
        hasUsedThreeDayPlan: false,
      });

      const mockSubscription = {
        id: 'sub-789',
        userId: 'user-cancelled-sub',
        status: 'CANCELED',
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      };

      prismaMock.user.findUnique.mockResolvedValue(mockUser as never);
      prismaMock.subscription.findUnique.mockResolvedValue(
        mockSubscription as never
      );

      const result =
        await service.canPurchaseThreeDayPlan('user-cancelled-sub');

      expect(result.canPurchase).toBe(true);
    });

    it('should reject if user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await service.canPurchaseThreeDayPlan('nonexistent-user');

      expect(result.canPurchase).toBe(false);
      expect(result.reason).toBe('User not found');
    });

    it('should throw error on database failure', async () => {
      prismaMock.user.findUnique.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(service.canPurchaseThreeDayPlan('user-123')).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('markThreeDayPlanUsed', () => {
    beforeEach(() => {
      prismaMock.user.update.mockResolvedValue({} as never);
    });

    it('should mark 3-day plan as used', async () => {
      await service.markThreeDayPlanUsed('user-123');

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          hasUsedThreeDayPlan: true,
          threeDayPlanUsedAt: expect.any(Date),
        },
      });
    });

    it('should throw error on update failure', async () => {
      prismaMock.user.update.mockRejectedValue(new Error('Update failed'));

      await expect(service.markThreeDayPlanUsed('user-123')).rejects.toThrow(
        'Update failed'
      );
    });
  });

  describe('validatePlanPurchase', () => {
    it('should validate 3-day plan using canPurchaseThreeDayPlan', async () => {
      const mockUser = testFactories.createUser({
        id: 'user-validate',
        hasUsedThreeDayPlan: false,
      });

      prismaMock.user.findUnique.mockResolvedValue(mockUser as never);
      prismaMock.subscription.findUnique.mockResolvedValue(null as never);

      const result = await service.validatePlanPurchase(
        'user-validate',
        'THREE_DAY'
      );

      expect(result.canPurchase).toBe(true);
    });

    it('should allow monthly plan for existing user', async () => {
      const mockUser = testFactories.createUser({
        id: 'user-monthly',
      });

      prismaMock.user.findUnique.mockResolvedValue(mockUser as never);

      const result = await service.validatePlanPurchase(
        'user-monthly',
        'MONTHLY'
      );

      expect(result.canPurchase).toBe(true);
    });

    it('should reject monthly plan if user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await service.validatePlanPurchase(
        'nonexistent',
        'MONTHLY'
      );

      expect(result.canPurchase).toBe(false);
      expect(result.reason).toBe('User not found');
    });
  });
});
