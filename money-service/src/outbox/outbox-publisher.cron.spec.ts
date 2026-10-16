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

  /**
   * `outboxEvent.updateMany` is used twice per tick: once to recover rows stuck in
   * PROCESSING (where.status === 'PROCESSING') and once per event to claim it
   * (where.status === 'PENDING'). The two answer independently.
   */
  function stubUpdateMany({
    claim = 1,
    recovered = 0,
  }: { claim?: number; recovered?: number } = {}) {
    prismaMock.outboxEvent.updateMany.mockImplementation((async (args: {
      where: { status: string };
    }) => ({
      count: args.where.status === 'PROCESSING' ? recovered : claim,
    })) as never);
  }

  const claimCalls = () =>
    prismaMock.outboxEvent.updateMany.mock.calls.filter(
      (call) =>
        (call[0] as { where: { status: string } }).where.status === 'PENDING'
    );
  const recoveryCalls = () =>
    prismaMock.outboxEvent.updateMany.mock.calls.filter(
      (call) =>
        (call[0] as { where: { status: string } }).where.status === 'PROCESSING'
    );

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock = createPrismaMock();
    cron = new OutboxPublisherCron(prismaMock as unknown as PrismaService);
    process.env = { ...originalEnv };
    process.env['OUTBOX_PUBLISHER_TARGET_URL'] =
      'http://operation-service.test/v1/internal/tier-events';
    stubUpdateMany();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('publishPendingEvents', () => {
    it('marks an event PROCESSED after a successful delivery', async () => {
      const event = makeEvent();
      prismaMock.outboxEvent.findMany.mockResolvedValue([event] as never);
      prismaMock.outboxEvent.update.mockResolvedValue({} as never);
      mockFetch.mockResolvedValue({ ok: true });

      const result = await cron.publishPendingEvents();

      expect(result).toEqual({
        published: 1,
        failed: 0,
        deadLettered: 0,
        recovered: 0,
      });
      expect(claimCalls()).toEqual([
        [
          {
            where: { id: 'event-1', status: 'PENDING' },
            // the claim time, so a row left in PROCESSING can be recognised
            data: { status: 'PROCESSING', processedAt: expect.any(Date) },
          },
        ],
      ]);
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
      stubUpdateMany({ claim: 0 });

      const result = await cron.publishPendingEvents();

      expect(result).toEqual({
        published: 0,
        failed: 0,
        deadLettered: 0,
        recovered: 0,
      });
      expect(mockFetch).not.toHaveBeenCalled();
      expect(prismaMock.outboxEvent.update).not.toHaveBeenCalled();
    });

    it('re-queues (stays PENDING) a failed delivery below the dead-letter threshold', async () => {
      const event = makeEvent({ attemptCount: 1 });
      prismaMock.outboxEvent.findMany.mockResolvedValue([event] as never);
      prismaMock.outboxEvent.update.mockResolvedValue({} as never);
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const result = await cron.publishPendingEvents();

      expect(result).toEqual({
        published: 0,
        failed: 1,
        deadLettered: 0,
        recovered: 0,
      });
      expect(prismaMock.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        data: {
          status: 'PENDING',
          attemptCount: 2,
          lastError: expect.stringContaining('500'),
          // the claim ended without a delivery
          processedAt: null,
        },
      });
    }, 20000);

    it('dead-letters (status FAILED) once attemptCount reaches the max', async () => {
      const event = makeEvent({ attemptCount: 4 });
      prismaMock.outboxEvent.findMany.mockResolvedValue([event] as never);
      prismaMock.outboxEvent.update.mockResolvedValue({} as never);
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const result = await cron.publishPendingEvents();

      expect(result).toEqual({
        published: 0,
        failed: 1,
        deadLettered: 1,
        recovered: 0,
      });
      expect(prismaMock.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        data: {
          status: 'FAILED',
          attemptCount: 5,
          lastError: expect.any(String),
          processedAt: null,
        },
      });
    }, 20000);

    it('fails immediately (no fetch attempts) when no target URL is configured', async () => {
      delete process.env['OUTBOX_PUBLISHER_TARGET_URL'];
      const event = makeEvent();
      prismaMock.outboxEvent.findMany.mockResolvedValue([event] as never);
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

    it('sends the SVC_TOKEN as a Bearer Authorization header', async () => {
      process.env['SVC_TOKEN'] = 'test-svc-token';
      const event = makeEvent();
      prismaMock.outboxEvent.findMany.mockResolvedValue([event] as never);
      prismaMock.outboxEvent.update.mockResolvedValue({} as never);
      mockFetch.mockResolvedValue({ ok: true });

      await cron.publishPendingEvents();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://operation-service.test/v1/internal/tier-events',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-svc-token',
          }),
        })
      );
    });

    it('retries within a single delivery attempt before succeeding', async () => {
      const event = makeEvent();
      prismaMock.outboxEvent.findMany.mockResolvedValue([event] as never);
      prismaMock.outboxEvent.update.mockResolvedValue({} as never);
      mockFetch
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce({ ok: true });

      const result = await cron.publishPendingEvents();

      expect(result).toEqual({
        published: 1,
        failed: 0,
        deadLettered: 0,
        recovered: 0,
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    }, 20000);

    it('gives every delivery a timeout, so one hung connection cannot block the publisher', async () => {
      const event = makeEvent();
      prismaMock.outboxEvent.findMany.mockResolvedValue([event] as never);
      prismaMock.outboxEvent.update.mockResolvedValue({} as never);
      mockFetch.mockResolvedValue({ ok: true });

      await cron.publishPendingEvents();

      const init = mockFetch.mock.calls[0]?.[1] as { signal?: AbortSignal };
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    describe('rows stuck in PROCESSING (Remediation Tier 2 §6.6)', () => {
      it('puts a PROCESSING row whose claim is older than 5 minutes back to PENDING, before it polls', async () => {
        const before = Date.now();
        prismaMock.outboxEvent.findMany.mockResolvedValue([]);
        stubUpdateMany({ recovered: 2 });

        const result = await cron.publishPendingEvents();

        expect(result.recovered).toBe(2);
        expect(recoveryCalls()).toHaveLength(1);
        const args = recoveryCalls()[0]?.[0] as {
          where: {
            status: string;
            OR: Array<{
              processedAt: { lt: Date } | null;
              createdAt?: { lt: Date };
            }>;
          };
          data: unknown;
        };
        expect(args.data).toEqual({ status: 'PENDING', processedAt: null });
        // a claim older than 5 minutes ...
        const stale = args.where.OR[0] as { processedAt: { lt: Date } };
        expect(stale.processedAt.lt.getTime()).toBeLessThanOrEqual(
          Date.now() - 5 * 60 * 1000
        );
        expect(stale.processedAt.lt.getTime()).toBeGreaterThanOrEqual(
          before - 5 * 60 * 1000 - 1000
        );
        // ... or one from before claim times were recorded, created over 30 minutes ago
        const legacy = args.where.OR[1] as {
          processedAt: null;
          createdAt: { lt: Date };
        };
        expect(legacy.processedAt).toBeNull();
        expect(legacy.createdAt.lt.getTime()).toBeLessThanOrEqual(
          Date.now() - 30 * 60 * 1000
        );
        expect(
          prismaMock.outboxEvent.updateMany.mock.invocationCallOrder[0]
        ).toBeLessThan(
          prismaMock.outboxEvent.findMany.mock.invocationCallOrder[0] as number
        );
      });

      it('never touches a row that is not PROCESSING', async () => {
        prismaMock.outboxEvent.findMany.mockResolvedValue([]);

        await cron.publishPendingEvents();

        expect(
          (recoveryCalls()[0]?.[0] as { where: { status: string } }).where
            .status
        ).toBe('PROCESSING');
      });

      it('still delivers what is pending when the recovery itself fails', async () => {
        const event = makeEvent();
        prismaMock.outboxEvent.findMany.mockResolvedValue([event] as never);
        prismaMock.outboxEvent.update.mockResolvedValue({} as never);
        mockFetch.mockResolvedValue({ ok: true });
        prismaMock.outboxEvent.updateMany.mockImplementation((async (args: {
          where: { status: string };
        }) => {
          if (args.where.status === 'PROCESSING') throw new Error('db blip');
          return { count: 1 };
        }) as never);

        const result = await cron.publishPendingEvents();

        expect(result).toEqual({
          published: 1,
          failed: 0,
          deadLettered: 0,
          recovered: 0,
        });
      });
    });
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
      const spy = jest.spyOn(cron, 'publishPendingEvents').mockResolvedValue({
        published: 0,
        failed: 0,
        deadLettered: 0,
        recovered: 0,
      });

      await cron.scheduledPublishPendingEvents();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    describe('one tick at a time (Remediation Tier 2 §6.6)', () => {
      const emptyResult = {
        published: 0,
        failed: 0,
        deadLettered: 0,
        recovered: 0,
      };
      let finishTick: () => void;
      let spy: jest.SpyInstance;

      beforeEach(() => {
        process.env['OUTBOX_PUBLISHER_ENABLED'] = 'true';
        // a tick that takes as long as the test lets it
        spy = jest.spyOn(cron, 'publishPendingEvents').mockImplementation(
          () =>
            new Promise((resolve) => {
              finishTick = () => resolve(emptyResult);
            })
        );
      });

      it('does not start a second tick while the first is still running', async () => {
        const first = cron.scheduledPublishPendingEvents();
        await cron.scheduledPublishPendingEvents();
        await cron.scheduledPublishPendingEvents();

        expect(spy).toHaveBeenCalledTimes(1);

        finishTick();
        await first;
      });

      it('starts the next tick once the first has finished', async () => {
        const first = cron.scheduledPublishPendingEvents();
        finishTick();
        await first;

        const second = cron.scheduledPublishPendingEvents();
        expect(spy).toHaveBeenCalledTimes(2);
        finishTick();
        await second;
      });

      it('frees the slot even when the tick throws', async () => {
        spy.mockRejectedValueOnce(new Error('db down'));

        await expect(cron.scheduledPublishPendingEvents()).rejects.toThrow(
          'db down'
        );

        const next = cron.scheduledPublishPendingEvents();
        expect(spy).toHaveBeenCalledTimes(2);
        finishTick();
        await next;
      });

      it('replaces a tick that has been running for over 2 minutes (a hung call), and does not run three at once', async () => {
        const clock = jest.spyOn(Date, 'now');
        const finishers: Array<() => void> = [];
        spy.mockImplementation(
          () =>
            new Promise((resolve) => {
              finishers.push(() => resolve(emptyResult));
            })
        );
        clock.mockReturnValue(1_000_000);
        const hung = cron.scheduledPublishPendingEvents();
        expect(spy).toHaveBeenCalledTimes(1);

        // 1 minute later: still the first tick's turn
        clock.mockReturnValue(1_000_000 + 60_000);
        await cron.scheduledPublishPendingEvents();
        expect(spy).toHaveBeenCalledTimes(1);

        // 2 minutes and a second later: the first is presumed dead
        clock.mockReturnValue(1_000_000 + 121_000);
        const replacement = cron.scheduledPublishPendingEvents();
        expect(spy).toHaveBeenCalledTimes(2);

        // and the replacement now holds the slot
        clock.mockReturnValue(1_000_000 + 126_000);
        await cron.scheduledPublishPendingEvents();
        expect(spy).toHaveBeenCalledTimes(2);

        finishers.forEach((finish) => finish());
        await Promise.all([hung, replacement]);
      });

      it("lets a late-finishing replaced tick leave the newer tick's slot alone", async () => {
        const clock = jest.spyOn(Date, 'now');
        const finishers: Array<() => void> = [];
        spy.mockImplementation(
          () =>
            new Promise((resolve) => {
              finishers.push(() => resolve(emptyResult));
            })
        );

        clock.mockReturnValue(2_000_000);
        const oldTick = cron.scheduledPublishPendingEvents();
        clock.mockReturnValue(2_000_000 + 121_000);
        const newTick = cron.scheduledPublishPendingEvents();
        expect(spy).toHaveBeenCalledTimes(2);

        // the OLD tick finally returns: it must not free the NEW tick's slot
        finishers[0]?.();
        await oldTick;
        clock.mockReturnValue(2_000_000 + 125_000);
        await cron.scheduledPublishPendingEvents();
        expect(spy).toHaveBeenCalledTimes(2);

        finishers[1]?.();
        await newTick;
      });
    });
  });
});
