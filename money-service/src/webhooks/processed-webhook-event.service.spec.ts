import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../test-utils/prisma-mock';

import {
  CLAIM_LEASE_MS,
  PROCESSED_EVENT_RETENTION_MS,
  ProcessedWebhookEventService,
} from './processed-webhook-event.service';

/**
 * Remediation Tier 2 §6.1: the claim / complete / release protocol. The table
 * itself is proven against a real PostgreSQL in the session hand-off; these
 * tests pin the decisions the service takes on each database answer.
 */
describe('ProcessedWebhookEventService', () => {
  let service: ProcessedWebhookEventService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProcessedWebhookEventService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = moduleRef.get(ProcessedWebhookEventService);
  });

  describe('claim', () => {
    it("claims an event nobody has seen: inserts (provider, eventId) skipping duplicates, and says 'claimed'", async () => {
      prismaMock.processedWebhookEvent.createMany.mockResolvedValue({
        count: 1,
      });

      await expect(service.claim('stripe', 'evt_1')).resolves.toBe('claimed');

      // ON CONFLICT DO NOTHING: a duplicate is a count of 0, not an error
      expect(prismaMock.processedWebhookEvent.createMany).toHaveBeenCalledWith({
        data: [
          { provider: 'stripe', eventId: 'evt_1', createdAt: expect.any(Date) },
        ],
        skipDuplicates: true,
      });
      expect(
        prismaMock.processedWebhookEvent.updateMany
      ).not.toHaveBeenCalled();
    });

    it("says 'duplicate' when the event is already claimed and the claim is within its lease", async () => {
      prismaMock.processedWebhookEvent.createMany.mockResolvedValue({
        count: 0,
      });
      // the conditional take-over matches nothing: finished, or still being worked on
      prismaMock.processedWebhookEvent.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(service.claim('stripe', 'evt_1')).resolves.toBe('duplicate');
    });

    it('takes over a claim that never completed and is older than the lease, with ONE conditional update', async () => {
      prismaMock.processedWebhookEvent.createMany.mockResolvedValue({
        count: 0,
      });
      prismaMock.processedWebhookEvent.updateMany.mockResolvedValue({
        count: 1,
      });
      const before = Date.now();

      await expect(service.claim('stripe', 'evt_1')).resolves.toBe('claimed');

      const call = prismaMock.processedWebhookEvent.updateMany.mock
        .calls[0]?.[0] as {
        where: {
          provider: string;
          eventId: string;
          completedAt: null;
          createdAt: { lt: Date };
        };
        data: { createdAt: Date };
      };
      // only an UNFINISHED claim ...
      expect(call.where.completedAt).toBeNull();
      expect(call.where.provider).toBe('stripe');
      expect(call.where.eventId).toBe('evt_1');
      // ... older than the lease
      const cutoff = call.where.createdAt.lt.getTime();
      expect(cutoff).toBeLessThanOrEqual(Date.now() - CLAIM_LEASE_MS);
      expect(cutoff).toBeGreaterThanOrEqual(before - CLAIM_LEASE_MS - 1000);
      // and the lease restarts for the new owner
      expect(call.data.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('lets exactly one of two retries win a take-over (the loser matches no row)', async () => {
      prismaMock.processedWebhookEvent.createMany.mockResolvedValue({
        count: 0,
      });
      prismaMock.processedWebhookEvent.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      const results = await Promise.all([
        service.claim('stripe', 'evt_1'),
        service.claim('stripe', 'evt_1'),
      ]);

      expect(results.sort()).toEqual(['claimed', 'duplicate']);
    });

    it("fails OPEN ('unavailable') when the table cannot be used, so billing webhooks keep working", async () => {
      for (const error of [
        Object.assign(new Error('relation does not exist'), { code: 'P2021' }),
        Object.assign(new Error('permission denied for table'), {
          code: 'P2010',
        }),
        new Error('connection refused'),
        'a string, not an Error',
      ]) {
        prismaMock.processedWebhookEvent.createMany.mockRejectedValueOnce(
          error
        );
        await expect(service.claim('stripe', 'evt_1')).resolves.toBe(
          'unavailable'
        );
      }
      expect(
        prismaMock.processedWebhookEvent.updateMany
      ).not.toHaveBeenCalled();
    });

    it('fails open if the take-over lookup itself errors after finding an existing claim', async () => {
      prismaMock.processedWebhookEvent.createMany.mockResolvedValue({
        count: 0,
      });
      prismaMock.processedWebhookEvent.updateMany.mockRejectedValue(
        new Error('connection reset')
      );

      await expect(service.claim('stripe', 'evt_1')).resolves.toBe(
        'unavailable'
      );
    });
  });

  describe('complete', () => {
    it('stamps completedAt on the claim', async () => {
      prismaMock.processedWebhookEvent.updateMany.mockResolvedValue({
        count: 1,
      });

      await service.complete('stripe', 'evt_1');

      expect(prismaMock.processedWebhookEvent.updateMany).toHaveBeenCalledWith({
        where: { provider: 'stripe', eventId: 'evt_1' },
        data: { completedAt: expect.any(Date) },
      });
    });

    it('never throws: a failed stamp only means a later duplicate waits for the lease', async () => {
      prismaMock.processedWebhookEvent.updateMany.mockRejectedValue(
        new Error('db blip')
      );

      await expect(
        service.complete('stripe', 'evt_1')
      ).resolves.toBeUndefined();
    });
  });

  describe('release', () => {
    it('deletes only an UNFINISHED claim', async () => {
      prismaMock.processedWebhookEvent.deleteMany.mockResolvedValue({
        count: 1,
      });

      await service.release('stripe', 'evt_1');

      expect(prismaMock.processedWebhookEvent.deleteMany).toHaveBeenCalledWith({
        where: { provider: 'stripe', eventId: 'evt_1', completedAt: null },
      });
    });

    it('never throws', async () => {
      prismaMock.processedWebhookEvent.deleteMany.mockRejectedValue(
        new Error('db blip')
      );

      await expect(service.release('stripe', 'evt_1')).resolves.toBeUndefined();
    });
  });

  describe('purgeOlderThan', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;

    afterEach(() => {
      jest.useRealTimers();
    });

    it('keeps rows for 90 days', () => {
      expect(PROCESSED_EVENT_RETENTION_MS).toBe(90 * DAY_MS);
    });

    it('deletes every claim created before now - 90 days, finished or not, and returns the count', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-17T00:00:00.000Z'));
      prismaMock.processedWebhookEvent.deleteMany.mockResolvedValue({
        count: 7,
      });

      await expect(service.purgeOlderThan()).resolves.toBe(7);

      expect(prismaMock.processedWebhookEvent.deleteMany).toHaveBeenCalledTimes(
        1
      );
      expect(prismaMock.processedWebhookEvent.deleteMany).toHaveBeenCalledWith({
        where: { createdAt: { lt: new Date('2026-07-19T00:00:00.000Z') } },
      });
    });

    it('takes the retention as a parameter', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-17T00:00:00.000Z'));
      prismaMock.processedWebhookEvent.deleteMany.mockResolvedValue({
        count: 0,
      });

      await service.purgeOlderThan(DAY_MS);

      expect(prismaMock.processedWebhookEvent.deleteMany).toHaveBeenCalledWith({
        where: { createdAt: { lt: new Date('2026-10-16T00:00:00.000Z') } },
      });
    });

    it('lets a database error propagate (the scheduler logs the failed run)', async () => {
      prismaMock.processedWebhookEvent.deleteMany.mockRejectedValue(
        new Error('relation "ProcessedWebhookEvent" does not exist')
      );

      await expect(service.purgeOlderThan()).rejects.toThrow('does not exist');
    });
  });
});
