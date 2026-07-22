/**
 * Affiliate Dashboard Controller Tests (Session 4A-6, File 2/3)
 *
 * New code (no direct SOURCE test file — confirmed zero coverage for
 * these 4 routes at CONFIRM). Guards (JwtAuthGuard, AffiliateGuard) are
 * tested independently in their own spec files; this suite calls
 * controller methods directly, mirroring Session 4A-2's
 * cron-trigger.controller.spec.ts pattern.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../test-utils/prisma-mock';

import { AffiliateDashboardController } from './affiliate-dashboard.controller';
import { ReportBuilderService } from './report-builder.service';

function requestFor(userId: string): AuthenticatedRequest {
  return {
    user: {
      id: userId,
      email: 'a@example.com',
      tier: 'PRO',
      role: 'USER',
      isAffiliate: true,
    },
  } as AuthenticatedRequest;
}

describe('AffiliateDashboardController', () => {
  let controller: AffiliateDashboardController;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let reportBuilderMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    reportBuilderMock = {
      buildDashboardStats: jest.fn(),
      buildCodeInventoryReport: jest.fn(),
      buildCommissionSummary: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AffiliateDashboardController],
      providers: [
        { provide: PrismaService, useValue: prismaMock },
        { provide: ReportBuilderService, useValue: reportBuilderMock },
      ],
    }).compile();

    controller = moduleRef.get(AffiliateDashboardController);
  });

  describe('getStats', () => {
    it('returns 404 PROFILE_NOT_FOUND when the affiliate profile is missing', async () => {
      prismaMock.affiliateProfile.findUnique.mockResolvedValue(null);

      await expect(controller.getStats(requestFor('user-1'))).rejects.toThrow(
        NotFoundException
      );
    });

    it('returns the report-builder stats for an existing profile', async () => {
      prismaMock.affiliateProfile.findUnique.mockResolvedValue({
        id: 'aff-1',
      } as never);
      reportBuilderMock.buildDashboardStats.mockResolvedValue({
        activeCodes: 1,
      });

      const result = await controller.getStats(requestFor('user-1'));

      expect(result).toEqual({ activeCodes: 1 });
      expect(reportBuilderMock.buildDashboardStats).toHaveBeenCalledWith(
        'aff-1'
      );
    });
  });

  describe('getCodes', () => {
    it('returns 400 VALIDATION_ERROR for an invalid status value', async () => {
      prismaMock.affiliateProfile.findUnique.mockResolvedValue({
        id: 'aff-1',
      } as never);

      await expect(
        controller.getCodes(requestFor('user-1'), { status: 'NOT_A_STATUS' })
      ).rejects.toThrow(BadRequestException);
    });

    it('paginates codes scoped to the caller profile', async () => {
      prismaMock.affiliateProfile.findUnique.mockResolvedValue({
        id: 'aff-1',
      } as never);
      prismaMock.affiliateCode.findMany.mockResolvedValue([] as never);
      prismaMock.affiliateCode.count.mockResolvedValue(0);

      const result = await controller.getCodes(requestFor('user-1'), {
        page: '2',
        limit: '10',
      });

      expect(result).toEqual({ codes: [], total: 0, page: 2, limit: 10 });
      expect(prismaMock.affiliateCode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { affiliateProfileId: 'aff-1' },
          skip: 10,
          take: 10,
        })
      );
    });
  });

  describe('getCodeInventory', () => {
    it('returns 400 INVALID_DATES for an unparseable startDate', async () => {
      prismaMock.affiliateProfile.findUnique.mockResolvedValue({
        id: 'aff-1',
      } as never);

      await expect(
        controller.getCodeInventory(requestFor('user-1'), {
          startDate: 'not-a-date',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('defaults to a 30-day window when no dates are given', async () => {
      prismaMock.affiliateProfile.findUnique.mockResolvedValue({
        id: 'aff-1',
      } as never);
      reportBuilderMock.buildCodeInventoryReport.mockResolvedValue({
        closingBalance: 5,
      });

      const result = await controller.getCodeInventory(
        requestFor('user-1'),
        {}
      );

      expect(result).toEqual({ closingBalance: 5 });
      const [, period] =
        reportBuilderMock.buildCodeInventoryReport.mock.calls[0];
      const spanMs = period.end.getTime() - period.start.getTime();
      expect(spanMs).toBe(30 * 24 * 60 * 60 * 1000);
    });
  });

  describe('getCommissionReport', () => {
    it('returns summary + paginated commissions + pagination metadata', async () => {
      prismaMock.affiliateProfile.findUnique.mockResolvedValue({
        id: 'aff-1',
      } as never);
      prismaMock.commission.findMany.mockResolvedValue([] as never);
      prismaMock.commission.count.mockResolvedValue(0);
      reportBuilderMock.buildCommissionSummary.mockResolvedValue({
        totalEarned: 0,
      });

      const result = await controller.getCommissionReport(
        requestFor('user-1'),
        {}
      );

      expect(result).toEqual({
        summary: { totalEarned: 0 },
        commissions: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });
  });
});
