/**
 * Tests for Commission Aggregator (Part 19A)
 */

import { CommissionAggregator } from '@/lib/disbursement/services/commission-aggregator';
import { MINIMUM_PAYOUT_USD } from '@/lib/disbursement/constants';

// Mock Prisma client
const mockPrisma = {
  commission: {
    findMany: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
    updateMany: jest.fn(),
  },
  affiliateProfile: {
    findMany: jest.fn(),
  },
};

describe('CommissionAggregator', () => {
  let aggregator: CommissionAggregator;

  beforeEach(() => {
    jest.clearAllMocks();
    // @ts-expect-error Mocking PrismaClient
    aggregator = new CommissionAggregator(mockPrisma);
  });

  describe('getAggregatesByAffiliate', () => {
    it('should aggregate commissions for a single affiliate', async () => {
      const mockCommissions = [
        {
          id: 'comm-1',
          affiliateProfileId: 'aff-123',
          commissionAmount: 25.0,
          status: 'APPROVED',
          createdAt: new Date('2025-01-01'),
          disbursementTransaction: null,
        },
        {
          id: 'comm-2',
          affiliateProfileId: 'aff-123',
          commissionAmount: 30.0,
          status: 'APPROVED',
          createdAt: new Date('2025-01-02'),
          disbursementTransaction: null,
        },
      ];

      mockPrisma.commission.findMany.mockResolvedValue(mockCommissions);

      const result = await aggregator.getAggregatesByAffiliate('aff-123');

      expect(result.affiliateId).toBe('aff-123');
      expect(result.totalAmount).toBe(55.0);
      expect(result.commissionCount).toBe(2);
      expect(result.commissionIds).toEqual(['comm-1', 'comm-2']);
      expect(result.canPayout).toBe(true); // 55 >= 50
      expect(result.reason).toBeUndefined();
    });

    it('should identify affiliate not ready for payout (below minimum)', async () => {
      const mockCommissions = [
        {
          id: 'comm-1',
          affiliateProfileId: 'aff-123',
          commissionAmount: 25.0,
          status: 'APPROVED',
          createdAt: new Date('2025-01-01'),
          disbursementTransaction: null,
        },
      ];

      mockPrisma.commission.findMany.mockResolvedValue(mockCommissions);

      const result = await aggregator.getAggregatesByAffiliate('aff-123');

      expect(result.totalAmount).toBe(25.0);
      expect(result.canPayout).toBe(false);
      expect(result.reason).toContain(`$${MINIMUM_PAYOUT_USD}`);
    });

    it('should return empty aggregate for affiliate with no commissions', async () => {
      mockPrisma.commission.findMany.mockResolvedValue([]);

      const result = await aggregator.getAggregatesByAffiliate('aff-empty');

      expect(result.affiliateId).toBe('aff-empty');
      expect(result.totalAmount).toBe(0);
      expect(result.commissionCount).toBe(0);
      expect(result.commissionIds).toEqual([]);
      expect(result.canPayout).toBe(false);
    });

    it('should order oldest date from first commission', async () => {
      const oldestDate = new Date('2025-01-01');
      const mockCommissions = [
        {
          id: 'comm-1',
          affiliateProfileId: 'aff-123',
          commissionAmount: 50.0,
          status: 'APPROVED',
          createdAt: oldestDate,
          disbursementTransaction: null,
        },
        {
          id: 'comm-2',
          affiliateProfileId: 'aff-123',
          commissionAmount: 50.0,
          status: 'APPROVED',
          createdAt: new Date('2025-01-15'),
          disbursementTransaction: null,
        },
      ];

      mockPrisma.commission.findMany.mockResolvedValue(mockCommissions);

      const result = await aggregator.getAggregatesByAffiliate('aff-123');

      expect(result.oldestDate).toEqual(oldestDate);
    });

    it('should query with correct filters', async () => {
      mockPrisma.commission.findMany.mockResolvedValue([]);

      await aggregator.getAggregatesByAffiliate('aff-123');

      expect(mockPrisma.commission.findMany).toHaveBeenCalledWith({
        where: {
          affiliateProfileId: 'aff-123',
          status: 'APPROVED',
          disbursementTransaction: null,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    });
  });

  describe('getAllPayableAffiliates', () => {
    it('should return affiliates meeting minimum threshold', async () => {
      const mockCommissions = [
        {
          id: 'comm-1',
          affiliateProfileId: 'aff-123',
          commissionAmount: 60.0,
          createdAt: new Date('2025-01-01'),
          affiliateProfile: { id: 'aff-123' },
        },
        {
          id: 'comm-2',
          affiliateProfileId: 'aff-456',
          commissionAmount: 30.0,
          createdAt: new Date('2025-01-02'),
          affiliateProfile: { id: 'aff-456' },
        },
        {
          id: 'comm-3',
          affiliateProfileId: 'aff-456',
          commissionAmount: 25.0,
          createdAt: new Date('2025-01-03'),
          affiliateProfile: { id: 'aff-456' },
        },
      ];

      mockPrisma.commission.findMany.mockResolvedValue(mockCommissions);

      const result = await aggregator.getAllPayableAffiliates();

      // aff-123: $60 (meets threshold)
      // aff-456: $55 (meets threshold)
      expect(result).toHaveLength(2);
      expect(result[0]?.affiliateId).toBe('aff-123'); // Higher amount first
      expect(result[0]?.totalAmount).toBe(60.0);
      expect(result[1]?.affiliateId).toBe('aff-456');
      expect(result[1]?.totalAmount).toBe(55.0);
    });

    it('should exclude affiliates below minimum threshold', async () => {
      const mockCommissions = [
        {
          id: 'comm-1',
          affiliateProfileId: 'aff-rich',
          commissionAmount: 100.0,
          createdAt: new Date('2025-01-01'),
          affiliateProfile: { id: 'aff-rich' },
        },
        {
          id: 'comm-2',
          affiliateProfileId: 'aff-poor',
          commissionAmount: 10.0,
          createdAt: new Date('2025-01-02'),
          affiliateProfile: { id: 'aff-poor' },
        },
      ];

      mockPrisma.commission.findMany.mockResolvedValue(mockCommissions);

      const result = await aggregator.getAllPayableAffiliates();

      expect(result).toHaveLength(1);
      expect(result[0]?.affiliateId).toBe('aff-rich');
    });

    it('should return empty array when no payable affiliates', async () => {
      mockPrisma.commission.findMany.mockResolvedValue([]);

      const result = await aggregator.getAllPayableAffiliates();

      expect(result).toEqual([]);
    });

    it('should sort by total amount descending', async () => {
      const mockCommissions = [
        {
          id: 'comm-1',
          affiliateProfileId: 'aff-a',
          commissionAmount: 50.0,
          createdAt: new Date('2025-01-01'),
          affiliateProfile: { id: 'aff-a' },
        },
        {
          id: 'comm-2',
          affiliateProfileId: 'aff-b',
          commissionAmount: 150.0,
          createdAt: new Date('2025-01-02'),
          affiliateProfile: { id: 'aff-b' },
        },
        {
          id: 'comm-3',
          affiliateProfileId: 'aff-c',
          commissionAmount: 75.0,
          createdAt: new Date('2025-01-03'),
          affiliateProfile: { id: 'aff-c' },
        },
      ];

      mockPrisma.commission.findMany.mockResolvedValue(mockCommissions);

      const result = await aggregator.getAllPayableAffiliates();

      expect(result[0]?.totalAmount).toBe(150.0);
      expect(result[1]?.totalAmount).toBe(75.0);
      expect(result[2]?.totalAmount).toBe(50.0);
    });
  });

  describe('getTotalPendingAmount', () => {
    it('should return total of all approved commissions', async () => {
      mockPrisma.commission.aggregate.mockResolvedValue({
        _sum: { commissionAmount: 1000.0 },
      });

      const result = await aggregator.getTotalPendingAmount();

      expect(result).toBe(1000.0);
    });

    it('should return 0 when no pending commissions', async () => {
      mockPrisma.commission.aggregate.mockResolvedValue({
        _sum: { commissionAmount: null },
      });

      const result = await aggregator.getTotalPendingAmount();

      expect(result).toBe(0);
    });
  });

  describe('getCommissionStatusCounts', () => {
    it('should return counts by status', async () => {
      mockPrisma.commission.groupBy.mockResolvedValue([
        { status: 'PENDING', _count: 10 },
        { status: 'APPROVED', _count: 25 },
        { status: 'PAID', _count: 100 },
        { status: 'CANCELLED', _count: 5 },
      ]);

      const result = await aggregator.getCommissionStatusCounts();

      expect(result.pending).toBe(10);
      expect(result.approved).toBe(25);
      expect(result.paid).toBe(100);
      expect(result.cancelled).toBe(5);
    });

    it('should handle missing statuses', async () => {
      mockPrisma.commission.groupBy.mockResolvedValue([
        { status: 'APPROVED', _count: 25 },
      ]);

      const result = await aggregator.getCommissionStatusCounts();

      expect(result.pending).toBe(0);
      expect(result.approved).toBe(25);
      expect(result.paid).toBe(0);
      expect(result.cancelled).toBe(0);
    });
  });

  describe('markCommissionsProcessing', () => {
    it('should update commissions', async () => {
      mockPrisma.commission.updateMany.mockResolvedValue({ count: 3 });

      const result = await aggregator.markCommissionsProcessing([
        'comm-1',
        'comm-2',
        'comm-3',
      ]);

      expect(result).toBe(3);
      expect(mockPrisma.commission.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['comm-1', 'comm-2', 'comm-3'] },
          status: 'APPROVED',
          disbursementTransaction: null,
        },
        data: {
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should return 0 for empty array', async () => {
      const result = await aggregator.markCommissionsProcessing([]);

      expect(result).toBe(0);
      expect(mockPrisma.commission.updateMany).not.toHaveBeenCalled();
    });
  });
});
