/**
 * Subscription Cron Service Tests
 *
 * Ported from __tests__/lib/cron/check-expiring-subscriptions.test.ts and
 * __tests__/lib/cron/downgrade-expired-subscriptions.test.ts (Session
 * 4A-2, File 6/6). Assertions unchanged (parity oracle) — only the call
 * site changed from the free function to `SubscriptionCronService`'s
 * method, and `prismaMock` is wired via NestJS's testing module
 * (`.overrideProvider`-style DI) instead of `jest.mock()` module hoisting.
 */
import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, testFactories } from '../test-utils/prisma-mock';

import { SubscriptionCronService } from './subscription.service';

describe('SubscriptionCronService', () => {
  let service: SubscriptionCronService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        SubscriptionCronService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = moduleRef.get(SubscriptionCronService);

    prismaMock.subscription.update.mockResolvedValue({} as never);
    prismaMock.user.update.mockResolvedValue({} as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
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
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );
      prismaMock.user.findMany.mockResolvedValue([mockUser] as never);

      const result = await service.checkExpiringSubscriptions();

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
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );
      prismaMock.user.findMany.mockResolvedValue([mockUser] as never);

      await service.checkExpiringSubscriptions();

      expect(prismaMock.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-mark' },
        data: { renewalReminderSent: true },
      });
    });

    it('should not send reminder if already sent', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([]);
      prismaMock.user.findMany.mockResolvedValue([]);

      const result = await service.checkExpiringSubscriptions();

      expect(result.reminders).toHaveLength(0);
    });

    it('should not include Stripe subscriptions', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([]);
      prismaMock.user.findMany.mockResolvedValue([]);

      const result = await service.checkExpiringSubscriptions();

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
        },
        {
          id: 'sub-2',
          userId: 'user-2',
          status: 'ACTIVE',
          dLocalPaymentId: 'dlocal-2',
          planType: 'THREE_DAY',
          expiresAt: threeDaysFromNow,
          renewalReminderSent: false,
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );
      prismaMock.user.findMany.mockResolvedValue([
        mockUser1,
        mockUser2,
      ] as never);

      const result = await service.checkExpiringSubscriptions();

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
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );
      prismaMock.user.findMany.mockResolvedValue([mockUserNoEmail] as never);

      const result = await service.checkExpiringSubscriptions();

      expect(result.reminders).toHaveLength(0);
      expect(result.processed).toBe(1);
    });

    it('should handle no expiring subscriptions gracefully', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([]);
      prismaMock.user.findMany.mockResolvedValue([]);

      const result = await service.checkExpiringSubscriptions();

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
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );
      prismaMock.user.findMany.mockResolvedValue([mockUser] as never);

      const result = await service.checkExpiringSubscriptions({
        dryRun: true,
      });

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
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );
      prismaMock.user.findMany.mockResolvedValue([mockUser] as never);
      prismaMock.subscription.update.mockRejectedValue(
        new Error('Update failed')
      );

      const result = await service.checkExpiringSubscriptions();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('sub-error');
      expect(result.errors[0]).toContain('Update failed');
    });

    it('should throw on database query failure', async () => {
      prismaMock.subscription.findMany.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(service.checkExpiringSubscriptions()).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should support custom days before expiry', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([]);
      prismaMock.user.findMany.mockResolvedValue([]);

      await service.checkExpiringSubscriptions({ daysBeforeExpiry: 5 });

      expect(prismaMock.subscription.findMany).toHaveBeenCalled();
    });
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
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );
      prismaMock.user.findMany.mockResolvedValue([mockUser] as never);

      const result = await service.downgradeExpiredSubscriptions();

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
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );
      prismaMock.user.findMany.mockResolvedValue([mockUser] as never);

      await service.downgradeExpiredSubscriptions();

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
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );
      prismaMock.user.findMany.mockResolvedValue([mockUser] as never);

      await service.downgradeExpiredSubscriptions();

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
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );
      prismaMock.user.findMany.mockResolvedValue([mockUser] as never);

      await service.downgradeExpiredSubscriptions();

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
      prismaMock.subscription.findMany.mockResolvedValue([]);
      prismaMock.user.findMany.mockResolvedValue([]);

      const result = await service.downgradeExpiredSubscriptions();

      expect(result.downgrades).toHaveLength(0);
      expect(result.processed).toBe(0);
    });

    it('should not process Stripe subscriptions', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([]);
      prismaMock.user.findMany.mockResolvedValue([]);

      const result = await service.downgradeExpiredSubscriptions();

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
        },
        {
          id: 'sub-2',
          userId: 'user-2',
          status: 'ACTIVE',
          dLocalPaymentId: 'dlocal-2',
          planType: 'THREE_DAY',
          expiresAt: yesterday,
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );
      prismaMock.user.findMany.mockResolvedValue([
        mockUser1,
        mockUser2,
      ] as never);

      const result = await service.downgradeExpiredSubscriptions();

      expect(result.downgrades).toHaveLength(2);
      expect(result.processed).toBe(2);
      expect(prismaMock.user.update).toHaveBeenCalledTimes(2);
      expect(prismaMock.subscription.update).toHaveBeenCalledTimes(2);
      expect(prismaMock.notification.create).toHaveBeenCalledTimes(2);
    });

    it('should handle no expired subscriptions gracefully', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([]);
      prismaMock.user.findMany.mockResolvedValue([]);

      const result = await service.downgradeExpiredSubscriptions();

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
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );
      prismaMock.user.findMany.mockResolvedValue([mockUser] as never);

      const result = await service.downgradeExpiredSubscriptions({
        dryRun: true,
      });

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
        },
        {
          id: 'sub-ok',
          userId: 'user-ok',
          status: 'ACTIVE',
          dLocalPaymentId: 'dlocal-ok',
          planType: 'MONTHLY',
          expiresAt: yesterday,
        },
      ];

      prismaMock.subscription.findMany.mockResolvedValue(
        mockSubscriptions as never
      );
      prismaMock.user.findMany.mockResolvedValue([
        mockUser1,
        mockUser2,
      ] as never);

      prismaMock.user.update
        .mockRejectedValueOnce(new Error('Update failed'))
        .mockResolvedValueOnce({} as never);

      const result = await service.downgradeExpiredSubscriptions();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('user-error');
      expect(result.downgrades).toHaveLength(1);
      expect(result.downgrades[0].userId).toBe('user-ok');
    });

    it('should throw on database query failure', async () => {
      prismaMock.subscription.findMany.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(service.downgradeExpiredSubscriptions()).rejects.toThrow(
        'Database connection failed'
      );
    });
  });
});
