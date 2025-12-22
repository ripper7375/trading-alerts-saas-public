/**
 * Batch Manager Service Tests (Part 19B)
 *
 * TDD tests for BatchManager service covering:
 * - Batch creation
 * - Batch splitting for large batches
 * - Batch status management
 * - Batch retrieval and deletion
 */

import { PrismaClient } from '@prisma/client';
import { BatchManager } from '@/lib/disbursement/services/batch-manager';
import type { CommissionAggregate } from '@/types/disbursement';
import { MAX_BATCH_SIZE } from '@/lib/disbursement/constants';

// Mock Prisma client
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    paymentBatch: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    disbursementTransaction: {
      createMany: jest.fn(),
    },
    disbursementAuditLog: {
      create: jest.fn(),
    },
  },
}));

describe('BatchManager', () => {
  let manager: BatchManager;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create mock prisma instance
    mockPrisma = {
      paymentBatch: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      disbursementTransaction: {
        createMany: jest.fn(),
      },
      disbursementAuditLog: {
        create: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaClient>;
    manager = new BatchManager(mockPrisma);
  });

  describe('createBatch', () => {
    it('should create a payment batch with correct totals', async () => {
      const aggregates: CommissionAggregate[] = [
        {
          affiliateId: 'aff-123',
          commissionIds: ['comm-1', 'comm-2'],
          totalAmount: 100.0,
          commissionCount: 2,
          oldestDate: new Date('2025-01-01'),
          canPayout: true,
        },
        {
          affiliateId: 'aff-456',
          commissionIds: ['comm-3'],
          totalAmount: 75.0,
          commissionCount: 1,
          oldestDate: new Date('2025-01-15'),
          canPayout: true,
        },
      ];

      const mockBatch = {
        id: 'batch-123',
        batchNumber: 'BATCH-2025-ABC123',
        totalAmount: 175.0,
        paymentCount: 2,
        currency: 'USD',
        provider: 'MOCK',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.paymentBatch.create as jest.Mock).mockResolvedValue(mockBatch);
      (mockPrisma.disbursementAuditLog.create as jest.Mock).mockResolvedValue({});

      const batch = await manager.createBatch(aggregates, 'MOCK', 'admin-user');

      expect(batch.id).toBe('batch-123');
      expect(batch.totalAmount).toBe(175.0);
      expect(batch.paymentCount).toBe(2);
      expect(mockPrisma.paymentBatch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          paymentCount: 2,
          totalAmount: 175.0,
          currency: 'USD',
          provider: 'MOCK',
          status: 'PENDING',
        }),
      });
    });

    it('should create batch with single aggregate', async () => {
      const aggregates: CommissionAggregate[] = [
        {
          affiliateId: 'aff-solo',
          commissionIds: ['comm-only'],
          totalAmount: 50.0,
          commissionCount: 1,
          oldestDate: new Date(),
          canPayout: true,
        },
      ];

      const mockBatch = {
        id: 'batch-solo',
        batchNumber: 'BATCH-2025-SOLO',
        totalAmount: 50.0,
        paymentCount: 1,
        currency: 'USD',
        provider: 'RISE',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.paymentBatch.create as jest.Mock).mockResolvedValue(mockBatch);
      (mockPrisma.disbursementAuditLog.create as jest.Mock).mockResolvedValue({});

      const batch = await manager.createBatch(aggregates, 'RISE');

      expect(batch.paymentCount).toBe(1);
      expect(batch.totalAmount).toBe(50.0);
    });
  });

  describe('splitIntoBatches', () => {
    it('should not split when under max batch size', () => {
      const aggregates = Array.from({ length: 50 }, (_, i) => ({
        affiliateId: `aff-${i}`,
        commissionIds: [`comm-${i}`],
        totalAmount: 50.0,
        commissionCount: 1,
        oldestDate: new Date(),
        canPayout: true,
      }));

      const batches = manager.splitIntoBatches(aggregates, MAX_BATCH_SIZE);

      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(50);
    });

    it('should split large batches correctly', () => {
      const aggregates = Array.from({ length: 150 }, (_, i) => ({
        affiliateId: `aff-${i}`,
        commissionIds: [`comm-${i}`],
        totalAmount: 50.0,
        commissionCount: 1,
        oldestDate: new Date(),
        canPayout: true,
      }));

      const batches = manager.splitIntoBatches(aggregates, MAX_BATCH_SIZE);

      expect(batches).toHaveLength(2);
      expect(batches[0]).toHaveLength(100);
      expect(batches[1]).toHaveLength(50);
    });

    it('should split exactly at max batch size', () => {
      const aggregates = Array.from({ length: 200 }, (_, i) => ({
        affiliateId: `aff-${i}`,
        commissionIds: [`comm-${i}`],
        totalAmount: 50.0,
        commissionCount: 1,
        oldestDate: new Date(),
        canPayout: true,
      }));

      const batches = manager.splitIntoBatches(aggregates, MAX_BATCH_SIZE);

      expect(batches).toHaveLength(2);
      expect(batches[0]).toHaveLength(100);
      expect(batches[1]).toHaveLength(100);
    });

    it('should handle empty array', () => {
      const batches = manager.splitIntoBatches([], MAX_BATCH_SIZE);

      expect(batches).toHaveLength(0);
    });

    it('should handle custom batch size', () => {
      const aggregates = Array.from({ length: 25 }, (_, i) => ({
        affiliateId: `aff-${i}`,
        commissionIds: [`comm-${i}`],
        totalAmount: 50.0,
        commissionCount: 1,
        oldestDate: new Date(),
        canPayout: true,
      }));

      const batches = manager.splitIntoBatches(aggregates, 10);

      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(10);
      expect(batches[1]).toHaveLength(10);
      expect(batches[2]).toHaveLength(5);
    });
  });

  describe('getBatchById', () => {
    it('should return batch with transactions', async () => {
      const mockBatch = {
        id: 'batch-123',
        batchNumber: 'BATCH-2025-ABC',
        totalAmount: 100.0,
        paymentCount: 1,
        status: 'PENDING',
        transactions: [
          {
            id: 'txn-1',
            status: 'PENDING',
            amount: 100.0,
          },
        ],
      };

      (mockPrisma.paymentBatch.findUnique as jest.Mock).mockResolvedValue(mockBatch);

      const batch = await manager.getBatchById('batch-123');

      expect(batch).toBeTruthy();
      expect(batch?.id).toBe('batch-123');
      expect(mockPrisma.paymentBatch.findUnique).toHaveBeenCalledWith({
        where: { id: 'batch-123' },
        include: expect.objectContaining({
          transactions: expect.any(Object),
        }),
      });
    });

    it('should return null for non-existent batch', async () => {
      (mockPrisma.paymentBatch.findUnique as jest.Mock).mockResolvedValue(null);

      const batch = await manager.getBatchById('non-existent');

      expect(batch).toBeNull();
    });
  });

  describe('updateBatchStatus', () => {
    it('should update status to PROCESSING with executedAt', async () => {
      (mockPrisma.paymentBatch.update as jest.Mock).mockResolvedValue({});

      await manager.updateBatchStatus('batch-123', 'PROCESSING');

      expect(mockPrisma.paymentBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-123' },
        data: expect.objectContaining({
          status: 'PROCESSING',
          executedAt: expect.any(Date),
        }),
      });
    });

    it('should update status to COMPLETED with completedAt', async () => {
      (mockPrisma.paymentBatch.update as jest.Mock).mockResolvedValue({});

      await manager.updateBatchStatus('batch-123', 'COMPLETED');

      expect(mockPrisma.paymentBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-123' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          completedAt: expect.any(Date),
        }),
      });
    });

    it('should update status to FAILED with error message', async () => {
      (mockPrisma.paymentBatch.update as jest.Mock).mockResolvedValue({});

      await manager.updateBatchStatus(
        'batch-123',
        'FAILED',
        'Provider timeout'
      );

      expect(mockPrisma.paymentBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-123' },
        data: expect.objectContaining({
          status: 'FAILED',
          failedAt: expect.any(Date),
          errorMessage: 'Provider timeout',
        }),
      });
    });
  });

  describe('getAllBatches', () => {
    it('should return all batches with transactions', async () => {
      const mockBatches = [
        { id: 'batch-1', status: 'COMPLETED', transactions: [] },
        { id: 'batch-2', status: 'PENDING', transactions: [] },
      ];

      (mockPrisma.paymentBatch.findMany as jest.Mock).mockResolvedValue(mockBatches);

      const batches = await manager.getAllBatches();

      expect(batches).toHaveLength(2);
      expect(mockPrisma.paymentBatch.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: expect.any(Object),
      });
    });

    it('should filter by status', async () => {
      const mockBatches = [{ id: 'batch-1', status: 'COMPLETED' }];

      (mockPrisma.paymentBatch.findMany as jest.Mock).mockResolvedValue(mockBatches);

      await manager.getAllBatches('COMPLETED', 25);

      expect(mockPrisma.paymentBatch.findMany).toHaveBeenCalledWith({
        where: { status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 25,
        include: expect.any(Object),
      });
    });
  });

  describe('deleteBatch', () => {
    it('should delete PENDING batch', async () => {
      (mockPrisma.paymentBatch.findUnique as jest.Mock).mockResolvedValue({
        id: 'batch-123',
        status: 'PENDING',
      });
      (mockPrisma.paymentBatch.delete as jest.Mock).mockResolvedValue({});

      await manager.deleteBatch('batch-123');

      expect(mockPrisma.paymentBatch.delete).toHaveBeenCalledWith({
        where: { id: 'batch-123' },
      });
    });

    it('should throw error for non-existent batch', async () => {
      (mockPrisma.paymentBatch.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(manager.deleteBatch('non-existent')).rejects.toThrow(
        'Batch not found'
      );
    });

    it('should throw error when deleting PROCESSING batch', async () => {
      (mockPrisma.paymentBatch.findUnique as jest.Mock).mockResolvedValue({
        id: 'batch-123',
        status: 'PROCESSING',
      });

      await expect(manager.deleteBatch('batch-123')).rejects.toThrow(
        'Cannot delete batch that is processing or completed'
      );
    });

    it('should throw error when deleting COMPLETED batch', async () => {
      (mockPrisma.paymentBatch.findUnique as jest.Mock).mockResolvedValue({
        id: 'batch-123',
        status: 'COMPLETED',
      });

      await expect(manager.deleteBatch('batch-123')).rejects.toThrow(
        'Cannot delete batch that is processing or completed'
      );
    });
  });
});
