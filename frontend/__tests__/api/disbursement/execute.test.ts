/**
 * Tests for Batch Execution API (Part 19B)
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/disbursement/batches/[batchId]/execute/route';

// Mock auth
jest.mock('@/lib/auth/session', () => ({
  requireAdmin: jest.fn(),
}));

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    paymentBatch: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    disbursementTransaction: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
    disbursementAuditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    commission: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    affiliateProfile: {
      update: jest.fn(),
    },
  },
}));

describe('POST /api/disbursement/batches/[batchId]/execute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should require authentication', async () => {
    const { requireAdmin } = await import('@/lib/auth/session');
    const { AuthError } = await import('@/lib/auth/errors');

    (requireAdmin as jest.Mock).mockRejectedValueOnce(
      new AuthError('Unauthorized', 'UNAUTHORIZED', 401)
    );

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches/batch-123/execute',
      { method: 'POST' }
    );
    const response = await POST(request, {
      params: Promise.resolve({ batchId: 'batch-123' }),
    });

    expect(response.status).toBe(401);
  });

  it('should return 404 when batch not found', async () => {
    const { requireAdmin } = await import('@/lib/auth/session');
    const { prisma } = await import('@/lib/db/prisma');

    (requireAdmin as jest.Mock).mockResolvedValueOnce({
      user: { id: 'admin-123', role: 'ADMIN' },
    });

    (prisma.paymentBatch.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches/nonexistent/execute',
      { method: 'POST' }
    );
    const response = await POST(request, {
      params: Promise.resolve({ batchId: 'nonexistent' }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Batch not found');
  });

  it('should return 400 when batch already completed', async () => {
    const { requireAdmin } = await import('@/lib/auth/session');
    const { prisma } = await import('@/lib/db/prisma');

    (requireAdmin as jest.Mock).mockResolvedValueOnce({
      user: { id: 'admin-123', role: 'ADMIN' },
    });

    (prisma.paymentBatch.findUnique as jest.Mock).mockResolvedValue({
      id: 'batch-123',
      status: 'COMPLETED',
      provider: 'MOCK',
      transactions: [],
      auditLogs: [],
    });

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches/batch-123/execute',
      { method: 'POST' }
    );
    const response = await POST(request, {
      params: Promise.resolve({ batchId: 'batch-123' }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Cannot execute batch with status COMPLETED');
  });

  it('should return 400 when batch is already processing', async () => {
    const { requireAdmin } = await import('@/lib/auth/session');
    const { prisma } = await import('@/lib/db/prisma');

    (requireAdmin as jest.Mock).mockResolvedValueOnce({
      user: { id: 'admin-123', role: 'ADMIN' },
    });

    (prisma.paymentBatch.findUnique as jest.Mock).mockResolvedValue({
      id: 'batch-123',
      status: 'PROCESSING',
      provider: 'MOCK',
      transactions: [],
      auditLogs: [],
    });

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches/batch-123/execute',
      { method: 'POST' }
    );
    const response = await POST(request, {
      params: Promise.resolve({ batchId: 'batch-123' }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Cannot execute batch with status PROCESSING');
  });

  it('should execute pending batch with MOCK provider', async () => {
    const { requireAdmin } = await import('@/lib/auth/session');
    const { prisma } = await import('@/lib/db/prisma');

    (requireAdmin as jest.Mock).mockResolvedValueOnce({
      user: { id: 'admin-123', role: 'ADMIN' },
    });

    // Initial batch state
    (prisma.paymentBatch.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: 'batch-123',
        batchNumber: 'BATCH-2025-ABC',
        status: 'PENDING',
        provider: 'MOCK',
        totalAmount: 100,
        transactions: [],
        auditLogs: [],
      })
      // Second call for batch details after execution
      .mockResolvedValueOnce({
        id: 'batch-123',
        batchNumber: 'BATCH-2025-ABC',
        status: 'PENDING',
        provider: 'MOCK',
        totalAmount: 100,
        transactions: [],
        auditLogs: [],
      })
      // Third call after execution
      .mockResolvedValueOnce({
        id: 'batch-123',
        batchNumber: 'BATCH-2025-ABC',
        status: 'COMPLETED',
        provider: 'MOCK',
        totalAmount: 100,
        executedAt: new Date(),
        completedAt: new Date(),
        transactions: [],
        auditLogs: [],
      });

    (prisma.paymentBatch.update as jest.Mock).mockResolvedValue({});
    (prisma.disbursementAuditLog.create as jest.Mock).mockResolvedValue({});

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches/batch-123/execute',
      { method: 'POST' }
    );
    const response = await POST(request, {
      params: Promise.resolve({ batchId: 'batch-123' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
