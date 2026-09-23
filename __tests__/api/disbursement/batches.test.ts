/**
 * Tests for Disbursement Batches API (Part 19B)
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/disbursement/batches/route';
import { BatchManager } from '@/lib/disbursement/services/batch-manager';
import { CommissionAggregator } from '@/lib/disbursement/services/commission-aggregator';

// Mock auth
jest.mock('@/lib/auth/session', () => ({
  requireAdmin: jest.fn(),
}));

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    paymentBatch: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    disbursementTransaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    disbursementAuditLog: {
      create: jest.fn(),
    },
    commission: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    affiliateProfile: {
      findUnique: jest.fn(),
    },
    systemConfig: {
      findMany: jest.fn(),
    },
  },
}));

describe('Batch API Routes', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    const { prisma } = await import('@/lib/db/prisma');
    // No payout-setting rows -> defaults (DECISION-LOG F83)
    (prisma.systemConfig.findMany as jest.Mock).mockResolvedValue([]);
  });

  describe('GET /api/disbursement/batches', () => {
    it('should require authentication', async () => {
      const { requireAdmin } = await import('@/lib/auth/session');
      const { AuthError } = await import('@/lib/auth/errors');

      (requireAdmin as jest.Mock).mockRejectedValueOnce(
        new AuthError('Unauthorized', 'UNAUTHORIZED', 401)
      );

      const request = new NextRequest(
        'http://localhost:3000/api/disbursement/batches'
      );
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should return 200 with batches for admin', async () => {
      const { requireAdmin } = await import('@/lib/auth/session');
      const { prisma } = await import('@/lib/db/prisma');

      (requireAdmin as jest.Mock).mockResolvedValueOnce({
        user: { id: 'admin-123', role: 'ADMIN' },
      });

      (prisma.paymentBatch.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.paymentBatch.aggregate as jest.Mock).mockResolvedValue({
        _count: 0,
        _sum: { totalAmount: null, paymentCount: null },
      });
      (prisma.paymentBatch.groupBy as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/disbursement/batches'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('batches');
      expect(data).toHaveProperty('statistics');
    });

    it('should filter by status when provided', async () => {
      const { requireAdmin } = await import('@/lib/auth/session');
      const { prisma } = await import('@/lib/db/prisma');

      (requireAdmin as jest.Mock).mockResolvedValueOnce({
        user: { id: 'admin-123', role: 'ADMIN' },
      });

      (prisma.paymentBatch.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.paymentBatch.aggregate as jest.Mock).mockResolvedValue({
        _count: 0,
        _sum: { totalAmount: null, paymentCount: null },
      });
      (prisma.paymentBatch.groupBy as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/disbursement/batches?status=PENDING'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/disbursement/batches', () => {
    it('should require authentication', async () => {
      const { requireAdmin } = await import('@/lib/auth/session');
      const { AuthError } = await import('@/lib/auth/errors');

      (requireAdmin as jest.Mock).mockRejectedValueOnce(
        new AuthError('Unauthorized', 'UNAUTHORIZED', 401)
      );

      const request = new NextRequest(
        'http://localhost:3000/api/disbursement/batches',
        {
          method: 'POST',
          body: JSON.stringify({ provider: 'MOCK' }),
        }
      );
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid provider', async () => {
      const { requireAdmin } = await import('@/lib/auth/session');

      (requireAdmin as jest.Mock).mockResolvedValueOnce({
        user: { id: 'admin-123', role: 'ADMIN' },
      });

      const request = new NextRequest(
        'http://localhost:3000/api/disbursement/batches',
        {
          method: 'POST',
          body: JSON.stringify({ provider: 'INVALID' }),
        }
      );
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 when no payable affiliates', async () => {
      const { requireAdmin } = await import('@/lib/auth/session');
      const { prisma } = await import('@/lib/db/prisma');

      (requireAdmin as jest.Mock).mockResolvedValueOnce({
        user: { id: 'admin-123', role: 'ADMIN' },
      });

      // No commissions = no payable affiliates
      (prisma.commission.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/disbursement/batches',
        {
          method: 'POST',
          body: JSON.stringify({ provider: 'MOCK' }),
        }
      );
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('No payable affiliates');
    });
  });
});

describe('POST /api/disbursement/batches — payout settings (E9, DECISION-LOG F83)', () => {
  const aggregate = (id: string) => ({
    affiliateId: id,
    commissionIds: ['comm-' + id],
    totalAmount: 60,
    commissionCount: 1,
    oldestDate: new Date('2026-08-01'),
    canPayout: true,
  });

  const post = (body: unknown) =>
    POST(
      new NextRequest('http://localhost:3000/api/disbursement/batches', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    );

  beforeEach(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    const { requireAdmin } = await import('@/lib/auth/session');
    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-123', role: 'ADMIN' },
    });
  });

  const setRows = async (rows: Array<{ key: string; value: string }>) => {
    const { prisma } = await import('@/lib/db/prisma');
    (prisma.systemConfig.findMany as jest.Mock).mockResolvedValue(rows);
  };

  it('returns 409 DISBURSEMENTS_PAUSED while payouts are paused, creating nothing', async () => {
    await setRows([{ key: 'disbursement_enabled', value: 'false' }]);
    const createSpy = jest.spyOn(BatchManager.prototype, 'createBatch');

    const response = await post({ provider: 'MOCK' });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'Disbursements are paused',
      code: 'DISBURSEMENTS_PAUSED',
    });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('splits the all-payable path into batches of maxBatchSize', async () => {
    await setRows([{ key: 'disbursement_max_batch_size', value: '2' }]);
    const payableSpy = jest
      .spyOn(CommissionAggregator.prototype, 'getAllPayableAffiliates')
      .mockResolvedValue(['a', 'b', 'c', 'd', 'e'].map(aggregate));
    let seq = 0;
    const createSpy = jest
      .spyOn(BatchManager.prototype, 'createBatch')
      .mockImplementation(async (chunk) => {
        seq += 1;
        return {
          id: 'batch-' + seq,
          batchNumber: 'B-' + seq,
          provider: 'MOCK',
          status: 'PENDING',
          paymentCount: chunk.length,
          totalAmount: 60 * chunk.length,
          currency: 'USD',
          createdAt: new Date(),
        } as never;
      });
    jest
      .spyOn(BatchManager.prototype, 'getBatchById')
      .mockResolvedValue({ transactions: [] } as never);

    const response = await post({ provider: 'MOCK' });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(payableSpy).toHaveBeenCalledWith(50);
    expect(createSpy.mock.calls.map((call) => call[0].length)).toEqual([
      2, 2, 1,
    ]);
    expect(body.batches).toHaveLength(3);
    expect(body.batch).toEqual(body.batches[0]);
    expect(
      body.batches.map((b: { affiliateCount: number }) => b.affiliateCount)
    ).toEqual([2, 2, 1]);
  });

  it('rejects an explicit affiliateIds list longer than maxBatchSize with 400', async () => {
    await setRows([{ key: 'disbursement_max_batch_size', value: '2' }]);
    const createSpy = jest.spyOn(BatchManager.prototype, 'createBatch');

    const response = await post({
      provider: 'MOCK',
      affiliateIds: ['a', 'b', 'c'],
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: 'BATCH_SIZE_EXCEEDED',
    });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('keeps an explicit affiliateIds list within the limit as ONE batch, using the dynamic minimum', async () => {
    await setRows([
      { key: 'disbursement_max_batch_size', value: '2' },
      { key: 'disbursement_minimum_payout_usd', value: '55' },
    ]);
    const byAffiliateSpy = jest
      .spyOn(CommissionAggregator.prototype, 'getAggregatesByAffiliate')
      .mockImplementation(async (id) => aggregate(id));
    const createSpy = jest
      .spyOn(BatchManager.prototype, 'createBatch')
      .mockResolvedValue({
        id: 'batch-1',
        totalAmount: 120,
        createdAt: new Date(),
      } as never);
    jest
      .spyOn(BatchManager.prototype, 'getBatchById')
      .mockResolvedValue({ transactions: [] } as never);

    const response = await post({ provider: 'MOCK', affiliateIds: ['a', 'b'] });

    expect(response.status).toBe(201);
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(byAffiliateSpy).toHaveBeenCalledWith('a', 55);
  });
});
