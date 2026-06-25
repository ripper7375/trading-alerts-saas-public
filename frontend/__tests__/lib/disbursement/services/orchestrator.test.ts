/**
 * Tests for Payment Orchestrator (Part 19B)
 */

import { PrismaClient } from '@prisma/client';
import { PaymentOrchestrator } from '@/lib/disbursement/services/payment-orchestrator';
import { MockPaymentProvider } from '@/lib/disbursement/providers/mock-provider';

// Mock Prisma client
const mockPrisma = {
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
};

describe('PaymentOrchestrator', () => {
  let orchestrator: PaymentOrchestrator;
  let mockProvider: MockPaymentProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProvider = new MockPaymentProvider({ delay: 0, failureRate: 0 });
    // @ts-expect-error Mocking PrismaClient
    orchestrator = new PaymentOrchestrator(mockPrisma, mockProvider);
  });

  describe('instantiation', () => {
    it('should instantiate without errors', () => {
      // @ts-expect-error Mocking PrismaClient
      const orch = new PaymentOrchestrator({} as PrismaClient, mockProvider);
      expect(orch).toBeDefined();
    });
  });

  describe('executeBatch', () => {
    it('should throw error when batch not found', async () => {
      mockPrisma.paymentBatch.findUnique.mockResolvedValue(null);

      await expect(orchestrator.executeBatch('nonexistent')).rejects.toThrow(
        'Batch not found'
      );
    });

    it('should throw error when batch status is COMPLETED', async () => {
      mockPrisma.paymentBatch.findUnique.mockResolvedValue({
        id: 'batch-123',
        status: 'COMPLETED',
        transactions: [],
        auditLogs: [],
      });

      await expect(orchestrator.executeBatch('batch-123')).rejects.toThrow(
        'Cannot execute batch with status COMPLETED'
      );
    });

    it('should throw error when batch status is PROCESSING', async () => {
      mockPrisma.paymentBatch.findUnique.mockResolvedValue({
        id: 'batch-123',
        status: 'PROCESSING',
        transactions: [],
        auditLogs: [],
      });

      await expect(orchestrator.executeBatch('batch-123')).rejects.toThrow(
        'Cannot execute batch with status PROCESSING'
      );
    });

    it('should handle empty transactions list', async () => {
      mockPrisma.paymentBatch.findUnique.mockResolvedValue({
        id: 'batch-123',
        batchNumber: 'BATCH-2025-ABC',
        status: 'PENDING',
        transactions: [],
        auditLogs: [],
        totalAmount: 0,
      });
      mockPrisma.paymentBatch.update.mockResolvedValue({});
      mockPrisma.disbursementAuditLog.create.mockResolvedValue({});

      const result = await orchestrator.executeBatch('batch-123');

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(0);
    });
  });

  describe('getExecutionSummary', () => {
    it('should throw error when batch not found', async () => {
      mockPrisma.paymentBatch.findUnique.mockResolvedValue(null);

      await expect(
        orchestrator.getExecutionSummary('nonexistent')
      ).rejects.toThrow('Batch not found');
    });

    it('should return correct summary', async () => {
      mockPrisma.paymentBatch.findUnique.mockResolvedValue({
        id: 'batch-123',
        status: 'COMPLETED',
        totalAmount: 500,
        transactions: [
          { id: 't1', status: 'COMPLETED', amount: 100 },
          { id: 't2', status: 'COMPLETED', amount: 150 },
          { id: 't3', status: 'FAILED', amount: 250 },
        ],
        auditLogs: [],
      });

      mockPrisma.disbursementTransaction.groupBy.mockResolvedValue([
        { status: 'COMPLETED', _count: 2 },
        { status: 'FAILED', _count: 1 },
      ]);

      const summary = await orchestrator.getExecutionSummary('batch-123');

      expect(summary.batchId).toBe('batch-123');
      expect(summary.status).toBe('COMPLETED');
      expect(summary.totalTransactions).toBe(3);
      expect(summary.completed).toBe(2);
      expect(summary.failed).toBe(1);
      expect(summary.paidAmount).toBe(250); // 100 + 150
    });
  });
});
