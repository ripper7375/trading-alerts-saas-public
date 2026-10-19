import { Logger } from '@nestjs/common';

import type { CronLockService } from '../alert-engine/cron-lock.service';
import { AccountDeletionScheduler } from './account-deletion.scheduler';
import type { AccountDeletionWorker } from './account-deletion.worker';

describe('AccountDeletionScheduler', () => {
  let processDueRequests: jest.Mock;
  let acquire: jest.Mock;
  let scheduler: AccountDeletionScheduler;

  beforeEach(() => {
    processDueRequests = jest.fn().mockResolvedValue({
      due: 0,
      completed: 0,
      skipped: 0,
      failed: 0,
    });
    acquire = jest.fn().mockResolvedValue(true);
    scheduler = new AccountDeletionScheduler(
      { processDueRequests } as unknown as AccountDeletionWorker,
      { acquire } as unknown as CronLockService
    );
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('does nothing until main-worker.ts enables it (the HTTP process never does)', async () => {
    await scheduler.tick();

    expect(acquire).not.toHaveBeenCalled();
    expect(processDueRequests).not.toHaveBeenCalled();
    expect(scheduler.isEnabled()).toBe(false);
  });

  it('runs the worker once the process has won the lock', async () => {
    scheduler.enable();

    await scheduler.tick();

    expect(acquire).toHaveBeenCalledWith(
      'account-deletion',
      expect.any(Number)
    );
    expect(processDueRequests).toHaveBeenCalledTimes(1);
  });

  it('holds the lock for less than the interval, so the next tick can win it', async () => {
    scheduler.enable();
    await scheduler.tick();

    const ttl = acquire.mock.calls[0][1] as number;
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThan(5 * 60 * 1000);
  });

  it('skips the tick when another worker holds the lock', async () => {
    scheduler.enable();
    acquire.mockResolvedValue(false);

    await scheduler.tick();

    expect(processDueRequests).not.toHaveBeenCalled();
  });

  it('does not start a second run while one is in progress', async () => {
    scheduler.enable();
    let release: () => void = () => undefined;
    processDueRequests.mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      })
    );

    const first = scheduler.tick();
    await Promise.resolve();
    await Promise.resolve();
    await scheduler.tick();
    release();
    await first;

    expect(processDueRequests).toHaveBeenCalledTimes(1);
  });

  it('survives a failed search and runs again on the next tick', async () => {
    scheduler.enable();
    processDueRequests.mockRejectedValueOnce(new Error('database down'));

    await expect(scheduler.tick()).resolves.toBeUndefined();
    await scheduler.tick();

    expect(processDueRequests).toHaveBeenCalledTimes(2);
  });

  it('stops running after disable()', async () => {
    scheduler.enable();
    scheduler.disable();

    await scheduler.tick();

    expect(processDueRequests).not.toHaveBeenCalled();
  });
});
