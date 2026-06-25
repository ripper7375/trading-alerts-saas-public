/**
 * Tests for Batch Manager (Part 19B)
 */

import { PrismaClient } from '@prisma/client';
import { BatchManager } from '@/lib/disbursement/services/batch-manager';

// Mock Prisma client
const mockPrisma = {
  paymentBatch: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  disbursementTransaction: {
    create: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    groupBy: jest.fn(),
  },
  disbursementAuditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  commission: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  affiliateProfile: {
    update: jest.fn(),
  },
};

describe('BatchManager', () => {
  let batchManager: BatchManager;

  beforeEach(() => {
    jest.clearAllMocks();
    // @ts-expect-error Mocking PrismaClient
    batchManager = new BatchManager(mockPrisma);
  });

  describe('instantiation', () => {
    it('should instantiate without errors', () => {
      // @ts-expect-error Mocking PrismaClient
      const manager = new BatchManager({} as PrismaClient);
      expect(manager).toBeDefined();
    });
  });

  describe('splitIntoBatches', () => {
    it('should split items into batches correctly', () => {
      const items = Array.from({ length: 150 }, (_, i) => i);
      const batches = batchManager.splitIntoBatches(items, 100);

      expect(batches).toHaveLength(2);
      expect(batches[0]).toHaveLength(100);
      expect(batches[1]).toHaveLength(50);
    });

    it('should handle empty array', () => {
      const batches = batchManager.splitIntoBatches([]);
      expect(batches).toHaveLength(0);
    });

    it('should handle array smaller than batch size', () => {
      const items = [1, 2, 3, 4, 5];
      const batches = batchManager.splitIntoBatches(items, 100);

      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(5);
    });

    it('should handle exact batch size', () => {
      const items = Array.from({ length: 100 }, (_, i) => i);
      const batches = batchManager.splitIntoBatches(items, 100);

      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(100);
    });
  });

  describe('getBatchById', () => {
    it('should return batch with transactions when found', async () => {
      const mockBatch = {
        id: 'batch-123',
        batchNumber: 'BATCH-2025-ABC123',
        status: 'PENDING',
        transactions: [],
        auditLogs: [],
      };

      mockPrisma.paymentBatch.findUnique.mockResolvedValue(mockBatch);

      const result = await batchManager.getBatchById('batch-123');

      expect(result).toEqual(mockBatch);
      expect(mockPrisma.paymentBatch.findUnique).toHaveBeenCalledWith({
        where: { id: 'batch-123' },
        include: expect.any(Object),
      });
    });

    it('should return null when batch not found', async () => {
      mockPrisma.paymentBatch.findUnique.mockResolvedValue(null);

      const result = await batchManager.getBatchById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('deleteBatch', () => {
    it('should throw error when batch not found', async () => {
      mockPrisma.paymentBatch.findUnique.mockResolvedValue(null);

      await expect(batchManager.deleteBatch('nonexistent')).rejects.toThrow(
        'Batch not found'
      );
    });

    it('should throw error when batch is PROCESSING', async () => {
      mockPrisma.paymentBatch.findUnique.mockResolvedValue({
        id: 'batch-123',
        status: 'PROCESSING',
      });

      await expect(batchManager.deleteBatch('batch-123')).rejects.toThrow(
        'Cannot delete batch that is processing or completed'
      );
    });

    it('should throw error when batch is COMPLETED', async () => {
      mockPrisma.paymentBatch.findUnique.mockResolvedValue({
        id: 'batch-123',
        status: 'COMPLETED',
      });

      await expect(batchManager.deleteBatch('batch-123')).rejects.toThrow(
        'Cannot delete batch that is processing or completed'
      );
    });
  });

  describe('updateBatchStatus', () => {
    it('should update status to PROCESSING with executedAt', async () => {
      mockPrisma.paymentBatch.update.mockResolvedValue({});

      await batchManager.updateBatchStatus('batch-123', 'PROCESSING');

      expect(mockPrisma.paymentBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-123' },
        data: {
          status: 'PROCESSING',
          executedAt: expect.any(Date),
        },
      });
    });

    it('should update status to COMPLETED with completedAt', async () => {
      mockPrisma.paymentBatch.update.mockResolvedValue({});

      await batchManager.updateBatchStatus('batch-123', 'COMPLETED');

      expect(mockPrisma.paymentBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-123' },
        data: {
          status: 'COMPLETED',
          completedAt: expect.any(Date),
        },
      });
    });

    it('should update status to FAILED with failedAt and error', async () => {
      mockPrisma.paymentBatch.update.mockResolvedValue({});

      await batchManager.updateBatchStatus('batch-123', 'FAILED', 'Test error');

      expect(mockPrisma.paymentBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-123' },
        data: {
          status: 'FAILED',
          failedAt: expect.any(Date),
          errorMessage: 'Test error',
        },
      });
    });
  });
});
