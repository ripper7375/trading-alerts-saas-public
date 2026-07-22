/**
 * Report Builder Service Tests (Session 4A-6, File 2/3)
 *
 * NEW backfill coverage — report-builder.ts (the source this service was
 * ported from) had no dedicated test file anywhere in the monolith
 * (confirmed at CONFIRM via repo-wide search excluding the out-of-scope
 * frontend/ mirror). Same zero-coverage-backfill precedent as Session 4A-4.
 */
import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../test-utils/prisma-mock';

import { ReportBuilderService } from './report-builder.service';

describe('ReportBuilderService', () => {
  let service: ReportBuilderService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportBuilderService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = moduleRef.get(ReportBuilderService);
  });

  describe('buildDashboardStats', () => {
    it('computes conversion rate and balances from profile + code counts', async () => {
      prismaMock.affiliateCode.count
        .mockResolvedValueOnce(5) // active
        .mockResolvedValueOnce(3) // used
        .mockResolvedValueOnce(1); // expired
      prismaMock.affiliateProfile.findUnique.mockResolvedValue({
        totalEarnings: 100,
        pendingCommissions: 40,
        paidCommissions: 60,
        totalCodesDistributed: 10,
        totalCodesUsed: 3,
      } as never);

      const result = await service.buildDashboardStats('aff-1');

      expect(result).toEqual({
        activeCodes: 5,
        usedCodes: 3,
        expiredCodes: 1,
        totalEarnings: 100,
        pendingBalance: 40,
        paidBalance: 60,
        conversionRate: 30,
      });
    });

    it('defaults every profile-derived field to 0 when the profile is missing', async () => {
      prismaMock.affiliateCode.count.mockResolvedValue(0);
      prismaMock.affiliateProfile.findUnique.mockResolvedValue(null);

      const result = await service.buildDashboardStats('aff-missing');

      expect(result.totalEarnings).toBe(0);
      expect(result.pendingBalance).toBe(0);
      expect(result.paidBalance).toBe(0);
      expect(result.conversionRate).toBe(0);
    });
  });

  describe('buildCodeInventoryReport', () => {
    it('reconciles opening + additions - reductions into a closing balance', async () => {
      prismaMock.affiliateCode.count
        .mockResolvedValueOnce(10) // opening
        .mockResolvedValueOnce(2) // used
        .mockResolvedValueOnce(1) // expired
        .mockResolvedValueOnce(0); // cancelled
      (prismaMock.affiliateCode.groupBy as jest.Mock).mockResolvedValue([
        { distributionReason: 'MONTHLY', _count: { _all: 4 } },
        { distributionReason: 'INITIAL', _count: { _all: 1 } },
      ]);

      const period = {
        start: new Date('2026-06-01'),
        end: new Date('2026-07-01'),
      };
      const result = await service.buildCodeInventoryReport('aff-1', period);

      expect(result.additions).toEqual({
        monthlyDistribution: 4,
        initialDistribution: 1,
        bonusDistribution: 0,
        total: 5,
      });
      expect(result.reductions).toEqual({
        used: 2,
        expired: 1,
        cancelled: 0,
        total: 3,
      });
      // 10 + 5 - 3
      expect(result.closingBalance).toBe(12);
    });
  });

  describe('buildGlobalCodeInventoryReport', () => {
    it('reports affiliatesWithActivity as the distinct-group count, on top of the same reconciliation', async () => {
      // Call order in buildGlobalCodeInventoryReport: opening count first,
      // then (used, expired, cancelled) counts inside the later
      // Promise.all — mockResolvedValueOnce queues must follow that exact
      // order, not the order the fields are described in.
      prismaMock.affiliateCode.count
        .mockResolvedValueOnce(7) // opening
        .mockResolvedValueOnce(0) // used
        .mockResolvedValueOnce(0) // expired
        .mockResolvedValueOnce(0); // cancelled
      // groupBy is called twice: once for additionsByReason, once for
      // activeAffiliateGroups.
      (prismaMock.affiliateCode.groupBy as jest.Mock)
        .mockResolvedValueOnce([
          { distributionReason: 'ADMIN_BONUS', _count: { _all: 2 } },
        ])
        .mockResolvedValueOnce([
          { affiliateProfileId: 'aff-1' },
          { affiliateProfileId: 'aff-2' },
        ]);

      const period = {
        start: new Date('2026-06-01'),
        end: new Date('2026-07-01'),
      };
      const result = await service.buildGlobalCodeInventoryReport(period);

      expect(result.additions.bonusDistribution).toBe(2);
      expect(result.affiliatesWithActivity).toBe(2);
    });
  });

  describe('buildCommissionSummary', () => {
    it('sums commission amounts by status plus this/last month aggregates', async () => {
      (prismaMock.commission.groupBy as jest.Mock).mockResolvedValue([
        { status: 'PENDING', _sum: { commissionAmount: 10 } },
        { status: 'APPROVED', _sum: { commissionAmount: 5 } },
        { status: 'PAID', _sum: { commissionAmount: 20 } },
        { status: 'CANCELLED', _sum: { commissionAmount: 1 } },
      ]);
      prismaMock.commission.aggregate
        .mockResolvedValueOnce({ _sum: { commissionAmount: 8 } } as never) // thisMonth
        .mockResolvedValueOnce({ _sum: { commissionAmount: 12 } } as never); // lastMonth

      const result = await service.buildCommissionSummary('aff-1');

      expect(result).toEqual({
        totalEarned: 35, // 10 + 5 + 20
        pending: 10,
        approved: 5,
        paid: 20,
        cancelled: 1,
        thisMonth: 8,
        lastMonth: 12,
      });
    });

    it('defaults every amount to 0 when no commissions exist', async () => {
      (prismaMock.commission.groupBy as jest.Mock).mockResolvedValue([]);
      prismaMock.commission.aggregate.mockResolvedValue({
        _sum: { commissionAmount: null },
      } as never);

      const result = await service.buildCommissionSummary('aff-empty');

      expect(result).toEqual({
        totalEarned: 0,
        pending: 0,
        approved: 0,
        paid: 0,
        cancelled: 0,
        thisMonth: 0,
        lastMonth: 0,
      });
    });
  });
});
