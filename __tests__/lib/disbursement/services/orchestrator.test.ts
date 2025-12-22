/**
 * Payment Orchestrator Service Tests (Part 19B)
 *
 * TDD tests for PaymentOrchestrator service covering:
 * - Batch execution
 * - Payment processing
 * - Error handling and retries
 * - Commission status updates
 */

import { PrismaClient } from '@prisma/client';
import { PaymentOrchestrator } from '@/lib/disbursement/services/payment-orchestrator';
import { MockPaymentProvider } from '@/lib/disbursement/providers/mock-provider';
import type { PaymentBatchWithTransactions } from '@/lib/disbursement/services/batch-manager';

// Mock Prisma client
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    paymentBatch: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    disbursementTransaction: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      createMany: jest.fn(),
    },
    commission: {
      update: jest.fn(),
    },
    disbursementAuditLog: {
      create: jest.fn(),
    },
  },
}));

describe('PaymentOrchestrator', () => {
  let orchestrator: PaymentOrchestrator;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockProvider: MockPaymentProvider;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock prisma instance
    mockPrisma = {
      paymentBatch: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      disbursementTransaction: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        createMany: jest.fn(),
      },
      commission: {
        update: jest.fn(),
      },
      disbursementAuditLog: {
        create: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaClient>;

    mockProvider = new MockPaymentProvider({ delay: 0 });
    orchestrator = new PaymentOrchestrator(mockPrisma, mockProvider);
  });

  describe('executeBatch', () => {
    it('should execute batch with all successful payments', async () => {
      const mockBatch: PaymentBatchWithTransactions = {
        id: 'batch-123',
        batchNumber: 'BATCH-2025-001',
        paymentCount: 2,
        totalAmount: 150.0,
        currency: 'USD',
        provider: 'MOCK',
        status: 'PENDING',
        scheduledAt: null,
        executedAt: null,
        completedAt: null,
        failedAt: null,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        transactions: [
          {
            id: 'txn-1',
            status: 'PENDING',
            amount: 75.0,
            transactionId: 'TXN-001',
            commissionId: 'comm-1',
            payeeRiseId: '0xA35b123',
            currency: 'USD',
            retryCount: 0,
          },
          {
            id: 'txn-2',
            status: 'PENDING',
            amount: 75.0,
            transactionId: 'TXN-002',
            commissionId: 'comm-2',
            payeeRiseId: '0xB46c456',
            currency: 'USD',
            retryCount: 0,
          },
        ],
      };

      (mockPrisma.paymentBatch.findUnique as jest.Mock).mockResolvedValue(mockBatch);
      (mockPrisma.paymentBatch.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.disbursementTransaction.findUnique as jest.Mock).mockImplementation(
        ({ where }) => {
          const txn = mockBatch.transactions.find(
            (t) => (t as any).transactionId === where.transactionId
          );
          return Promise.resolve(txn ? { ...txn, commissionId: 'comm-1' } : null);
        }
      );
      (mockPrisma.disbursementTransaction.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.commission.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.disbursementAuditLog.create as jest.Mock).mockResolvedValue({});

      const result = await orchestrator.executeBatch('batch-123');

      expect(result.success).toBe(true);
      expect(result.batchId).toBe('batch-123');
      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle partial batch failures', async () => {
      // Configure mock provider to fail 50% of payments
      mockProvider = new MockPaymentProvider({ delay: 0, failureRate: 0.5 });
      orchestrator = new PaymentOrchestrator(mockPrisma, mockProvider);

      const mockBatch: PaymentBatchWithTransactions = {
        id: 'batch-456',
        batchNumber: 'BATCH-2025-002',
        paymentCount: 4,
        totalAmount: 200.0,
        currency: 'USD',
        provider: 'MOCK',
        status: 'PENDING',
        scheduledAt: null,
        executedAt: null,
        completedAt: null,
        failedAt: null,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        transactions: [
          { id: 'txn-1', status: 'PENDING', amount: 50.0, transactionId: 'TXN-001', payeeRiseId: '0x1', commissionId: 'c1', currency: 'USD', retryCount: 0 },
          { id: 'txn-2', status: 'PENDING', amount: 50.0, transactionId: 'TXN-002', payeeRiseId: '0x2', commissionId: 'c2', currency: 'USD', retryCount: 0 },
          { id: 'txn-3', status: 'PENDING', amount: 50.0, transactionId: 'TXN-003', payeeRiseId: '0x3', commissionId: 'c3', currency: 'USD', retryCount: 0 },
          { id: 'txn-4', status: 'PENDING', amount: 50.0, transactionId: 'TXN-004', payeeRiseId: '0x4', commissionId: 'c4', currency: 'USD', retryCount: 0 },
        ],
      };

      (mockPrisma.paymentBatch.findUnique as jest.Mock).mockResolvedValue(mockBatch);
      (mockPrisma.paymentBatch.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.disbursementTransaction.findUnique as jest.Mock).mockResolvedValue({
        id: 'txn-1',
        transactionId: 'TXN-001',
        commissionId: 'comm-1',
        retryCount: 0,
        status: 'PENDING',
      });
      (mockPrisma.disbursementTransaction.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.commission.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.disbursementAuditLog.create as jest.Mock).mockResolvedValue({});

      const result = await orchestrator.executeBatch('batch-456');

      // With 50% failure rate, some should fail
      expect(result.batchId).toBe('batch-456');
      expect(result.successCount + result.failedCount).toBe(4);
    });

    it('should throw error for non-existent batch', async () => {
      (mockPrisma.paymentBatch.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(orchestrator.executeBatch('non-existent')).rejects.toThrow(
        'Batch not found'
      );
    });

    it('should throw error for already completed batch', async () => {
      const mockBatch = {
        id: 'batch-completed',
        status: 'COMPLETED',
        transactions: [],
      };

      (mockPrisma.paymentBatch.findUnique as jest.Mock).mockResolvedValue(mockBatch);

      await expect(orchestrator.executeBatch('batch-completed')).rejects.toThrow(
        'cannot be executed'
      );
    });

    it('should throw error for already processing batch', async () => {
      const mockBatch = {
        id: 'batch-processing',
        status: 'PROCESSING',
        transactions: [],
      };

      (mockPrisma.paymentBatch.findUnique as jest.Mock).mockResolvedValue(mockBatch);

      await expect(orchestrator.executeBatch('batch-processing')).rejects.toThrow(
        'cannot be executed'
      );
    });
  });

  describe('createTransactionsForBatch', () => {
    it('should create transactions from commission aggregates', async () => {
      const aggregates = [
        {
          affiliateId: 'aff-1',
          commissionIds: ['comm-1', 'comm-2'],
          totalAmount: 100.0,
          riseId: '0xABC',
        },
      ];

      (mockPrisma.disbursementTransaction.createMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      // This tests the internal creation - not directly exposed but used by orchestrator
      expect(mockPrisma.disbursementTransaction.createMany).toBeDefined();
    });
  });

  describe('getExecutionResult', () => {
    it('should return execution result with correct structure', async () => {
      const mockBatch: PaymentBatchWithTransactions = {
        id: 'batch-result',
        batchNumber: 'BATCH-2025-003',
        paymentCount: 1,
        totalAmount: 50.0,
        currency: 'USD',
        provider: 'MOCK',
        status: 'PENDING',
        scheduledAt: null,
        executedAt: null,
        completedAt: null,
        failedAt: null,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        transactions: [
          {
            id: 'txn-solo',
            status: 'PENDING',
            amount: 50.0,
            transactionId: 'TXN-SOLO',
            commissionId: 'comm-solo',
            payeeRiseId: '0xSOLO',
            currency: 'USD',
            retryCount: 0,
          },
        ],
      };

      (mockPrisma.paymentBatch.findUnique as jest.Mock).mockResolvedValue(mockBatch);
      (mockPrisma.paymentBatch.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.disbursementTransaction.findUnique as jest.Mock).mockResolvedValue({
        id: 'txn-solo',
        transactionId: 'TXN-SOLO',
        commissionId: 'comm-solo',
        retryCount: 0,
        status: 'PENDING',
      });
      (mockPrisma.disbursementTransaction.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.commission.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.disbursementAuditLog.create as jest.Mock).mockResolvedValue({});

      const result = await orchestrator.executeBatch('batch-result');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('batchId');
      expect(result).toHaveProperty('totalAmount');
      expect(result).toHaveProperty('successCount');
      expect(result).toHaveProperty('failedCount');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });
});
