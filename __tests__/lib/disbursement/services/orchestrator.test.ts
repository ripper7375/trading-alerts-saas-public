/**
 * Tests for PaymentOrchestrator Service (Part 19B)
 */

import { PaymentOrchestrator } from '@/lib/disbursement/services/payment-orchestrator';
import { MockPaymentProvider } from '@/lib/disbursement/providers/mock-provider';
import type { PrismaClient } from '@prisma/client';

// Mock Prisma client with full structure needed for tests
const createMockPrisma = () => ({
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
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
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
    update: jest.fn(),
  },
  $transaction: jest.fn((fn: (tx: ReturnType<typeof createMockPrisma>) => Promise<unknown>) =>
    fn(createMockPrisma())
  ),
});

describe('PaymentOrchestrator', () => {
  let orchestrator: PaymentOrchestrator;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockProvider: MockPaymentProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
    mockProvider = new MockPaymentProvider({ delay: 0 }); // No delay for tests
    orchestrator = new PaymentOrchestrator(
      mockPrisma as unknown as PrismaClient,
      mockProvider
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('executeBatch', () => {
    const createMockBatch = (overrides: Record<string, unknown> = {}) => ({
      id: 'batch-123',
      batchNumber: 'BATCH-2024-001',
      status: 'PENDING',
      totalAmount: 50.0,
      provider: 'MOCK',
      transactions: [
        {
          id: 'txn-1',
          transactionId: 'TXN-123',
          commissionId: 'comm-1',
          amount: 50.0,
          currency: 'USD',
          payeeRiseId: '0xA35b...',
          status: 'PENDING',
          retryCount: 0,
          commission: { id: 'comm-1', status: 'APPROVED' },
          affiliateRiseAccount: {
            affiliateProfileId: 'aff-123',
            riseId: '0xA35b...',
          },
        },
      ],
      auditLogs: [],
      ...overrides,
    });

    it('should execute batch payment successfully', async () => {
      const mockBatch = createMockBatch();

      // Mock getBatchById
      mockPrisma.paymentBatch.findUnique = jest.fn().mockResolvedValue(mockBatch);
      // Mock isBatchProcessing
      mockPrisma.paymentBatch.count = jest.fn().mockResolvedValue(0);
      // Mock batch status update
      mockPrisma.paymentBatch.update = jest.fn().mockResolvedValue({});
      // Mock transaction update
      mockPrisma.disbursementTransaction.update = jest.fn().mockResolvedValue({});
      mockPrisma.disbursementTransaction.findUnique = jest.fn().mockResolvedValue({
        id: 'txn-1',
        transactionId: 'TXN-123',
        retryCount: 0,
      });
      // Mock commission update
      mockPrisma.commission.update = jest.fn().mockResolvedValue({});
      // Mock audit log
      mockPrisma.disbursementAuditLog.create = jest.fn().mockResolvedValue({});

      const result = await orchestrator.executeBatch('batch-123');

      expect(result.success).toBe(true);
      expect(result.batchId).toBe('batch-123');
      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(0);

      // Verify commission was marked as PAID
      expect(mockPrisma.commission.update).toHaveBeenCalledWith({
        where: { id: 'comm-1' },
        data: { status: 'PAID' },
      });
    });

    it('should handle failed payments with retry logic', async () => {
      // Use failing provider
      const failingProvider = new MockPaymentProvider({
        failureRate: 1.0,
        delay: 0,
      });
      orchestrator = new PaymentOrchestrator(
        mockPrisma as unknown as PrismaClient,
        failingProvider
      );

      const mockBatch = createMockBatch();

      mockPrisma.paymentBatch.findUnique = jest.fn().mockResolvedValue(mockBatch);
      mockPrisma.paymentBatch.count = jest.fn().mockResolvedValue(0);
      mockPrisma.paymentBatch.update = jest.fn().mockResolvedValue({});
      mockPrisma.disbursementTransaction.update = jest.fn().mockResolvedValue({});
      mockPrisma.disbursementTransaction.findUnique = jest.fn().mockResolvedValue({
        id: 'txn-1',
        transactionId: 'TXN-123',
        status: 'FAILED',
        retryCount: 0,
      });
      mockPrisma.disbursementAuditLog.create = jest.fn().mockResolvedValue({});

      const result = await orchestrator.executeBatch('batch-123');

      expect(result.success).toBe(false);
      expect(result.failedCount).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should throw error for non-existent batch', async () => {
      mockPrisma.paymentBatch.findUnique = jest.fn().mockResolvedValue(null);

      await expect(orchestrator.executeBatch('non-existent')).rejects.toThrow(
        'Batch not found'
      );
    });

    it('should throw error for already processing batch', async () => {
      const mockBatch = createMockBatch({ status: 'PROCESSING' });

      mockPrisma.paymentBatch.findUnique = jest.fn().mockResolvedValue(mockBatch);

      await expect(orchestrator.executeBatch('batch-123')).rejects.toThrow(
        'Cannot execute batch with status PROCESSING'
      );
    });

    it('should throw error for completed batch', async () => {
      const mockBatch = createMockBatch({ status: 'COMPLETED' });

      mockPrisma.paymentBatch.findUnique = jest.fn().mockResolvedValue(mockBatch);

      await expect(orchestrator.executeBatch('batch-123')).rejects.toThrow(
        'Cannot execute batch with status COMPLETED'
      );
    });

    it('should throw error when another batch is processing', async () => {
      const mockBatch = createMockBatch();

      mockPrisma.paymentBatch.findUnique = jest.fn().mockResolvedValue(mockBatch);
      // Mock another batch is processing
      mockPrisma.paymentBatch.count = jest.fn().mockResolvedValue(1);

      await expect(orchestrator.executeBatch('batch-123')).rejects.toThrow(
        'Another batch is currently processing'
      );
    });

    it('should handle batch with no pending transactions', async () => {
      const mockBatch = createMockBatch({
        transactions: [
          {
            id: 'txn-1',
            status: 'COMPLETED', // Already completed
            payeeRiseId: '0xA35b...',
          },
        ],
      });

      mockPrisma.paymentBatch.findUnique = jest.fn().mockResolvedValue(mockBatch);
      mockPrisma.paymentBatch.count = jest.fn().mockResolvedValue(0);
      mockPrisma.paymentBatch.update = jest.fn().mockResolvedValue({});
      mockPrisma.disbursementAuditLog.create = jest.fn().mockResolvedValue({});

      const result = await orchestrator.executeBatch('batch-123');

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(0);
    });

    it('should skip transactions without payeeRiseId', async () => {
      const mockBatch = createMockBatch({
        transactions: [
          {
            id: 'txn-1',
            status: 'PENDING',
            payeeRiseId: null, // No Rise ID
          },
          {
            id: 'txn-2',
            transactionId: 'TXN-456',
            status: 'PENDING',
            payeeRiseId: '0xA35b...',
            commissionId: 'comm-2',
            amount: 50.0,
            currency: 'USD',
            commission: { id: 'comm-2', status: 'APPROVED' },
            affiliateRiseAccount: {
              affiliateProfileId: 'aff-456',
              riseId: '0xA35b...',
            },
          },
        ],
      });

      mockPrisma.paymentBatch.findUnique = jest.fn().mockResolvedValue(mockBatch);
      mockPrisma.paymentBatch.count = jest.fn().mockResolvedValue(0);
      mockPrisma.paymentBatch.update = jest.fn().mockResolvedValue({});
      mockPrisma.disbursementTransaction.update = jest.fn().mockResolvedValue({});
      mockPrisma.commission.update = jest.fn().mockResolvedValue({});
      mockPrisma.disbursementAuditLog.create = jest.fn().mockResolvedValue({});

      const result = await orchestrator.executeBatch('batch-123');

      // Only 1 transaction should be processed (the one with payeeRiseId)
      expect(result.successCount).toBe(1);
    });
  });

  describe('retryFailedTransactions', () => {
    it('should retry failed transactions in a batch', async () => {
      const mockBatch = {
        id: 'batch-123',
        batchNumber: 'BATCH-2024-001',
        status: 'FAILED',
        transactions: [
          {
            id: 'txn-1',
            transactionId: 'TXN-123',
            status: 'PENDING', // Reset to pending
            payeeRiseId: '0xA35b...',
            commissionId: 'comm-1',
            amount: 50.0,
            currency: 'USD',
            commission: { id: 'comm-1', status: 'APPROVED' },
            affiliateRiseAccount: { affiliateProfileId: 'aff-123' },
          },
        ],
        auditLogs: [],
      };

      // Mock reset for retry
      mockPrisma.disbursementTransaction.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      // Mock batch lookup - first call returns FAILED, second call returns QUEUED (after status update)
      mockPrisma.paymentBatch.findUnique = jest.fn()
        .mockResolvedValueOnce(mockBatch) // First call in retryFailedTransactions
        .mockResolvedValueOnce({ ...mockBatch, status: 'QUEUED' }); // Second call in executeBatch
      mockPrisma.paymentBatch.count = jest.fn().mockResolvedValue(0);
      mockPrisma.paymentBatch.update = jest.fn().mockResolvedValue({});
      mockPrisma.disbursementTransaction.update = jest.fn().mockResolvedValue({});
      mockPrisma.commission.update = jest.fn().mockResolvedValue({});
      mockPrisma.disbursementAuditLog.create = jest.fn().mockResolvedValue({});

      const result = await orchestrator.retryFailedTransactions('batch-123');

      expect(result.batchId).toBe('batch-123');
    });

    it('should return success with message when no failed transactions to retry', async () => {
      const mockBatch = {
        id: 'batch-123',
        batchNumber: 'BATCH-2024-001',
        status: 'COMPLETED',
        transactions: [],
        auditLogs: [],
      };

      mockPrisma.disbursementTransaction.updateMany = jest.fn().mockResolvedValue({ count: 0 });
      mockPrisma.paymentBatch.findUnique = jest.fn().mockResolvedValue(mockBatch);

      const result = await orchestrator.retryFailedTransactions('batch-123');

      expect(result.success).toBe(true);
      expect(result.errors).toContain('No failed transactions to retry');
    });
  });

  describe('getExecutionStats', () => {
    it('should return batch with execution statistics', async () => {
      const mockBatch = {
        id: 'batch-123',
        batchNumber: 'BATCH-2024-001',
        transactions: [
          { status: 'COMPLETED' },
          { status: 'COMPLETED' },
          { status: 'FAILED' },
          { status: 'PENDING' },
        ],
        auditLogs: [],
      };

      mockPrisma.paymentBatch.findUnique = jest.fn().mockResolvedValue(mockBatch);

      const result = await orchestrator.getExecutionStats('batch-123');

      expect(result.batch).toBeDefined();
      expect(result.stats.total).toBe(4);
      expect(result.stats.completed).toBe(2);
      expect(result.stats.failed).toBe(1);
      expect(result.stats.pending).toBe(1);
    });

    it('should return empty stats for non-existent batch', async () => {
      mockPrisma.paymentBatch.findUnique = jest.fn().mockResolvedValue(null);

      const result = await orchestrator.getExecutionStats('non-existent');

      expect(result.batch).toBeNull();
      expect(result.stats.total).toBe(0);
    });
  });
});
