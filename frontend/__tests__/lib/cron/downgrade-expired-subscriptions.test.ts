/**
 * Downgrade Expired Subscriptions Cron Tests
 *
 * Tests for the daily cron job that identifies expired dLocal
 * subscriptions and downgrades users to FREE tier.
 *
 * @module __tests__/lib/cron/downgrade-expired-subscriptions.test.ts
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { prismaMock, testFactories } from '../../setup';
import { downgradeExpiredSubscriptions } from '@/lib/cron/downgrade-expired-subscriptions';

describe('Downgrade Expired Subscriptions Cron', () => {
  beforeEach(() => {
    prismaMock.user.update.mockResolvedValue({} as never);
    prismaMock.subscription.update.mockResolvedValue({} as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
  });

  describe('downgradeExpiredSubscriptions', () => {
    it('should downgrade users with expired subscriptions', async () => {
      const mockUser = testFactories.createUser({
        id: 'user-expired',
        email: 'expired@test.com',
        name: 'Expired User',
        tier: 'PRO',
      });

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const mockSubscriptions = [
        {
          id: 'sub-expired',
          userId: 'user-expired',
          status: 'ACTIVE',
          dLocalPaymentId: 'dlocal-expired',
          planType: 'MONTHLY',
          expiresAt: yesterday,
          user: mockUser,
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );

      const result = await downgradeExpiredSubscriptions();

      expect(result.downgrades).toHaveLength(1);
      expect(result.downgrades[0].userId).toBe('user-expired');
      expect(result.processed).toBe(1);
    });

    it('should update user tier to FREE', async () => {
      const mockUser = testFactories.createUser({
        id: 'user-downgrade',
        email: 'downgrade@test.com',
        tier: 'PRO',
      });

      const mockSubscriptions = [
        {
          id: 'sub-downgrade',
          userId: 'user-downgrade',
          status: 'ACTIVE',
          dLocalPaymentId: 'dlocal-down',
          planType: 'MONTHLY',
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          user: mockUser,
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );

      await downgradeExpiredSubscriptions();

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-downgrade' },
        data: { tier: 'FREE' },
      });
    });

    it('should set subscription status to CANCELED', async () => {
      const mockUser = testFactories.createUser({
        id: 'user-cancel',
        email: 'cancel@test.com',
      });

      const mockSubscriptions = [
        {
          id: 'sub-cancel',
          userId: 'user-cancel',
          status: 'ACTIVE',
          dLocalPaymentId: 'dlocal-cancel',
          planType: 'MONTHLY',
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          user: mockUser,
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );

      await downgradeExpiredSubscriptions();

      expect(prismaMock.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-cancel' },
        data: { status: 'CANCELED' },
      });
    });

    it('should create notification for user', async () => {
      const mockUser = testFactories.createUser({
        id: 'user-notify',
        email: 'notify@test.com',
      });

      const mockSubscriptions = [
        {
          id: 'sub-notify',
          userId: 'user-notify',
          status: 'ACTIVE',
          dLocalPaymentId: 'dlocal-notify',
          planType: 'MONTHLY',
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          user: mockUser,
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );

      await downgradeExpiredSubscriptions();

      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-notify',
          type: 'SUBSCRIPTION',
          title: 'Subscription Expired',
          body: expect.stringContaining('expired'),
          priority: 'HIGH',
        },
      });
    });

    it('should not process active subscriptions', async () => {
      // Active subscriptions are filtered out by the query
      prismaMock.subscription.findMany.mockResolvedValue([]);

      const result = await downgradeExpiredSubscriptions();

      expect(result.downgrades).toHaveLength(0);
      expect(result.processed).toBe(0);
    });

    it('should not process Stripe subscriptions', async () => {
      // Query filters for dLocalPaymentId not null, so Stripe subs are excluded
      prismaMock.subscription.findMany.mockResolvedValue([]);

      const result = await downgradeExpiredSubscriptions();

      // Verify the query was made with dLocalPaymentId filter
      expect(prismaMock.subscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dLocalPaymentId: { not: null },
          }),
        })
      );
      expect(result.downgrades).toHaveLength(0);
    });

    it('should handle multiple expired subscriptions', async () => {
      const mockUser1 = testFactories.createUser({
        id: 'user-1',
        email: 'user1@test.com',
      });

      const mockUser2 = testFactories.createUser({
        id: 'user-2',
        email: 'user2@test.com',
      });

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const mockSubscriptions = [
        {
          id: 'sub-1',
          userId: 'user-1',
          status: 'ACTIVE',
          dLocalPaymentId: 'dlocal-1',
          planType: 'MONTHLY',
          expiresAt: yesterday,
          user: mockUser1,
        },
        {
          id: 'sub-2',
          userId: 'user-2',
          status: 'ACTIVE',
          dLocalPaymentId: 'dlocal-2',
          planType: 'THREE_DAY',
          expiresAt: yesterday,
          user: mockUser2,
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );

      const result = await downgradeExpiredSubscriptions();

      expect(result.downgrades).toHaveLength(2);
      expect(result.processed).toBe(2);
      expect(prismaMock.user.update).toHaveBeenCalledTimes(2);
      expect(prismaMock.subscription.update).toHaveBeenCalledTimes(2);
      expect(prismaMock.notification.create).toHaveBeenCalledTimes(2);
    });

    it('should handle no expired subscriptions gracefully', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([]);

      const result = await downgradeExpiredSubscriptions();

      expect(result.downgrades).toHaveLength(0);
      expect(result.processed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should support dry run mode', async () => {
      const mockUser = testFactories.createUser({
        id: 'user-dryrun',
        email: 'dryrun@test.com',
      });

      const mockSubscriptions = [
        {
          id: 'sub-dryrun',
          userId: 'user-dryrun',
          status: 'ACTIVE',
          dLocalPaymentId: 'dlocal-dry',
          planType: 'MONTHLY',
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          user: mockUser,
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );

      const result = await downgradeExpiredSubscriptions({ dryRun: true });

      expect(result.downgrades).toHaveLength(1);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(prismaMock.subscription.update).not.toHaveBeenCalled();
      expect(prismaMock.notification.create).not.toHaveBeenCalled();
    });

    it('should handle individual user errors and continue', async () => {
      const mockUser1 = testFactories.createUser({
        id: 'user-error',
        email: 'error@test.com',
      });

      const mockUser2 = testFactories.createUser({
        id: 'user-ok',
        email: 'ok@test.com',
      });

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const mockSubscriptions = [
        {
          id: 'sub-error',
          userId: 'user-error',
          status: 'ACTIVE',
          dLocalPaymentId: 'dlocal-err',
          planType: 'MONTHLY',
          expiresAt: yesterday,
          user: mockUser1,
        },
        {
          id: 'sub-ok',
          userId: 'user-ok',
          status: 'ACTIVE',
          dLocalPaymentId: 'dlocal-ok',
          planType: 'MONTHLY',
          expiresAt: yesterday,
          user: mockUser2,
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );

      // First user update fails, second succeeds
      prismaMock.user.update
        .mockRejectedValueOnce(new Error('Update failed'))
        .mockResolvedValueOnce({} as never);

      const result = await downgradeExpiredSubscriptions();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('user-error');
      expect(result.downgrades).toHaveLength(1);
      expect(result.downgrades[0].userId).toBe('user-ok');
    });

    it('should throw on database query failure', async () => {
      prismaMock.subscription.findMany.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(downgradeExpiredSubscriptions()).rejects.toThrow(
        'Database connection failed'
      );
    });
  });
});
