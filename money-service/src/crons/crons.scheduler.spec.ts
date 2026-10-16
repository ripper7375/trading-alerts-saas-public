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
import { TransactionLoggerService } from '../disbursement/transaction-logger.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, testFactories } from '../test-utils/prisma-mock';
import { ProcessedWebhookEventService } from '../webhooks/processed-webhook-event.service';

import { AffiliateCronService } from './affiliate.service';
import { CronLockService } from './cron-lock.service';
import { CronsScheduler } from './crons.scheduler';
import { SubscriptionCronService } from './subscription.service';
import { WiseReconciliationService } from './wise-reconciliation.service';

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
    approveMaturedCommissions: jest.Mock;
  };
  let transactionLoggerMock: { log: jest.Mock };
  let cronLockMock: { acquire: jest.Mock };
  let processedWebhookEventsMock: { purgeOlderThan: jest.Mock };

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
      approveMaturedCommissions: jest.fn().mockResolvedValue(4),
    };
    // DECISION-LOG F84: the new approve-matured-commissions job logs its
    // count through TransactionLoggerService.
    transactionLoggerMock = { log: jest.fn().mockResolvedValue(undefined) };
    // Session 4A-W6, File 7/8: CronsScheduler gained a 5th constructor
    // dependency for the new wise-reconciliation job. Wiring only -- no
    // existing assertion below changed.
    const wiseReconciliationMock = {
      reconcile: jest.fn().mockResolvedValue({
        transfersChecked: 0,
        transfersFailed: 0,
        fundingSlaBreaches: 0,
      }),
    };

    // Remediation Tier 2 6.9: every scheduled firing asks for the lock first; by
    // default this instance wins it, so the older assertions are unchanged.
    cronLockMock = { acquire: jest.fn().mockResolvedValue(true) };
    processedWebhookEventsMock = {
      purgeOlderThan: jest.fn().mockResolvedValue(3),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CronsScheduler,
        { provide: CronLockService, useValue: cronLockMock },
        {
          provide: ProcessedWebhookEventService,
          useValue: processedWebhookEventsMock,
        },
        { provide: PrismaService, useValue: prismaMock },
        { provide: SubscriptionCronService, useValue: subscriptionCronMock },
        { provide: AffiliateCronService, useValue: affiliateCronMock },
        {
          provide: DisbursementProcessorService,
          useValue: disbursementProcessorMock,
        },
        {
          provide: WiseReconciliationService,
          useValue: wiseReconciliationMock,
        },
        { provide: TransactionLoggerService, useValue: transactionLoggerMock },
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

  describe('CRON_ENABLED safety gate (scheduled*() wrappers)', () => {
    const originalEnv = process.env['CRON_ENABLED'];

    afterEach(() => {
      process.env['CRON_ENABLED'] = originalEnv;
    });

    const scheduledMethods: Array<
      keyof Pick<
        CronsScheduler,
        | 'scheduledCheckExpiringSubscriptions'
        | 'scheduledDailyMaintenance'
        | 'scheduledDistributeCodes'
        | 'scheduledDowngradeExpiredSubscriptions'
        | 'scheduledExpireCodes'
        | 'scheduledProcessPendingDisbursements'
        | 'scheduledApproveMaturedCommissions'
        | 'scheduledSendMonthlyReports'
        | 'scheduledSyncRiseWorksAccounts'
        | 'scheduledPurgeProcessedWebhookEvents'
      >
    > = [
      'scheduledCheckExpiringSubscriptions',
      'scheduledDailyMaintenance',
      'scheduledDistributeCodes',
      'scheduledDowngradeExpiredSubscriptions',
      'scheduledExpireCodes',
      'scheduledProcessPendingDisbursements',
      'scheduledApproveMaturedCommissions',
      'scheduledSendMonthlyReports',
      'scheduledSyncRiseWorksAccounts',
      'scheduledPurgeProcessedWebhookEvents',
    ];

    const underlyingHandlerFor: Record<string, keyof CronsScheduler> = {
      scheduledCheckExpiringSubscriptions: 'handleCheckExpiringSubscriptions',
      scheduledDailyMaintenance: 'handleDailyMaintenance',
      scheduledDistributeCodes: 'handleDistributeCodes',
      scheduledDowngradeExpiredSubscriptions:
        'handleDowngradeExpiredSubscriptions',
      scheduledExpireCodes: 'handleExpireCodes',
      scheduledProcessPendingDisbursements: 'handleProcessPendingDisbursements',
      scheduledApproveMaturedCommissions: 'handleApproveMaturedCommissions',
      scheduledSendMonthlyReports: 'handleSendMonthlyReports',
      scheduledSyncRiseWorksAccounts: 'handleSyncRiseWorksAccounts',
      scheduledPurgeProcessedWebhookEvents: 'handlePurgeProcessedWebhookEvents',
    };

    it.each(scheduledMethods)(
      '%s no-ops when CRON_ENABLED is unset',
      async (method) => {
        delete process.env['CRON_ENABLED'];
        const handlerName = underlyingHandlerFor[method];
        const spy = jest.spyOn(
          scheduler,
          handlerName as never
        ) as unknown as jest.SpyInstance;

        await scheduler[method]();

        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
      }
    );

    it.each(scheduledMethods)(
      '%s no-ops when CRON_ENABLED is any value other than "true"',
      async (method) => {
        process.env['CRON_ENABLED'] = 'false';
        const handlerName = underlyingHandlerFor[method];
        const spy = jest.spyOn(
          scheduler,
          handlerName as never
        ) as unknown as jest.SpyInstance;

        await scheduler[method]();

        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
      }
    );

    it.each(scheduledMethods)(
      '%s delegates to its handler when CRON_ENABLED="true"',
      async (method) => {
        process.env['CRON_ENABLED'] = 'true';
        const handlerName = underlyingHandlerFor[method];
        const spy = jest
          .spyOn(scheduler, handlerName as never)
          .mockResolvedValue(undefined as never) as unknown as jest.SpyInstance;

        await scheduler[method]();

        expect(spy).toHaveBeenCalledTimes(1);
        spy.mockRestore();
      }
    );
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

    it('handleApproveMaturedCommissions delegates to approveMaturedCommissions and audit-logs the count (F84)', async () => {
      const result = await scheduler.handleApproveMaturedCommissions();

      expect(result).toEqual({ approvedCount: 4 });
      expect(
        disbursementProcessorMock.approveMaturedCommissions
      ).toHaveBeenCalledTimes(1);
      // approval never triggers a payout
      expect(
        disbursementProcessorMock.processAutomatedDisbursements
      ).not.toHaveBeenCalled();
      expect(transactionLoggerMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cron.commissions_auto_approved',
          details: expect.objectContaining({ approvedCount: 4 }),
        })
      );
    });

    it('handlePurgeProcessedWebhookEvents purges through ProcessedWebhookEventService and reports the count', async () => {
      const result = await scheduler.handlePurgeProcessedWebhookEvents();

      expect(result).toEqual({ deleted: 3 });
      expect(processedWebhookEventsMock.purgeOlderThan).toHaveBeenCalledTimes(
        1
      );
    });

    it('handleSyncRiseWorksAccounts delegates to DisbursementProcessorService', async () => {
      await scheduler.handleSyncRiseWorksAccounts();
      expect(
        disbursementProcessorMock.syncRiseWorksAccounts
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('one winner per firing across instances (Remediation Tier 2 §6.9)', () => {
    const originalEnv = process.env['CRON_ENABLED'];

    afterEach(() => {
      process.env['CRON_ENABLED'] = originalEnv;
    });

    const jobs: Array<[keyof CronsScheduler, keyof CronsScheduler, string]> = [
      [
        'scheduledCheckExpiringSubscriptions',
        'handleCheckExpiringSubscriptions',
        'check-expiring-subscriptions',
      ],
      [
        'scheduledDailyMaintenance',
        'handleDailyMaintenance',
        'daily-maintenance',
      ],
      ['scheduledDistributeCodes', 'handleDistributeCodes', 'distribute-codes'],
      [
        'scheduledDowngradeExpiredSubscriptions',
        'handleDowngradeExpiredSubscriptions',
        'downgrade-expired-subscriptions',
      ],
      ['scheduledExpireCodes', 'handleExpireCodes', 'expire-codes'],
      [
        'scheduledProcessPendingDisbursements',
        'handleProcessPendingDisbursements',
        'process-pending-disbursements',
      ],
      [
        'scheduledApproveMaturedCommissions',
        'handleApproveMaturedCommissions',
        'approve-matured-commissions',
      ],
      [
        'scheduledSendMonthlyReports',
        'handleSendMonthlyReports',
        'send-monthly-reports',
      ],
      [
        'scheduledSyncRiseWorksAccounts',
        'handleSyncRiseWorksAccounts',
        'sync-riseworks-accounts',
      ],
      [
        'scheduledWiseReconciliation',
        'handleWiseReconciliation',
        'wise-reconciliation',
      ],
      [
        'scheduledPurgeProcessedWebhookEvents',
        'handlePurgeProcessedWebhookEvents',
        'purge-processed-webhook-events',
      ],
    ];

    it('covers every @Cron entry point', () => {
      const scheduledOnScheduler = Object.getOwnPropertyNames(
        CronsScheduler.prototype
      ).filter((name) => name.startsWith('scheduled'));
      expect(scheduledOnScheduler.sort()).toEqual(
        jobs.map(([method]) => method as string).sort()
      );
    });

    it.each(jobs)(
      '%s asks the lock for "%3$s" and runs its handler when it wins',
      async (method, handler, lockName) => {
        process.env['CRON_ENABLED'] = 'true';
        cronLockMock.acquire.mockResolvedValue(true);
        const spy = jest
          .spyOn(scheduler, handler as never)
          .mockResolvedValue(undefined as never) as unknown as jest.SpyInstance;

        await (scheduler[method] as () => Promise<void>)();

        expect(cronLockMock.acquire).toHaveBeenCalledWith(lockName);
        expect(spy).toHaveBeenCalledTimes(1);
        spy.mockRestore();
      }
    );

    it.each(jobs)(
      '%s skips its handler when another instance already took this run',
      async (method, handler) => {
        process.env['CRON_ENABLED'] = 'true';
        cronLockMock.acquire.mockResolvedValue(false);
        const spy = jest
          .spyOn(scheduler, handler as never)
          .mockResolvedValue(undefined as never) as unknown as jest.SpyInstance;

        await (scheduler[method] as () => Promise<void>)();

        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
      }
    );

    it('does not even ask for the lock while CRON_ENABLED is off', async () => {
      process.env['CRON_ENABLED'] = 'false';

      await scheduler.scheduledProcessPendingDisbursements();

      expect(cronLockMock.acquire).not.toHaveBeenCalled();
    });

    it('lets two instances firing together run the payout job once', async () => {
      process.env['CRON_ENABLED'] = 'true';
      // a real one-winner lock: the first acquire() wins, the next loses
      let taken = false;
      cronLockMock.acquire.mockImplementation(async () => {
        if (taken) return false;
        taken = true;
        return true;
      });

      await Promise.all([
        scheduler.scheduledProcessPendingDisbursements(),
        scheduler.scheduledProcessPendingDisbursements(),
      ]);

      expect(
        disbursementProcessorMock.processAutomatedDisbursements
      ).toHaveBeenCalledTimes(1);
    });

    it('the manual trigger path is NOT behind the lock (an operator can always run a job by hand)', async () => {
      await scheduler.handleProcessPendingDisbursements();

      expect(cronLockMock.acquire).not.toHaveBeenCalled();
      expect(
        disbursementProcessorMock.processAutomatedDisbursements
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('@Cron schedule metadata (DECISION-LOG F84)', () => {
    // @nestjs/schedule's @Cron() stores its options under this key on the
    // decorated method (SCHEDULE_CRON_OPTIONS in its schedule.constants).
    const cronTimeOf = (method: keyof CronsScheduler): unknown =>
      (
        Reflect.getMetadata(
          'SCHEDULE_CRON_OPTIONS',
          CronsScheduler.prototype[method] as object
        ) as { cronTime?: unknown } | undefined
      )?.cronTime;

    it('process-pending-disbursements runs monthly: 1st of the month, 02:00 UTC', () => {
      expect(cronTimeOf('scheduledProcessPendingDisbursements')).toBe(
        '0 2 1 * *'
      );
    });

    it('approve-matured-commissions runs daily at 02:00 UTC', () => {
      expect(cronTimeOf('scheduledApproveMaturedCommissions')).toBe(
        '0 2 * * *'
      );
    });

    it('purge-processed-webhook-events runs daily at 05:30 UTC, clear of the other jobs', () => {
      expect(cronTimeOf('scheduledPurgeProcessedWebhookEvents')).toBe(
        '30 5 * * *'
      );
    });

    it('leaves every other job on its original vercel.json timing', () => {
      expect(cronTimeOf('scheduledCheckExpiringSubscriptions')).toBe(
        '0 0 * * *'
      );
      expect(cronTimeOf('scheduledDailyMaintenance')).toBe('0 4 * * *');
      expect(cronTimeOf('scheduledDistributeCodes')).toBe('0 0 1 * *');
      expect(cronTimeOf('scheduledDowngradeExpiredSubscriptions')).toBe(
        '0 1 * * *'
      );
      expect(cronTimeOf('scheduledExpireCodes')).toBe('59 23 28-31 * *');
      expect(cronTimeOf('scheduledSendMonthlyReports')).toBe('0 6 1 * *');
      expect(cronTimeOf('scheduledSyncRiseWorksAccounts')).toBe('0 3 * * *');
    });
  });
});
