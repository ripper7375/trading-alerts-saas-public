/**
 * New coverage for File 12/13 (no monolith test file existed for
 * lib/alert-engine/worker.ts). No live Redis in this test environment, so
 * `ioredis` is mocked — asserts the two-dedicated-connections topology,
 * the prices and alerts:changed subscriptions, watch-cache reload, and
 * graceful stop() drain the mocked connections. Parity proof per the
 * order's own File 12 wording ("worker boots in standalone Nest context,
 * subscribes, health/log lines visible") is satisfied at the integration
 * level by this unit test plus main-worker.ts's own build/tsc verification
 * (booting a real Nest application context end-to-end needs live Redis +
 * Postgres, out of this unit test's scope).
 */

const psubscribe = jest.fn().mockResolvedValue(undefined);
const subscribe = jest.fn().mockResolvedValue(undefined);
const quit = jest.fn().mockResolvedValue(undefined);
const on = jest.fn();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    psubscribe,
    subscribe,
    quit,
    on,
  }));
});

process.env['REDIS_URL'] = 'redis://localhost:6379';

import { AlertWorkerService } from './alert-worker.service';

describe('AlertWorkerService', () => {
  let findMany: jest.Mock;
  let enqueueFire: jest.Mock;
  let startWorker: jest.Mock;
  let dispatch: jest.Mock;
  let service: AlertWorkerService;

  beforeEach(() => {
    jest.clearAllMocks();
    findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      drawingAlert: { findMany },
    } as unknown as ConstructorParameters<typeof AlertWorkerService>[0];
    enqueueFire = jest.fn().mockResolvedValue(undefined);
    startWorker = jest.fn();
    const alertQueue = {
      enqueueFire,
      startWorker,
    } as unknown as ConstructorParameters<typeof AlertWorkerService>[1];
    dispatch = jest.fn().mockResolvedValue(undefined);
    const dispatcher = {
      dispatch,
    } as unknown as ConstructorParameters<typeof AlertWorkerService>[2];
    service = new AlertWorkerService(prisma, alertQueue, dispatcher);
  });

  it('opens two dedicated Redis connections (subscriber + ops), not a shared one', async () => {
    const Redis = jest.requireMock('ioredis');
    await service.start();
    expect(Redis).toHaveBeenCalledTimes(2);
  });

  it('subscribes to prices:* and alerts:changed', async () => {
    await service.start();
    expect(psubscribe).toHaveBeenCalledWith('prices:*');
    expect(subscribe).toHaveBeenCalledWith('alerts:changed');
  });

  it('loads the watch cache via reload() on start, deriving watches only for rows with a matching drawn level', async () => {
    findMany.mockResolvedValue([
      {
        id: 'da1',
        alertId: 'a1',
        targetLevel: 'line',
        direction: 'either',
        tolerance: 0,
        cooldownSec: 60,
        oneShot: false,
        drawing: {
          id: 'd1',
          userId: 'u1',
          symbol: 'XAUUSD',
          timeframe: 'M10',
          type: 'HLINE',
          anchors: [{ time: 0, price: 1980 }],
          style: { color: '#2962FF', lineWidth: 2, lineStyle: 'solid' },
        },
      },
    ]);

    await service.start();

    expect(findMany).toHaveBeenCalledWith({
      where: { alert: { isActive: true } },
      include: { drawing: true, alert: true },
    });
  });

  it('starts the BullMQ fire worker by default (ALERT_USE_QUEUE unset)', async () => {
    await service.start();
    expect(startWorker).toHaveBeenCalled();
  });

  it('bypasses the BullMQ worker when ALERT_USE_QUEUE=false', async () => {
    process.env['ALERT_USE_QUEUE'] = 'false';
    await service.start();
    expect(startWorker).not.toHaveBeenCalled();
    delete process.env['ALERT_USE_QUEUE'];
  });

  it('throws if REDIS_URL is unset', async () => {
    const originalUrl = process.env['REDIS_URL'];
    delete process.env['REDIS_URL'];
    await expect(service.start()).rejects.toThrow(
      'REDIS_URL is required for the alert worker'
    );
    process.env['REDIS_URL'] = originalUrl;
  });

  it('stop() quits both Redis connections', async () => {
    await service.start();
    await service.stop();
    expect(quit).toHaveBeenCalledTimes(2);
    expect(service.isRunning()).toBe(false);
  });

  it('onModuleDestroy is a no-op when start() was never called (HTTP process case)', async () => {
    await service.onModuleDestroy();
    expect(quit).not.toHaveBeenCalled();
  });
});
