/**
 * Check Expiring Subscriptions Cron Tests
 *
 * Tests for the daily cron job that identifies expiring dLocal
 * subscriptions and marks them for renewal reminders.
 *
 * @module __tests__/lib/cron/check-expiring-subscriptions.test.ts
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { prismaMock, testFactories } from '../../setup';
import { checkExpiringSubscriptions } from '@/lib/cron/check-expiring-subscriptions';

describe('Check Expiring Subscriptions Cron', () => {
  beforeEach(() => {
    prismaMock.subscription.update.mockResolvedValue({} as never);
  });

  describe('checkExpiringSubscriptions', () => {
    it('should find subscriptions expiring in 3 days', async () => {
      const mockUser = testFactories.createUser({
        id: 'user-expiring',
        email: 'expiring@test.com',
        name: 'Expiring User',
      });

      const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      const mockSubscriptions = [
        {
          id: 'sub-1',
          userId: 'user-expiring',
          status: 'ACTIVE',
          dLocalPaymentId: 'dlocal-payment-123',
          planType: 'MONTHLY',
          expiresAt: threeDaysFromNow,
          renewalReminderSent: false,
          user: mockUser,
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );

      const result = await checkExpiringSubscriptions();

      expect(result.reminders).toHaveLength(1);
      expect(result.reminders[0].userId).toBe('user-expiring');
      expect(result.reminders[0].email).toBe('expiring@test.com');
      expect(result.processed).toBe(1);
    });

    it('should mark reminder as sent', async () => {
      const mockUser = testFactories.createUser({
        id: 'user-reminder',
        email: 'reminder@test.com',
      });

      const mockSubscriptions = [
        {
          id: 'sub-mark',
          userId: 'user-reminder',
          status: 'ACTIVE',
          dLocalPaymentId: 'dlocal-123',
          planType: 'MONTHLY',
          expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          renewalReminderSent: false,
          user: mockUser,
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );

      await checkExpiringSubscriptions();

      expect(prismaMock.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-mark' },
        data: { renewalReminderSent: true },
      });
    });

    it('should not send reminder if already sent', async () => {
      // Return empty array because reminders already sent are filtered out
      prismaMock.subscription.findMany.mockResolvedValue([]);

      const result = await checkExpiringSubscriptions();

      expect(result.reminders).toHaveLength(0);
    });

    it('should not include Stripe subscriptions', async () => {
      // Query filters for dLocalPaymentId not null, so Stripe subs are excluded
      prismaMock.subscription.findMany.mockResolvedValue([]);

      const result = await checkExpiringSubscriptions();

      // The findMany should have been called with dLocalPaymentId filter
      expect(prismaMock.subscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dLocalPaymentId: { not: null },
          }),
        })
      );
      expect(result.reminders).toHaveLength(0);
    });

    it('should handle multiple expiring subscriptions', async () => {
      const mockUser1 = testFactories.createUser({
        id: 'user-1',
        email: 'user1@test.com',
        name: 'User One',
      });

      const mockUser2 = testFactories.createUser({
        id: 'user-2',
        email: 'user2@test.com',
        name: 'User Two',
      });

      const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      const mockSubscriptions = [
        {
          id: 'sub-1',
          userId: 'user-1',
          status: 'ACTIVE',
          dLocalPaymentId: 'dlocal-1',
          planType: 'MONTHLY',
          expiresAt: threeDaysFromNow,
          renewalReminderSent: false,
          user: mockUser1,
        },
        {
          id: 'sub-2',
          userId: 'user-2',
          status: 'ACTIVE',
          dLocalPaymentId: 'dlocal-2',
          planType: 'THREE_DAY',
          expiresAt: threeDaysFromNow,
          renewalReminderSent: false,
          user: mockUser2,
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );

      const result = await checkExpiringSubscriptions();

      expect(result.reminders).toHaveLength(2);
      expect(result.processed).toBe(2);
      expect(prismaMock.subscription.update).toHaveBeenCalledTimes(2);
    });

    it('should skip subscriptions without email', async () => {
      const mockUserNoEmail = {
        id: 'user-no-email',
        email: null,
        name: 'No Email User',
      };

      const mockSubscriptions = [
        {
          id: 'sub-no-email',
          userId: 'user-no-email',
          status: 'ACTIVE',
          dLocalPaymentId: 'dlocal-123',
          planType: 'MONTHLY',
          expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          renewalReminderSent: false,
          user: mockUserNoEmail,
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );

      const result = await checkExpiringSubscriptions();

      expect(result.reminders).toHaveLength(0);
      expect(result.processed).toBe(1);
    });

    it('should handle no expiring subscriptions gracefully', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([]);

      const result = await checkExpiringSubscriptions();

      expect(result.reminders).toHaveLength(0);
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
          expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          renewalReminderSent: false,
          user: mockUser,
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );

      const result = await checkExpiringSubscriptions({ dryRun: true });

      expect(result.reminders).toHaveLength(1);
      expect(prismaMock.subscription.update).not.toHaveBeenCalled();
    });

    it('should handle individual subscription errors', async () => {
      const mockUser = testFactories.createUser({
        id: 'user-error',
        email: 'error@test.com',
      });

      const mockSubscriptions = [
        {
          id: 'sub-error',
          userId: 'user-error',
          status: 'ACTIVE',
          dLocalPaymentId: 'dlocal-err',
          planType: 'MONTHLY',
          expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          renewalReminderSent: false,
          user: mockUser,
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );
      prismaMock.subscription.update.mockRejectedValue(
        new Error('Update failed')
      );

      const result = await checkExpiringSubscriptions();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('sub-error');
      expect(result.errors[0]).toContain('Update failed');
    });

    it('should throw on database query failure', async () => {
      prismaMock.subscription.findMany.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(checkExpiringSubscriptions()).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should support custom days before expiry', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([]);

      await checkExpiringSubscriptions({ daysBeforeExpiry: 5 });

      // Verify the query was made (with custom window)
      expect(prismaMock.subscription.findMany).toHaveBeenCalled();
    });
  });
});
