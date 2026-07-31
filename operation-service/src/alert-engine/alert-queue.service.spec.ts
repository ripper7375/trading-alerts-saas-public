/**
 * New coverage for File 8/13 (no monolith test file existed for
 * lib/alert-engine/queue.ts). No live Redis is available in this test
 * environment, so `bullmq`'s Queue/Worker are mocked — this asserts OUR
 * deterministic jobId derivation (alertId:time:levelId) is stable for
 * repeated enqueues of the same fire, which is what BullMQ's own
 * well-documented jobId-based dedupe relies on to collapse them into a
 * single job. Proving BullMQ's own dedupe enforcement end-to-end would need
 * a live Redis instance, out of this unit test's scope.
 */

const addMock = jest.fn();
const closeQueueMock = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: addMock,
    close: closeQueueMock,
  })),
  Worker: jest.fn().mockImplementation(() => ({
    close: jest.fn(),
  })),
}));

import { AlertQueueService } from './alert-queue.service';
import type { FireEvent } from './types';

const fire: FireEvent = {
  alertId: 'a1',
  userId: 'u1',
  symbol: 'XAUUSD',
  timeframe: 'M10',
  levelId: 'channel_top',
  levelPrice: 2050,
  touchPrice: 2050.4,
  time: 1717000000,
  oneShot: false,
};

describe('AlertQueueService', () => {
  let service: AlertQueueService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AlertQueueService();
  });

  it('derives the same deterministic jobId on enqueue-twice-same-bar (dedupe key)', async () => {
    await service.enqueueFire(fire);
    await service.enqueueFire(fire);

    expect(addMock).toHaveBeenCalledTimes(2);
    const [firstJobId] = [addMock.mock.calls[0][2].jobId];
    const [secondJobId] = [addMock.mock.calls[1][2].jobId];
    expect(firstJobId).toBe(secondJobId);
    expect(firstJobId).toBe('a1:1717000000:channel_top');
  });

  it('enqueues with retry/backoff options matching the source', async () => {
    await service.enqueueFire(fire);

    expect(addMock).toHaveBeenCalledWith(
      'fire',
      fire,
      expect.objectContaining({
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      })
    );
  });

  it('closes the queue on module destroy', async () => {
    await service.onModuleDestroy();
    expect(closeQueueMock).toHaveBeenCalled();
  });
});
