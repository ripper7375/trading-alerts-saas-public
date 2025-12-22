/**
 * Tests for Batch Execute API (Part 19B)
 */

import { NextRequest } from 'next/server';

// Mock modules before importing route handlers
jest.mock('@/lib/auth/session', () => ({
  requireAdmin: jest.fn(),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    paymentBatch: {
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    disbursementTransaction: {
      update: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    disbursementAuditLog: {
      create: jest.fn(),
    },
    commission: {
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/disbursement/providers/provider-factory', () => ({
  createPaymentProvider: jest.fn().mockReturnValue({
    name: 'MOCK',
    authenticate: jest.fn().mockResolvedValue({ token: 'mock-token' }),
    sendBatchPayment: jest.fn().mockResolvedValue({
      success: true,
      batchId: 'mock-batch-123',
      totalAmount: 100,
      successCount: 1,
      failedCount: 0,
      results: [
        {
          success: true,
          transactionId: 'TXN-123',
          providerTxId: 'mock-txn-123',
          status: 'COMPLETED',
          amount: 100,
        },
      ],
    }),
    getPaymentStatus: jest.fn().mockResolvedValue('COMPLETED'),
    getPayeeInfo: jest.fn().mockResolvedValue({
      riseId: '0xABC',
      kycStatus: 'APPROVED',
      canReceivePayments: true,
    }),
    verifyWebhook: jest.fn().mockReturnValue(true),
  }),
}));

jest.mock('@/lib/disbursement/services/payment-orchestrator', () => ({
  PaymentOrchestrator: jest.fn().mockImplementation(() => ({
    executeBatch: jest.fn(),
  })),
}));

import { POST } from '@/app/api/disbursement/batches/[batchId]/execute/route';
import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { PaymentOrchestrator } from '@/lib/disbursement/services/payment-orchestrator';

describe('POST /api/disbursement/batches/[batchId]/execute', () => {
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

  it('should execute batch successfully', async () => {
    (PaymentOrchestrator as jest.Mock).mockImplementation(() => ({
      executeBatch: jest.fn().mockResolvedValue({
        success: true,
        batchId: 'batch-123',
        batchNumber: 'BATCH-2024-001',
        totalAmount: 100,
        successCount: 1,
        failedCount: 0,
        errors: [],
      }),
    }));

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches/batch-123/execute',
      { method: 'POST' }
    );

    const response = await POST(request, {
      params: Promise.resolve({ batchId: 'batch-123' }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.result.success).toBe(true);
    expect(data.result.successCount).toBe(1);
    expect(data.result.failedCount).toBe(0);
  });

  it('should handle partial failure', async () => {
    (PaymentOrchestrator as jest.Mock).mockImplementation(() => ({
      executeBatch: jest.fn().mockResolvedValue({
        success: false,
        batchId: 'batch-123',
        batchNumber: 'BATCH-2024-001',
        totalAmount: 200,
        successCount: 1,
        failedCount: 1,
        errors: ['Payment failed for affiliate aff-456'],
      }),
    }));

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches/batch-123/execute',
      { method: 'POST' }
    );

    const response = await POST(request, {
      params: Promise.resolve({ batchId: 'batch-123' }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.result.success).toBe(false);
    expect(data.result.successCount).toBe(1);
    expect(data.result.failedCount).toBe(1);
    expect(data.result.errors).toHaveLength(1);
  });

  it('should return 404 for non-existent batch', async () => {
    (PaymentOrchestrator as jest.Mock).mockImplementation(() => ({
      executeBatch: jest.fn().mockRejectedValue(new Error('Batch not found')),
    }));

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches/non-existent/execute',
      { method: 'POST' }
    );

    const response = await POST(request, {
      params: Promise.resolve({ batchId: 'non-existent' }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Batch not found');
  });

  it('should return 409 when batch already processing', async () => {
    (PaymentOrchestrator as jest.Mock).mockImplementation(() => ({
      executeBatch: jest.fn().mockRejectedValue(
        new Error('Cannot execute batch with status PROCESSING')
      ),
    }));

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches/batch-123/execute',
      { method: 'POST' }
    );

    const response = await POST(request, {
      params: Promise.resolve({ batchId: 'batch-123' }),
    });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain('Cannot execute batch');
  });

  it('should return 409 when another batch is processing', async () => {
    (PaymentOrchestrator as jest.Mock).mockImplementation(() => ({
      executeBatch: jest.fn().mockRejectedValue(
        new Error('Another batch is currently processing')
      ),
    }));

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches/batch-123/execute',
      { method: 'POST' }
    );

    const response = await POST(request, {
      params: Promise.resolve({ batchId: 'batch-123' }),
    });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('Another batch is currently processing');
  });

  it('should require admin authentication', async () => {
    (requireAdmin as jest.Mock).mockRejectedValue(
      new AuthError('Unauthorized', 'UNAUTHORIZED', 401)
    );

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches/batch-123/execute',
      { method: 'POST' }
    );

    const response = await POST(request, {
      params: Promise.resolve({ batchId: 'batch-123' }),
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should reject non-admin users', async () => {
    (requireAdmin as jest.Mock).mockRejectedValue(
      new AuthError('Admin access required', 'ADMIN_REQUIRED', 403)
    );

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches/batch-123/execute',
      { method: 'POST' }
    );

    const response = await POST(request, {
      params: Promise.resolve({ batchId: 'batch-123' }),
    });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Admin access required');
  });
});
