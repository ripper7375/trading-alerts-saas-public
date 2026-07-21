/**
 * Crons Scheduler Tests
 *
 * Session 4A-2, File 6/6. `handleExpireCodes`/`handleSendMonthlyReports`
 * port the business-logic assertions from __tests__/api/cron-jobs.test.ts
 * (the 401/wrong-secret assertions in that file are dropped — that's
 * `CronSecretGuard`'s own concern now, tested separately in File 5/6).
 * `handleDailyMaintenance` is NEW backfill coverage (zero existing
 * coverage anywhere, per this order's CONFIRM finding). The other 5 jobs
 * get a thin delegation check confirming the scheduler calls the right
 * ported service method — their own real behavior is already covered by
 * subscription.service.spec.ts, affiliate.service.spec.ts, and
 * disbursement-processor.service.spec.ts.
 */
import { Test } from '@nestjs/testing';

import { DisbursementProcessorService } from '../disbursement/disbursement-processor.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, testFactories } from '../test-utils/prisma-mock';

import { AffiliateCronService } from './affiliate.service';
import { CronsScheduler } from './crons.scheduler';
import { SubscriptionCronService } from './subscription.service';

describe('CronsScheduler', () => {
  let scheduler: CronsScheduler;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let subscriptionCronMock: {
    checkExpiringSubscriptions: jest.Mock;
    downgradeExpiredSubscriptions: jest.Mock;
  };
  let affiliateCronMock: { runMonthlyDistribution: jest.Mock };
  let disbursementProcessorMock: {
    processAutomatedDisbursements: jest.Mock;
    syncRiseWorksAccounts: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    subscriptionCronMock = {
      checkExpiringSubscriptions: jest
        .fn()
        .mockResolvedValue({ reminders: [], processed: 0, errors: [] }),
      downgradeExpiredSubscriptions: jest
        .fn()
        .mockResolvedValue({ downgrades: [], processed: 0, errors: [] }),
    };
    affiliateCronMock = {
      runMonthlyDistribution: jest.fn().mockResolvedValue({
        distributed: 0,
        totalAffiliates: 0,
        errors: [],
        emailsSent: 0,
      }),
    };
    disbursementProcessorMock = {
      processAutomatedDisbursements: jest.fn().mockResolvedValue({
        success: true,
        batchesCreated: 0,
        batchesExecuted: 0,
        totalAmount: 0,
        affiliatesProcessed: 0,
        errors: [],
        startTime: new Date(),
        endTime: new Date(),
        durationMs: 0,
      }),
      syncRiseWorksAccounts: jest.fn().mockResolvedValue({
        success: true,
        accountsSynced: 0,
        accountsUpdated: 0,
        errors: [],
        startTime: new Date(),
        endTime: new Date(),
        durationMs: 0,
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CronsScheduler,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SubscriptionCronService, useValue: subscriptionCronMock },
        { provide: AffiliateCronService, useValue: affiliateCronMock },
        {
          provide: DisbursementProcessorService,
          useValue: disbursementProcessorMock,
        },
      ],
    }).compile();

    scheduler = moduleRef.get(CronsScheduler);
  });

  describe('handleExpireCodes', () => {
    it('expires codes with a valid run', async () => {
      prismaMock.affiliateCode.updateMany.mockResolvedValue({
        count: 42,
      } as never);

      const result = await scheduler.handleExpireCodes();

      expect(result.count).toBe(42);
      expect(prismaMock.affiliateCode.updateMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE', expiresAt: { lte: expect.any(Date) } },
        data: { status: 'EXPIRED' },
      });
    });

    it('handles zero expired codes', async () => {
      prismaMock.affiliateCode.updateMany.mockResolvedValue({
        count: 0,
      } as never);

      const result = await scheduler.handleExpireCodes();

      expect(result.count).toBe(0);
    });
  });

  describe('handleSendMonthlyReports', () => {
    it('sends reports for all active affiliates', async () => {
      prismaMock.affiliateProfile.findMany.mockResolvedValue([
        testFactories.createAffiliateProfile({
          id: 'aff-1',
          userId: 'user-1',
          pendingCommissions: 100.0,
        }),
        testFactories.createAffiliateProfile({
          id: 'aff-2',
          userId: 'user-2',
          pendingCommissions: 200.0,
        }),
      ] as never);
      prismaMock.user.findMany.mockResolvedValue([
        testFactories.createUser({
          id: 'user-1',
          email: 'affiliate1@example.com',
        }),
        testFactories.createUser({
          id: 'user-2',
          email: 'affiliate2@example.com',
        }),
      ] as never);
      prismaMock.affiliateCode.count.mockResolvedValue(15);
      prismaMock.commission.aggregate.mockResolvedValue({
        _sum: { commissionAmount: 50.0 },
      } as never);

      const result = await scheduler.handleSendMonthlyReports();

      expect(result.sent).toBe(2);
      expect(result.totalAffiliates).toBe(2);
    });

    it('handles no active affiliates', async () => {
      prismaMock.affiliateProfile.findMany.mockResolvedValue([]);
      prismaMock.user.findMany.mockResolvedValue([]);

      const result = await scheduler.handleSendMonthlyReports();

      expect(result.sent).toBe(0);
      expect(result.totalAffiliates).toBe(0);
    });
  });

  describe('handleDailyMaintenance (new backfill coverage)', () => {
    it('runs all 3 tasks and aggregates their results', async () => {
      prismaMock.affiliateCode.updateMany.mockResolvedValue({
        count: 5,
      } as never);
      subscriptionCronMock.checkExpiringSubscriptions.mockResolvedValue({
        reminders: [{ userId: 'u1' }],
        processed: 3,
        errors: [],
      });
      subscriptionCronMock.downgradeExpiredSubscriptions.mockResolvedValue({
        downgrades: [{ userId: 'u2' }],
        processed: 10,
        errors: [],
      });

      const result = await scheduler.handleDailyMaintenance();

      expect(result.expiredCodes.count).toBe(5);
      expect(result.expiringSubscriptions.processed).toBe(3);
      expect(result.expiredSubscriptions.processed).toBe(10);
      expect(
        subscriptionCronMock.checkExpiringSubscriptions
      ).toHaveBeenCalledTimes(1);
      expect(
        subscriptionCronMock.downgradeExpiredSubscriptions
      ).toHaveBeenCalledTimes(1);
    });

    it('continues to tasks 2/3 even if task 1 (code expiry) throws', async () => {
      prismaMock.affiliateCode.updateMany.mockRejectedValue(
        new Error('expiry failed')
      );

      const result = await scheduler.handleDailyMaintenance();

      expect(result.expiredCodes.count).toBe(0);
      expect(
        subscriptionCronMock.checkExpiringSubscriptions
      ).toHaveBeenCalledTimes(1);
      expect(
        subscriptionCronMock.downgradeExpiredSubscriptions
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('delegation to Files 2/6-3/6 services', () => {
    it('handleCheckExpiringSubscriptions delegates to SubscriptionCronService', async () => {
      await scheduler.handleCheckExpiringSubscriptions();
      expect(
        subscriptionCronMock.checkExpiringSubscriptions
      ).toHaveBeenCalledTimes(1);
    });

    it('handleDowngradeExpiredSubscriptions delegates to SubscriptionCronService', async () => {
      await scheduler.handleDowngradeExpiredSubscriptions();
      expect(
        subscriptionCronMock.downgradeExpiredSubscriptions
      ).toHaveBeenCalledTimes(1);
    });

    it('handleDistributeCodes delegates to AffiliateCronService', async () => {
      await scheduler.handleDistributeCodes();
      expect(affiliateCronMock.runMonthlyDistribution).toHaveBeenCalledTimes(1);
    });

    it('handleProcessPendingDisbursements delegates to DisbursementProcessorService', async () => {
      await scheduler.handleProcessPendingDisbursements();
      expect(
        disbursementProcessorMock.processAutomatedDisbursements
      ).toHaveBeenCalledTimes(1);
    });

    it('handleSyncRiseWorksAccounts delegates to DisbursementProcessorService', async () => {
      await scheduler.handleSyncRiseWorksAccounts();
      expect(
        disbursementProcessorMock.syncRiseWorksAccounts
      ).toHaveBeenCalledTimes(1);
    });
  });
});
