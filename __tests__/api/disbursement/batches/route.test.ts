/**
 * Batches API Route Tests (Part 19B)
 *
 * TDD tests for GET/POST /api/disbursement/batches endpoint
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/disbursement/batches/route';

// Mock auth session
jest.mock('@/lib/auth/session', () => ({
  requireAdmin: jest.fn(),
}));

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    paymentBatch: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    disbursementAuditLog: {
      create: jest.fn(),
    },
  },
}));

// Mock BatchManager - use inline jest.fn() to avoid hoisting issues
jest.mock('@/lib/disbursement/services/batch-manager', () => {
  return {
    BatchManager: jest.fn().mockImplementation(() => ({
      getAllBatches: jest.fn().mockResolvedValue([
        {
          id: 'batch-001',
          batchNumber: 'BATCH-2025-001',
          paymentCount: 5,
          totalAmount: 500.0,
          status: 'PENDING',
          transactions: [],
          createdAt: new Date('2025-01-01'),
        },
        {
          id: 'batch-002',
          batchNumber: 'BATCH-2025-002',
          paymentCount: 3,
          totalAmount: 300.0,
          status: 'COMPLETED',
          transactions: [],
          createdAt: new Date('2025-01-02'),
        },
      ]),
      createBatch: jest.fn().mockResolvedValue({
        id: 'batch-new',
        batchNumber: 'BATCH-2025-NEW',
        paymentCount: 2,
        totalAmount: 200.0,
        status: 'PENDING',
        transactions: [],
        createdAt: new Date(),
      }),
    })),
  };
});

// Mock CommissionAggregator
jest.mock('@/lib/disbursement/services/commission-aggregator', () => ({
  CommissionAggregator: jest.fn().mockImplementation(() => ({
    getAllPayableAffiliates: jest.fn().mockResolvedValue([
      {
        affiliateId: 'aff-1',
        commissionIds: ['comm-1', 'comm-2'],
        totalAmount: 100.0,
        commissionCount: 2,
        oldestDate: new Date(),
        canPayout: true,
      },
      {
        affiliateId: 'aff-2',
        commissionIds: ['comm-3'],
        totalAmount: 100.0,
        commissionCount: 1,
        oldestDate: new Date(),
        canPayout: true,
      },
    ]),
    getAggregatesByAffiliate: jest.fn().mockResolvedValue({
      affiliateId: 'aff-1',
      commissionIds: ['comm-1'],
      totalAmount: 100.0,
      commissionCount: 1,
      oldestDate: new Date(),
      canPayout: true,
    }),
  })),
}));

import { requireAdmin } from '@/lib/auth/session';

describe('GET /api/disbursement/batches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return all batches for admin', async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-123', role: 'ADMIN' },
    });

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('batches');
    expect(Array.isArray(data.batches)).toBe(true);
    expect(data.batches).toHaveLength(2);
  });

  it('should filter by status query param', async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-123', role: 'ADMIN' },
    });

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches?status=COMPLETED'
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  it('should return 401 for unauthorized', async () => {
    const { AuthError } = await import('@/lib/auth/errors');
    (requireAdmin as jest.Mock).mockRejectedValue(
      new AuthError('Unauthorized', 'UNAUTHORIZED', 401)
    );

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches'
    );

    const response = await GET(request);

    expect(response.status).toBe(401);
  });
});

describe('POST /api/disbursement/batches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new batch', async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-123', role: 'ADMIN' },
    });

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches',
      {
        method: 'POST',
        body: JSON.stringify({
          provider: 'MOCK',
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toHaveProperty('batch');
    expect(data.batch).toHaveProperty('id');
    expect(data.batch).toHaveProperty('batchNumber');
  });

  it('should create batch with specific affiliates', async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-123', role: 'ADMIN' },
    });

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches',
      {
        method: 'POST',
        body: JSON.stringify({
          affiliateIds: ['aff-1', 'aff-2'],
          provider: 'MOCK',
        }),
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(201);
  });

  it('should return 401 for unauthorized', async () => {
    const { AuthError } = await import('@/lib/auth/errors');
    (requireAdmin as jest.Mock).mockRejectedValue(
      new AuthError('Unauthorized', 'UNAUTHORIZED', 401)
    );

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches',
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(401);
  });
});
