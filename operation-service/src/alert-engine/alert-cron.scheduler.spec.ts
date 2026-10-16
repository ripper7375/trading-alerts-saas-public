/**
 * New coverage for File 10/13 (no monolith test file existed for
 * lib/jobs/queue.ts). Asserts the isRunning concurrency guard (ported
 * verbatim from source) and the active/enable gate this port adds to
 * prevent double-scheduling across the HTTP and worker processes sharing
 * one module graph.
 */

import { AlertCronScheduler } from './alert-cron.scheduler';

describe('AlertCronScheduler', () => {
  let checkAlerts: jest.Mock;
  let acquire: jest.Mock;
  let scheduler: AlertCronScheduler;

  beforeEach(() => {
    checkAlerts = jest.fn().mockResolvedValue(undefined);
    // Remediation Tier 2 §6.9: by default this worker wins the cross-worker lock.
    acquire = jest.fn().mockResolvedValue(true);
    const alertChecker = {
      checkAlerts,
    } as unknown as ConstructorParameters<typeof AlertCronScheduler>[0];
    const cronLock = {
      acquire,
    } as unknown as ConstructorParameters<typeof AlertCronScheduler>[1];
    scheduler = new AlertCronScheduler(alertChecker, cronLock);
  });

  it('tick() is a no-op until enable() is called', async () => {
    await scheduler.tick();
    expect(checkAlerts).not.toHaveBeenCalled();

    scheduler.enable();
    await scheduler.tick();
    expect(checkAlerts).toHaveBeenCalledTimes(1);
  });

  it('disable() stops future ticks from running', async () => {
    scheduler.enable();
    scheduler.disable();
    await scheduler.tick();
    expect(checkAlerts).not.toHaveBeenCalled();
  });

  it('isRunning guard: a second concurrent trigger is skipped while the first is in-flight', async () => {
    let resolveFirst: () => void = () => {};
    checkAlerts.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve;
        })
    );

    const first = scheduler.triggerAlertCheck();
    const second = scheduler.triggerAlertCheck(); // should be skipped, first still in-flight

    resolveFirst();
    await Promise.all([first, second]);

    expect(checkAlerts).toHaveBeenCalledTimes(1);
  });

  it('a fresh trigger after completion is not blocked', async () => {
    await scheduler.triggerAlertCheck();
    await scheduler.triggerAlertCheck();

    expect(checkAlerts).toHaveBeenCalledTimes(2);
  });

  describe('one worker per tick (Remediation Tier 2 §6.9)', () => {
    it('asks for the "alert-checker" lock, held just under the 60 s interval', async () => {
      scheduler.enable();

      await scheduler.tick();

      expect(acquire).toHaveBeenCalledWith('alert-checker', 55_000);
      expect(checkAlerts).toHaveBeenCalledTimes(1);
    });

    it('skips the check when another worker already took this tick', async () => {
      scheduler.enable();
      acquire.mockResolvedValue(false);

      await scheduler.tick();

      expect(checkAlerts).not.toHaveBeenCalled();
    });

    it('does not ask for the lock at all while the scheduler is not enabled (the HTTP process)', async () => {
      await scheduler.tick();

      expect(acquire).not.toHaveBeenCalled();
    });

    it('lets exactly one of two workers ticking together run the check', async () => {
      scheduler.enable();
      let taken = false;
      acquire.mockImplementation(async () => {
        if (taken) return false;
        taken = true;
        return true;
      });
      const otherWorker = new AlertCronScheduler(
        { checkAlerts } as unknown as ConstructorParameters<
          typeof AlertCronScheduler
        >[0],
        { acquire } as unknown as ConstructorParameters<
          typeof AlertCronScheduler
        >[1]
      );
      otherWorker.enable();

      await Promise.all([scheduler.tick(), otherWorker.tick()]);

      expect(checkAlerts).toHaveBeenCalledTimes(1);
    });

    it('a manual trigger is not behind the lock', async () => {
      await scheduler.triggerAlertCheck();

      expect(acquire).not.toHaveBeenCalled();
      expect(checkAlerts).toHaveBeenCalledTimes(1);
    });
  });

  it('getStatus reports running/interval/lastRun', async () => {
    expect(scheduler.getStatus().running).toBe(false);
    await scheduler.triggerAlertCheck();
    const status = scheduler.getStatus();
    expect(status.running).toBe(false);
    expect(status.interval).toBe(60000);
    expect(status.lastRun).toBeInstanceOf(Date);
  });
});
