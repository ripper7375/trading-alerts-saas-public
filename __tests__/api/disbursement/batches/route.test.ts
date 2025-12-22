/**
 * Tests for Payment Batches API (Part 19B)
 */

import { NextRequest } from 'next/server';

// Mock modules before importing route handlers
jest.mock('@/lib/auth/session', () => ({
  requireAdmin: jest.fn(),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    paymentBatch: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    disbursementTransaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    disbursementAuditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    affiliateRiseAccount: {
      findUnique: jest.fn(),
    },
    commission: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn({})),
  },
}));

jest.mock('@/lib/disbursement/services/batch-manager', () => ({
  BatchManager: jest.fn().mockImplementation(() => ({
    getAllBatches: jest.fn().mockResolvedValue([]),
    getBatchCount: jest.fn().mockResolvedValue(0),
    getBatchStats: jest.fn().mockResolvedValue({
      total: 0,
      pending: 0,
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      totalAmount: 0,
      totalPaidAmount: 0,
    }),
    createBatch: jest.fn(),
    getBatchById: jest.fn(),
    deleteBatch: jest.fn(),
  })),
}));

jest.mock('@/lib/disbursement/services/commission-aggregator', () => ({
  CommissionAggregator: jest.fn().mockImplementation(() => ({
    getAllPayableAffiliates: jest.fn().mockResolvedValue([]),
    getAggregatesByAffiliate: jest.fn().mockResolvedValue({
      affiliateId: 'aff-123',
      commissionIds: [],
      totalAmount: 0,
      commissionCount: 0,
      oldestDate: new Date(),
      canPayout: false,
    }),
  })),
}));

import { GET, POST } from '@/app/api/disbursement/batches/route';
import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { BatchManager } from '@/lib/disbursement/services/batch-manager';
import { CommissionAggregator } from '@/lib/disbursement/services/commission-aggregator';

describe('GET /api/disbursement/batches', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: admin is authenticated
    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-123', role: 'ADMIN' },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return batches list', async () => {
    const mockBatches = [
      {
        id: 'batch-123',
        batchNumber: 'BATCH-2024-001',
        status: 'COMPLETED',
        provider: 'MOCK',
        paymentCount: 5,
        totalAmount: 500,
        currency: 'USD',
        transactions: [
          { status: 'COMPLETED' },
          { status: 'COMPLETED' },
        ],
      },
    ];

    (BatchManager as jest.Mock).mockImplementation(() => ({
      getAllBatches: jest.fn().mockResolvedValue(mockBatches),
      getBatchCount: jest.fn().mockResolvedValue(1),
      getBatchStats: jest.fn().mockResolvedValue({
        total: 1,
        completed: 1,
        totalPaidAmount: 500,
      }),
    }));

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('batches');
    expect(data).toHaveProperty('pagination');
    expect(data).toHaveProperty('stats');
  });

  it('should filter by status', async () => {
    (BatchManager as jest.Mock).mockImplementation(() => ({
      getAllBatches: jest.fn().mockResolvedValue([]),
      getBatchCount: jest.fn().mockResolvedValue(0),
      getBatchStats: jest.fn().mockResolvedValue({}),
    }));

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches?status=PENDING'
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  it('should require admin authentication', async () => {
    (requireAdmin as jest.Mock).mockRejectedValue(
      new AuthError('Unauthorized', 'UNAUTHORIZED', 401)
    );

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });
});

describe('POST /api/disbursement/batches', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-123', role: 'ADMIN' },
    });
  });

  it('should create batch with payable affiliates', async () => {
    const mockAggregates = [
      {
        affiliateId: 'aff-123',
        commissionIds: ['comm-1'],
        totalAmount: 100,
        commissionCount: 1,
        oldestDate: new Date(),
        canPayout: true,
      },
    ];

    (CommissionAggregator as jest.Mock).mockImplementation(() => ({
      getAllPayableAffiliates: jest.fn().mockResolvedValue(mockAggregates),
    }));

    (BatchManager as jest.Mock).mockImplementation(() => ({
      createBatch: jest.fn().mockResolvedValue({
        batch: {
          id: 'batch-123',
          batchNumber: 'BATCH-2024-001',
          status: 'PENDING',
          provider: 'MOCK',
          paymentCount: 1,
          totalAmount: 100,
          currency: 'USD',
          createdAt: new Date(),
        },
        transactionCount: 1,
      }),
    }));

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches',
      {
        method: 'POST',
        body: JSON.stringify({ provider: 'MOCK' }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toHaveProperty('batch');
    expect(data.batch.batchNumber).toBe('BATCH-2024-001');
  });

  it('should return 400 when no payable affiliates', async () => {
    (CommissionAggregator as jest.Mock).mockImplementation(() => ({
      getAllPayableAffiliates: jest.fn().mockResolvedValue([]),
    }));

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches',
      {
        method: 'POST',
        body: JSON.stringify({ provider: 'MOCK' }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('No payable affiliates found');
  });

  it('should accept specific affiliate IDs', async () => {
    const mockAggregate = {
      affiliateId: 'aff-123',
      commissionIds: ['comm-1'],
      totalAmount: 100,
      commissionCount: 1,
      oldestDate: new Date(),
      canPayout: true,
    };

    (CommissionAggregator as jest.Mock).mockImplementation(() => ({
      getAggregatesByAffiliate: jest.fn().mockResolvedValue(mockAggregate),
    }));

    (BatchManager as jest.Mock).mockImplementation(() => ({
      createBatch: jest.fn().mockResolvedValue({
        batch: {
          id: 'batch-123',
          batchNumber: 'BATCH-2024-001',
          status: 'PENDING',
          provider: 'MOCK',
          paymentCount: 1,
          totalAmount: 100,
          currency: 'USD',
          createdAt: new Date(),
        },
        transactionCount: 1,
      }),
    }));

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches',
      {
        method: 'POST',
        body: JSON.stringify({
          affiliateIds: ['aff-123'],
          provider: 'MOCK',
        }),
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(201);
  });

  it('should validate provider enum', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches',
      {
        method: 'POST',
        body: JSON.stringify({ provider: 'INVALID' }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });
});
