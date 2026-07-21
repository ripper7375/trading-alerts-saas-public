/**
 * Cron Trigger Controller Tests (Session 4A-2, File 6/6)
 *
 * New code, no direct SOURCE. Confirms each endpoint calls the exact
 * scheduler method it's supposed to and returns its result — the guard
 * itself is tested separately in cron-secret.guard.spec.ts.
 */
import { Test } from '@nestjs/testing';

import { CronTriggerController } from './cron-trigger.controller';
import { CronsScheduler } from './crons.scheduler';

describe('CronTriggerController', () => {
  let controller: CronTriggerController;
  let schedulerMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    schedulerMock = {
      handleCheckExpiringSubscriptions: jest.fn().mockResolvedValue({ ok: 1 }),
      handleDailyMaintenance: jest.fn().mockResolvedValue({ ok: 2 }),
      handleDistributeCodes: jest.fn().mockResolvedValue({ ok: 3 }),
      handleDowngradeExpiredSubscriptions: jest
        .fn()
        .mockResolvedValue({ ok: 4 }),
      handleExpireCodes: jest.fn().mockResolvedValue({ ok: 5 }),
      handleProcessPendingDisbursements: jest.fn().mockResolvedValue({ ok: 6 }),
      handleSendMonthlyReports: jest.fn().mockResolvedValue({ ok: 7 }),
      handleSyncRiseWorksAccounts: jest.fn().mockResolvedValue({ ok: 8 }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [CronTriggerController],
      providers: [{ provide: CronsScheduler, useValue: schedulerMock }],
    }).compile();

    controller = moduleRef.get(CronTriggerController);
  });

  it('checkExpiringSubscriptions calls the scheduler and returns its result', async () => {
    await expect(controller.checkExpiringSubscriptions()).resolves.toEqual({
      ok: 1,
    });
    expect(
      schedulerMock.handleCheckExpiringSubscriptions
    ).toHaveBeenCalledTimes(1);
  });

  it('dailyMaintenance calls the scheduler', async () => {
    await expect(controller.dailyMaintenance()).resolves.toEqual({ ok: 2 });
  });

  it('distributeCodes calls the scheduler', async () => {
    await expect(controller.distributeCodes()).resolves.toEqual({ ok: 3 });
  });

  it('downgradeExpiredSubscriptions calls the scheduler', async () => {
    await expect(controller.downgradeExpiredSubscriptions()).resolves.toEqual({
      ok: 4,
    });
  });

  it('expireCodes calls the scheduler', async () => {
    await expect(controller.expireCodes()).resolves.toEqual({ ok: 5 });
  });

  it('processPendingDisbursements calls the scheduler', async () => {
    await expect(controller.processPendingDisbursements()).resolves.toEqual({
      ok: 6,
    });
  });

  it('sendMonthlyReports calls the scheduler', async () => {
    await expect(controller.sendMonthlyReports()).resolves.toEqual({ ok: 7 });
  });

  it('syncRiseWorksAccounts calls the scheduler', async () => {
    await expect(controller.syncRiseWorksAccounts()).resolves.toEqual({
      ok: 8,
    });
  });
});
