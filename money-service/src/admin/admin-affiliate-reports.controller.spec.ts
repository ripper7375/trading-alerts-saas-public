/**
 * Admin Affiliate Reports Controller Tests (Session 4A-6, File 2/3)
 *
 * New code (no direct SOURCE test file — confirmed zero coverage at
 * CONFIRM). Guards tested independently in admin.guard.spec.ts.
 */
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AffiliateConfigService } from '../affiliate/affiliate-config.service';
import { ReportBuilderService } from '../affiliate/report-builder.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../test-utils/prisma-mock';

import { AdminAffiliateReportsController } from './admin-affiliate-reports.controller';

describe('AdminAffiliateReportsController', () => {
  let controller: AdminAffiliateReportsController;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let reportBuilderMock: Record<string, jest.Mock>;
  let affiliateConfigMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    reportBuilderMock = { buildGlobalCodeInventoryReport: jest.fn() };
    affiliateConfigMock = {
      getAffiliateConfigFromDB: jest.fn().mockResolvedValue({
        discountPercent: 20,
        commissionPercent: 20,
        basePriceUsd: 29,
      }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminAffiliateReportsController],
      providers: [
        { provide: PrismaService, useValue: prismaMock },
        { provide: ReportBuilderService, useValue: reportBuilderMock },
        { provide: AffiliateConfigService, useValue: affiliateConfigMock },
      ],
    }).compile();

    controller = moduleRef.get(AdminAffiliateReportsController);
  });

  describe('codeFlows', () => {
    it('rejects start >= end with a 400', async () => {
      await expect(
        controller.codeFlows({
          start: '2026-07-01T00:00:00.000Z',
          end: '2026-06-01T00:00:00.000Z',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('delegates to the report builder for a valid range', async () => {
      reportBuilderMock.buildGlobalCodeInventoryReport.mockResolvedValue({
        closingBalance: 3,
      });

      const result = await controller.codeFlows({
        start: '2026-06-01T00:00:00.000Z',
        end: '2026-07-01T00:00:00.000Z',
      });

      expect(result).toEqual({ report: { closingBalance: 3 } });
    });
  });

  describe('codeInventory', () => {
    it('reports totals and conversion rate from grouped counts', async () => {
      prismaMock.affiliateCode.count
        .mockResolvedValueOnce(100) // totalCodes
        .mockResolvedValueOnce(10) // periodDistributed
        .mockResolvedValueOnce(5) // periodUsed
        .mockResolvedValueOnce(1) // periodExpired
        .mockResolvedValueOnce(2); // expiringIn7Days
      (prismaMock.affiliateCode.groupBy as jest.Mock)
        .mockResolvedValueOnce([
          { status: 'ACTIVE', _count: 60 },
          { status: 'USED', _count: 40 },
        ])
        .mockResolvedValueOnce([{ distributionReason: 'MONTHLY', _count: 90 }]);

      const result = await controller.codeInventory({});

      expect(result.allTime.totalCodes).toBe(100);
      expect(result.allTime.byStatus).toEqual({
        active: 60,
        used: 40,
        expired: 0,
        cancelled: 0,
      });
      expect(result.allTime.conversionRate).toBe(40);
    });
  });

  describe('commissionOwings', () => {
    it('defaults minimumPayout to AFFILIATE_CONFIG.MINIMUM_PAYOUT', async () => {
      prismaMock.affiliateProfile.findMany.mockResolvedValue([] as never);
      prismaMock.user.findMany.mockResolvedValue([] as never);
      prismaMock.affiliateProfile.count.mockResolvedValue(0);

      const result = await controller.commissionOwings({});

      expect(result.summary.minimumPayoutThreshold).toBe(50.0);
      expect(prismaMock.affiliateProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            pendingCommissions: { gte: 50.0 },
          }),
        })
      );
    });
  });

  describe('profitLoss', () => {
    it('computes margin from dynamic SystemConfig-backed pricing', async () => {
      prismaMock.commission.findMany.mockResolvedValue([
        {
          grossRevenue: 29,
          discountAmount: 5.8,
          netRevenue: 23.2,
          commissionAmount: 4.64,
          status: 'PAID',
        },
      ] as never);

      const result = await controller.profitLoss({});

      expect(affiliateConfigMock.getAffiliateConfigFromDB).toHaveBeenCalled();
      expect(result.revenue.netRevenue).toBeCloseTo(23.2, 2);
      expect(result.costs.paidCommissions).toBeCloseTo(4.64, 2);
      expect(result.profit.margin).toBeCloseTo(80.0, 1);
    });
  });

  describe('salesPerformance', () => {
    it('ranks affiliates by conversions in the period', async () => {
      prismaMock.affiliateProfile.findMany.mockResolvedValue([
        {
          id: 'aff-1',
          userId: 'user-1',
          fullName: 'Top Seller',
          country: 'US',
          totalCodesDistributed: 10,
          totalCodesUsed: 8,
          commissions: [
            { commissionAmount: 4.64, status: 'PAID' },
            { commissionAmount: 4.64, status: 'PENDING' },
          ],
        },
      ] as never);
      prismaMock.user.findMany.mockResolvedValue([
        { id: 'user-1', email: 'top@example.com' },
      ] as never);

      const result = await controller.salesPerformance({});

      expect(result.topPerformers).toHaveLength(1);
      expect(result.topPerformers[0]?.metrics.conversionsPeriod).toBe(2);
      expect(result.summary.totalConversions).toBe(2);
    });
  });
});
