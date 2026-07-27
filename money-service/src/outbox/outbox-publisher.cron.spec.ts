import type { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../test-utils/prisma-mock';

import { OutboxPublisherCron } from './outbox-publisher.cron';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function makeEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'event-1',
    aggregateType: 'User',
    aggregateId: 'user-1',
    eventType: 'TIER_UPGRADED',
    payload: { tier: 'PRO' },
    status: 'PENDING',
    processedAt: null,
    attemptCount: 0,
    lastError: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('OutboxPublisherCron', () => {
  let cron: OutboxPublisherCron;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock = createPrismaMock();
    cron = new OutboxPublisherCron(prismaMock as unknown as PrismaService);
    process.env = { ...originalEnv };
    process.env['OUTBOX_PUBLISHER_TARGET_URL'] =
      'http://operation-service.test/v1/internal/tier-events';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('publishPendingEvents', () => {
    it('marks an event PROCESSED after a successful delivery', async () => {
      const event = makeEvent();
      prismaMock.outboxEvent.findMany.mockResolvedValue([event] as never);
      prismaMock.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.outboxEvent.update.mockResolvedValue({} as never);
      mockFetch.mockResolvedValue({ ok: true });

      const result = await cron.publishPendingEvents();

      expect(result).toEqual({ published: 1, failed: 0, deadLettered: 0 });
      expect(prismaMock.outboxEvent.updateMany).toHaveBeenCalledWith({
        where: { id: 'event-1', status: 'PENDING' },
        data: { status: 'PROCESSING' },
      });
      expect(prismaMock.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        data: { status: 'PROCESSED', processedAt: expect.any(Date) },
      });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://operation-service.test/v1/internal/tier-events',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('skips an event a concurrent replica already claimed', async () => {
      const event = makeEvent();
      prismaMock.outboxEvent.findMany.mockResolvedValue([event] as never);
      prismaMock.outboxEvent.updateMany.mockResolvedValue({ count: 0 });

      const result = await cron.publishPendingEvents();

      expect(result).toEqual({ published: 0, failed: 0, deadLettered: 0 });
      expect(mockFetch).not.toHaveBeenCalled();
      expect(prismaMock.outboxEvent.update).not.toHaveBeenCalled();
    });

    it('re-queues (stays PENDING) a failed delivery below the dead-letter threshold', async () => {
      const event = makeEvent({ attemptCount: 1 });
      prismaMock.outboxEvent.findMany.mockResolvedValue([event] as never);
      prismaMock.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.outboxEvent.update.mockResolvedValue({} as never);
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const result = await cron.publishPendingEvents();

      expect(result).toEqual({ published: 0, failed: 1, deadLettered: 0 });
      expect(prismaMock.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        data: {
          status: 'PENDING',
          attemptCount: 2,
          lastError: expect.stringContaining('500'),
        },
      });
    }, 20000);

    it('dead-letters (status FAILED) once attemptCount reaches the max', async () => {
      const event = makeEvent({ attemptCount: 4 });
      prismaMock.outboxEvent.findMany.mockResolvedValue([event] as never);
      prismaMock.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.outboxEvent.update.mockResolvedValue({} as never);
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const result = await cron.publishPendingEvents();

      expect(result).toEqual({ published: 0, failed: 1, deadLettered: 1 });
      expect(prismaMock.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        data: {
          status: 'FAILED',
          attemptCount: 5,
          lastError: expect.any(String),
        },
      });
    }, 20000);

    it('fails immediately (no fetch attempts) when no target URL is configured', async () => {
      delete process.env['OUTBOX_PUBLISHER_TARGET_URL'];
      const event = makeEvent();
      prismaMock.outboxEvent.findMany.mockResolvedValue([event] as never);
      prismaMock.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.outboxEvent.update.mockResolvedValue({} as never);

      const result = await cron.publishPendingEvents();

      expect(result.failed).toBe(1);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(prismaMock.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        data: expect.objectContaining({
          lastError: expect.stringContaining('not configured'),
        }),
      });
    });

    it('retries within a single delivery attempt before succeeding', async () => {
      const event = makeEvent();
      prismaMock.outboxEvent.findMany.mockResolvedValue([event] as never);
      prismaMock.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.outboxEvent.update.mockResolvedValue({} as never);
      mockFetch
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce({ ok: true });

      const result = await cron.publishPendingEvents();

      expect(result).toEqual({ published: 1, failed: 0, deadLettered: 0 });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    }, 20000);
  });

  describe('scheduledPublishPendingEvents', () => {
    it('does nothing when OUTBOX_PUBLISHER_ENABLED is not "true"', async () => {
      delete process.env['OUTBOX_PUBLISHER_ENABLED'];
      const spy = jest.spyOn(cron, 'publishPendingEvents');

      await cron.scheduledPublishPendingEvents();

      expect(spy).not.toHaveBeenCalled();
    });

    it('calls publishPendingEvents when OUTBOX_PUBLISHER_ENABLED is "true"', async () => {
      process.env['OUTBOX_PUBLISHER_ENABLED'] = 'true';
      const spy = jest
        .spyOn(cron, 'publishPendingEvents')
        .mockResolvedValue({ published: 0, failed: 0, deadLettered: 0 });

      await cron.scheduledPublishPendingEvents();

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
