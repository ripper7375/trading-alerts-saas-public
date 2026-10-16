/**
 * Processed webhook event claims, monolith side (Remediation Tier 2 §6.1).
 * Same protocol as money-service's ProcessedWebhookEventService; the table and
 * its races are proven against a real PostgreSQL in the session hand-off.
 */

const mockCreateMany = jest.fn();
const mockUpdateMany = jest.fn();
const mockDeleteMany = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    processedWebhookEvent: {
      createMany: (...args: unknown[]) => mockCreateMany(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
    },
  },
}));

import {
  CLAIM_LEASE_MS,
  claimEvent,
  completeEvent,
  releaseEvent,
} from '@/lib/webhooks/processed-event';

describe('processed webhook event claims', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  describe('claimEvent', () => {
    it("claims an event nobody has seen: inserts (provider, eventId, createdAt) skipping duplicates, and says 'claimed'", async () => {
      mockCreateMany.mockResolvedValue({ count: 1 });

      await expect(claimEvent('stripe', 'evt_1')).resolves.toBe('claimed');

      expect(mockCreateMany).toHaveBeenCalledWith({
        data: [
          { provider: 'stripe', eventId: 'evt_1', createdAt: expect.any(Date) },
        ],
        skipDuplicates: true,
      });
      expect(mockUpdateMany).not.toHaveBeenCalled();
    });

    it("says 'duplicate' when the event is already claimed and the claim is inside its lease or finished", async () => {
      mockCreateMany.mockResolvedValue({ count: 0 });
      mockUpdateMany.mockResolvedValue({ count: 0 });

      await expect(claimEvent('stripe', 'evt_1')).resolves.toBe('duplicate');
    });

    it('takes over an unfinished claim older than the lease with ONE conditional update', async () => {
      mockCreateMany.mockResolvedValue({ count: 0 });
      mockUpdateMany.mockResolvedValue({ count: 1 });
      const before = Date.now();

      await expect(claimEvent('stripe', 'evt_1')).resolves.toBe('claimed');

      const call = mockUpdateMany.mock.calls[0]?.[0] as {
        where: {
          provider: string;
          eventId: string;
          completedAt: null;
          createdAt: { lt: Date };
        };
        data: { createdAt: Date };
      };
      expect(call.where.completedAt).toBeNull();
      expect(call.where.provider).toBe('stripe');
      expect(call.where.eventId).toBe('evt_1');
      expect(call.where.createdAt.lt.getTime()).toBeLessThanOrEqual(
        Date.now() - CLAIM_LEASE_MS
      );
      expect(call.where.createdAt.lt.getTime()).toBeGreaterThanOrEqual(
        before - CLAIM_LEASE_MS - 1000
      );
      expect(call.data.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('lets exactly one of two retries win a take-over', async () => {
      mockCreateMany.mockResolvedValue({ count: 0 });
      mockUpdateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      const results = await Promise.all([
        claimEvent('stripe', 'evt_1'),
        claimEvent('stripe', 'evt_1'),
      ]);

      expect(results.sort()).toEqual(['claimed', 'duplicate']);
    });

    it("fails OPEN ('unavailable') when the table cannot be used, so billing webhooks keep working", async () => {
      for (const error of [
        Object.assign(new Error('relation does not exist'), { code: 'P2021' }),
        Object.assign(new Error('permission denied'), { code: 'P2010' }),
        new Error('connection refused'),
        'not an Error',
      ]) {
        mockCreateMany.mockRejectedValueOnce(error);
        await expect(claimEvent('stripe', 'evt_1')).resolves.toBe(
          'unavailable'
        );
      }
      expect(mockUpdateMany).not.toHaveBeenCalled();
    });

    it('fails open if the take-over update errors after finding an existing claim', async () => {
      mockCreateMany.mockResolvedValue({ count: 0 });
      mockUpdateMany.mockRejectedValue(new Error('connection reset'));

      await expect(claimEvent('stripe', 'evt_1')).resolves.toBe('unavailable');
    });

    it('fails open when the Prisma client has no such model (an un-regenerated client)', async () => {
      mockCreateMany.mockImplementation(() => {
        throw new TypeError('createMany is not a function');
      });

      await expect(claimEvent('stripe', 'evt_1')).resolves.toBe('unavailable');
    });
  });

  describe('completeEvent', () => {
    it('stamps completedAt on the claim', async () => {
      mockUpdateMany.mockResolvedValue({ count: 1 });

      await completeEvent('stripe', 'evt_1');

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { provider: 'stripe', eventId: 'evt_1' },
        data: { completedAt: expect.any(Date) },
      });
    });

    it('never throws', async () => {
      mockUpdateMany.mockRejectedValue(new Error('db blip'));

      await expect(completeEvent('stripe', 'evt_1')).resolves.toBeUndefined();
    });
  });

  describe('releaseEvent', () => {
    it('deletes only an UNFINISHED claim', async () => {
      mockDeleteMany.mockResolvedValue({ count: 1 });

      await releaseEvent('stripe', 'evt_1');

      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { provider: 'stripe', eventId: 'evt_1', completedAt: null },
      });
    });

    it('never throws', async () => {
      mockDeleteMany.mockRejectedValue(new Error('db blip'));

      await expect(releaseEvent('stripe', 'evt_1')).resolves.toBeUndefined();
    });
  });
});
