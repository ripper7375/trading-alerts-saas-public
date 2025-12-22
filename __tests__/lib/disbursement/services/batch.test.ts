/**
 * Tests for BatchManager Service (Part 19B)
 */

import { BatchManager } from '@/lib/disbursement/services/batch-manager';
import type { CommissionAggregate } from '@/types/disbursement';
import type { PrismaClient } from '@prisma/client';

// Mock Prisma client
const mockPrisma = {
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
    deleteMany: jest.fn(),
  },
  affiliateRiseAccount: {
    findUnique: jest.fn(),
  },
  commission: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn((fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)),
} as unknown as jest.Mocked<PrismaClient>;

describe('BatchManager', () => {
  let manager: BatchManager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new BatchManager(mockPrisma);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createBatch', () => {
    const mockAggregates: CommissionAggregate[] = [
      {
        affiliateId: 'aff-123',
        commissionIds: ['comm-1', 'comm-2'],
        totalAmount: 100.0,
        commissionCount: 2,
        oldestDate: new Date('2024-01-01'),
        canPayout: true,
      },
    ];

    it('should create payment batch with transactions', async () => {
      const mockBatch = {
        id: 'batch-123',
        batchNumber: 'BATCH-2024-ABC123',
        totalAmount: 100.0,
        paymentCount: 1,
        currency: 'USD',
        provider: 'MOCK',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.paymentBatch.create = jest.fn().mockResolvedValue(mockBatch);
      mockPrisma.affiliateRiseAccount.findUnique = jest.fn().mockResolvedValue({
        id: 'rise-acc-123',
        riseId: '0xABC...',
      });
      mockPrisma.commission.findUnique = jest.fn().mockResolvedValue({
        id: 'comm-1',
        commissionAmount: 50.0,
      });
      mockPrisma.disbursementTransaction.create = jest.fn().mockResolvedValue({});
      mockPrisma.disbursementTransaction.count = jest.fn().mockResolvedValue(2);
      mockPrisma.disbursementAuditLog.create = jest.fn().mockResolvedValue({});

      const result = await manager.createBatch(mockAggregates, 'MOCK', 'admin-user');

      expect(result.batch.id).toBe('batch-123');
      expect(result.batch.totalAmount).toBe(100.0);
      expect(result.transactionCount).toBe(2);
    });

    it('should throw error when no payable affiliates', async () => {
      const nonPayableAggregates: CommissionAggregate[] = [
        {
          affiliateId: 'aff-123',
          commissionIds: ['comm-1'],
          totalAmount: 25.0, // Below minimum
          commissionCount: 1,
          oldestDate: new Date(),
          canPayout: false, // Not payable
        },
      ];

      await expect(
        manager.createBatch(nonPayableAggregates, 'MOCK')
      ).rejects.toThrow('No payable affiliates provided');
    });
  });

  describe('getBatchById', () => {
    it('should get batch by id with full relations', async () => {
      const mockBatchWithRelations = {
        id: 'batch-123',
        batchNumber: 'BATCH-2024-ABC123',
        status: 'PENDING',
        transactions: [
          {
            id: 'txn-1',
            transactionId: 'TXN-123',
            commission: { id: 'comm-1', status: 'APPROVED' },
            affiliateRiseAccount: {
              affiliateProfileId: 'aff-123',
              riseId: '0xABC...',
            },
          },
        ],
        auditLogs: [],
      };

      mockPrisma.paymentBatch.findUnique = jest.fn().mockResolvedValue(mockBatchWithRelations);

      const batch = await manager.getBatchById('batch-123');

      expect(batch).toBeDefined();
      expect(batch?.transactions).toHaveLength(1);
      expect(batch?.transactions[0].commission).toBeDefined();
      expect(batch?.transactions[0].affiliateRiseAccount).toBeDefined();
    });

    it('should return null for non-existent batch', async () => {
      mockPrisma.paymentBatch.findUnique = jest.fn().mockResolvedValue(null);

      const batch = await manager.getBatchById('non-existent');

      expect(batch).toBeNull();
    });
  });

  describe('updateBatchStatus', () => {
    it('should update batch status to PROCESSING with executedAt', async () => {
      mockPrisma.paymentBatch.update = jest.fn().mockResolvedValue({});

      await manager.updateBatchStatus('batch-123', 'PROCESSING');

      expect(mockPrisma.paymentBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-123' },
        data: expect.objectContaining({
          status: 'PROCESSING',
          executedAt: expect.any(Date),
        }),
      });
    });

    it('should update batch status to COMPLETED with completedAt', async () => {
      mockPrisma.paymentBatch.update = jest.fn().mockResolvedValue({});

      await manager.updateBatchStatus('batch-123', 'COMPLETED');

      expect(mockPrisma.paymentBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-123' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          completedAt: expect.any(Date),
        }),
      });
    });

    it('should update batch status to FAILED with error message', async () => {
      mockPrisma.paymentBatch.update = jest.fn().mockResolvedValue({});

      await manager.updateBatchStatus('batch-123', 'FAILED', 'Payment provider error');

      expect(mockPrisma.paymentBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-123' },
        data: expect.objectContaining({
          status: 'FAILED',
          failedAt: expect.any(Date),
          errorMessage: 'Payment provider error',
        }),
      });
    });
  });

  describe('splitIntoBatches', () => {
    it('should split array into batches of specified size', () => {
      const items = Array.from({ length: 150 }, (_, i) => ({
        id: `item-${i}`,
        amount: 50.0,
      }));

      const batches = manager.splitIntoBatches(items, 100);

      expect(batches).toHaveLength(2);
      expect(batches[0]).toHaveLength(100);
      expect(batches[1]).toHaveLength(50);
    });

    it('should return single batch if items fit in one', () => {
      const items = Array.from({ length: 50 }, (_, i) => ({ id: `item-${i}` }));

      const batches = manager.splitIntoBatches(items, 100);

      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(50);
    });

    it('should return empty array for empty input', () => {
      const batches = manager.splitIntoBatches([], 100);

      expect(batches).toHaveLength(0);
    });
  });

  describe('deleteBatch', () => {
    it('should delete batch and related records', async () => {
      const mockBatch = {
        id: 'batch-123',
        status: 'PENDING',
        transactions: [],
        auditLogs: [],
      };

      mockPrisma.paymentBatch.findUnique = jest.fn().mockResolvedValue(mockBatch);
      mockPrisma.disbursementAuditLog.deleteMany = jest.fn().mockResolvedValue({ count: 0 });
      mockPrisma.disbursementTransaction.deleteMany = jest.fn().mockResolvedValue({ count: 0 });
      mockPrisma.paymentBatch.delete = jest.fn().mockResolvedValue({});

      await manager.deleteBatch('batch-123');

      expect(mockPrisma.paymentBatch.delete).toHaveBeenCalled();
    });

    it('should throw error for processing batch', async () => {
      const mockBatch = {
        id: 'batch-123',
        status: 'PROCESSING',
        transactions: [],
        auditLogs: [],
      };

      mockPrisma.paymentBatch.findUnique = jest.fn().mockResolvedValue(mockBatch);

      await expect(manager.deleteBatch('batch-123')).rejects.toThrow(
        'Cannot delete batch that is currently processing'
      );
    });

    it('should throw error for completed batch', async () => {
      const mockBatch = {
        id: 'batch-123',
        status: 'COMPLETED',
        transactions: [],
        auditLogs: [],
      };

      mockPrisma.paymentBatch.findUnique = jest.fn().mockResolvedValue(mockBatch);

      await expect(manager.deleteBatch('batch-123')).rejects.toThrow(
        'Cannot delete batch that has been completed'
      );
    });

    it('should throw error for non-existent batch', async () => {
      mockPrisma.paymentBatch.findUnique = jest.fn().mockResolvedValue(null);

      await expect(manager.deleteBatch('non-existent')).rejects.toThrow('Batch not found');
    });
  });

  describe('cancelBatch', () => {
    it('should cancel batch and pending transactions', async () => {
      const mockBatch = {
        id: 'batch-123',
        status: 'PENDING',
        transactions: [],
        auditLogs: [],
      };

      mockPrisma.paymentBatch.findUnique = jest.fn().mockResolvedValue(mockBatch);
      mockPrisma.paymentBatch.update = jest.fn().mockResolvedValue({});
      mockPrisma.disbursementTransaction.updateMany = jest.fn().mockResolvedValue({ count: 5 });
      mockPrisma.disbursementAuditLog.create = jest.fn().mockResolvedValue({});

      await manager.cancelBatch('batch-123', 'User requested cancellation', 'admin');

      expect(mockPrisma.paymentBatch.update).toHaveBeenCalled();
      expect(mockPrisma.disbursementTransaction.updateMany).toHaveBeenCalledWith({
        where: {
          batchId: 'batch-123',
          status: 'PENDING',
        },
        data: {
          status: 'CANCELLED',
          errorMessage: 'User requested cancellation',
        },
      });
    });

    it('should throw error for already cancelled batch', async () => {
      const mockBatch = {
        id: 'batch-123',
        status: 'CANCELLED',
        transactions: [],
        auditLogs: [],
      };

      mockPrisma.paymentBatch.findUnique = jest.fn().mockResolvedValue(mockBatch);

      await expect(
        manager.cancelBatch('batch-123', 'reason')
      ).rejects.toThrow('Batch is already cancelled');
    });
  });

  describe('isBatchProcessing', () => {
    it('should return true if batch is processing', async () => {
      mockPrisma.paymentBatch.count = jest.fn().mockResolvedValue(1);

      const result = await manager.isBatchProcessing();

      expect(result).toBe(true);
    });

    it('should return false if no batch is processing', async () => {
      mockPrisma.paymentBatch.count = jest.fn().mockResolvedValue(0);

      const result = await manager.isBatchProcessing();

      expect(result).toBe(false);
    });
  });
});
