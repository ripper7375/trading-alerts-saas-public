/**
 * 3-Day Plan Validator Service Tests
 *
 * Tests for anti-abuse validation of the 3-day plan:
 * - Prevents repeat usage
 * - Blocks purchase with active subscription
 * - Marks plan as used after purchase
 *
 * @module __tests__/lib/dlocal/three-day-validator.test.ts
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { prismaMock, testFactories } from '../../setup';
import {
  canPurchaseThreeDayPlan,
  markThreeDayPlanUsed,
  validatePlanPurchase,
} from '@/lib/dlocal/three-day-validator.service';

describe('3-Day Plan Validator', () => {
  describe('canPurchaseThreeDayPlan', () => {
    it('should allow new user to purchase 3-day plan', async () => {
      const mockUser = testFactories.createUser({
        id: 'user-new',
        hasUsedThreeDayPlan: false,
      });

      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        subscription: null,
      } as never);

      const result = await canPurchaseThreeDayPlan('user-new');

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
        subscription: null,
      } as never);

      const result = await canPurchaseThreeDayPlan('user-used');

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

      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        subscription: mockSubscription,
      } as never);

      const result = await canPurchaseThreeDayPlan('user-active-sub');

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

      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        subscription: mockSubscription,
      } as never);

      const result = await canPurchaseThreeDayPlan('user-expired-sub');

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

      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        subscription: mockSubscription,
      } as never);

      const result = await canPurchaseThreeDayPlan('user-cancelled-sub');

      expect(result.canPurchase).toBe(true);
    });

    it('should reject if user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await canPurchaseThreeDayPlan('nonexistent-user');

      expect(result.canPurchase).toBe(false);
      expect(result.reason).toBe('User not found');
    });

    it('should throw error on database failure', async () => {
      prismaMock.user.findUnique.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(canPurchaseThreeDayPlan('user-123')).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('markThreeDayPlanUsed', () => {
    beforeEach(() => {
      prismaMock.user.update.mockResolvedValue({} as never);
    });

    it('should mark 3-day plan as used', async () => {
      await markThreeDayPlanUsed('user-123');

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

      await expect(markThreeDayPlanUsed('user-123')).rejects.toThrow(
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

      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        subscription: null,
      } as never);

      const result = await validatePlanPurchase('user-validate', 'THREE_DAY');

      expect(result.canPurchase).toBe(true);
    });

    it('should allow monthly plan for existing user', async () => {
      const mockUser = testFactories.createUser({
        id: 'user-monthly',
      });

      prismaMock.user.findUnique.mockResolvedValue(mockUser as never);

      const result = await validatePlanPurchase('user-monthly', 'MONTHLY');

      expect(result.canPurchase).toBe(true);
    });

    it('should reject monthly plan if user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await validatePlanPurchase('nonexistent', 'MONTHLY');

      expect(result.canPurchase).toBe(false);
      expect(result.reason).toBe('User not found');
    });
  });
});
