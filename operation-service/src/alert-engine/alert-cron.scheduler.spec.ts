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
  let scheduler: AlertCronScheduler;

  beforeEach(() => {
    checkAlerts = jest.fn().mockResolvedValue(undefined);
    const alertChecker = {
      checkAlerts,
    } as unknown as ConstructorParameters<typeof AlertCronScheduler>[0];
    scheduler = new AlertCronScheduler(alertChecker);
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

  it('getStatus reports running/interval/lastRun', async () => {
    expect(scheduler.getStatus().running).toBe(false);
    await scheduler.triggerAlertCheck();
    const status = scheduler.getStatus();
    expect(status.running).toBe(false);
    expect(status.interval).toBe(60000);
    expect(status.lastRun).toBeInstanceOf(Date);
  });
});
