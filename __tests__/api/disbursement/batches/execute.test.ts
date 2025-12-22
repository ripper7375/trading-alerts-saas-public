/**
 * Batch Execute API Route Tests (Part 19B)
 *
 * TDD tests for POST /api/disbursement/batches/[batchId]/execute endpoint
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/disbursement/batches/[batchId]/execute/route';

// Mock auth session
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
      update: jest.fn(),
    },
    commission: {
      update: jest.fn(),
    },
    disbursementAuditLog: {
      create: jest.fn(),
    },
  },
}));

// Mock PaymentOrchestrator
jest.mock('@/lib/disbursement/services/payment-orchestrator', () => ({
  PaymentOrchestrator: jest.fn().mockImplementation(() => ({
    executeBatch: jest.fn().mockResolvedValue({
      success: true,
      batchId: 'batch-123',
      totalAmount: 500.0,
      successCount: 5,
      failedCount: 0,
      errors: [],
    }),
  })),
}));

// Mock provider factory
jest.mock('@/lib/disbursement/providers/provider-factory', () => ({
  createPaymentProvider: jest.fn().mockReturnValue({
    name: 'MOCK',
    authenticate: jest.fn(),
    sendBatchPayment: jest.fn(),
    sendPayment: jest.fn(),
    getPaymentStatus: jest.fn(),
    getPayeeInfo: jest.fn(),
    verifyWebhook: jest.fn(),
  }),
}));

import { requireAdmin } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

describe('POST /api/disbursement/batches/[batchId]/execute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock for findUnique - returns a valid PENDING batch
    (prisma.paymentBatch.findUnique as jest.Mock).mockResolvedValue({
      id: 'batch-123',
      status: 'PENDING',
      provider: 'MOCK',
    });
  });

  it('should execute batch successfully', async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-123', role: 'ADMIN' },
    });

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches/batch-123/execute',
      {
        method: 'POST',
      }
    );

    const params = { batchId: 'batch-123' };
    const response = await POST(request, { params: Promise.resolve(params) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('result');
    expect(data.result.success).toBe(true);
    expect(data.result.batchId).toBe('batch-123');
    expect(data.result.successCount).toBe(5);
    expect(data.result.failedCount).toBe(0);
  });

  it('should return 401 for unauthorized', async () => {
    const { AuthError } = await import('@/lib/auth/errors');
    (requireAdmin as jest.Mock).mockRejectedValue(
      new AuthError('Unauthorized', 'UNAUTHORIZED', 401)
    );

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches/batch-123/execute',
      {
        method: 'POST',
      }
    );

    const params = { batchId: 'batch-123' };
    const response = await POST(request, { params: Promise.resolve(params) });

    expect(response.status).toBe(401);
  });

  it('should handle execution errors gracefully', async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-123', role: 'ADMIN' },
    });

    // Mock batch exists with PENDING status so orchestrator gets called
    (prisma.paymentBatch.findUnique as jest.Mock).mockResolvedValue({
      id: 'batch-error',
      status: 'PENDING',
      provider: 'MOCK',
    });

    // Mock orchestrator to throw
    const { PaymentOrchestrator } = await import(
      '@/lib/disbursement/services/payment-orchestrator'
    );
    (PaymentOrchestrator as jest.Mock).mockImplementation(() => ({
      executeBatch: jest.fn().mockRejectedValue(new Error('Provider error')),
    }));

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches/batch-error/execute',
      {
        method: 'POST',
      }
    );

    const params = { batchId: 'batch-error' };
    const response = await POST(request, { params: Promise.resolve(params) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toHaveProperty('error');
  });
});
