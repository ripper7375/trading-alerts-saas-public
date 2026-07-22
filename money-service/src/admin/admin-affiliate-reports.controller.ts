/**
 * Admin Affiliate Reports Controller (Session 4A-6, File 2/3)
 *
 * Maps 5 GET routes from app/api/admin/affiliates/reports/* to NestJS.
 * Auth: JwtAuthGuard (401) + AdminGuard (403) replace requireAdmin() — the
 * source's `if (error instanceof AuthError)` catch branch is now handled
 * by the guard before the handler runs, so it's dropped per-route;
 * everything else (validation 400, generic 500) ported unchanged.
 */

import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import { AffiliateConfigService } from '../affiliate/affiliate-config.service';
import { AFFILIATE_CONFIG } from '../affiliate/affiliate.constants';
import { ReportBuilderService } from '../affiliate/report-builder.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

import { AdminGuard } from './admin.guard';
import { getReportingPeriod } from './pnl-calculator';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION SCHEMAS (one per route, matching source's own local schemas)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const codeFlowsQuerySchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
});

const periodQuerySchema = z.object({
  period: z.enum(['3months', '6months', '1year']).default('3months'),
});

const commissionOwingsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(10).max(100).default(20),
  minBalance: z.coerce.number().min(0).optional(),
});

const salesPerformanceQuerySchema = z.object({
  period: z.enum(['3months', '6months', '1year']).default('3months'),
  limit: z.coerce.number().min(10).max(100).default(20),
});

@Controller('admin/affiliates/reports')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminAffiliateReportsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reportBuilder: ReportBuilderService,
    private readonly affiliateConfigService: AffiliateConfigService
  ) {}

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /admin/affiliates/reports/code-flows
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  @Get('code-flows')
  async codeFlows(@Query() query: Record<string, string>) {
    try {
      const validation = codeFlowsQuerySchema.safeParse(query);
      if (!validation.success) {
        throw new BadRequestException({
          error: 'Invalid query parameters',
          details: validation.error.flatten(),
        });
      }

      const now = new Date();
      const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const start = validation.data.start
        ? new Date(validation.data.start)
        : defaultStart;
      const end = validation.data.end ? new Date(validation.data.end) : now;

      if (start >= end) {
        throw new BadRequestException({ error: 'start must be before end' });
      }

      const report = await this.reportBuilder.buildGlobalCodeInventoryReport({
        start,
        end,
      });

      return { report };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('[Admin] Code flows report error:', error);
      throw new InternalServerErrorException({
        error: 'Failed to build code flows report',
      });
    }
  }

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /admin/affiliates/reports/code-inventory
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  @Get('code-inventory')
  async codeInventory(@Query() query: Record<string, string>) {
    try {
      const validation = periodQuerySchema.safeParse(query);
      if (!validation.success) {
        throw new BadRequestException({ error: 'Invalid query parameters' });
      }

      const { period } = validation.data;
      const { start, end } = getReportingPeriod(period);

      const [
        totalCodes,
        statusCounts,
        reasonCounts,
        periodDistributed,
        periodUsed,
        periodExpired,
        expiringIn7Days,
      ] = await Promise.all([
        this.prisma.affiliateCode.count(),
        this.prisma.affiliateCode.groupBy({
          by: ['status'],
          _count: true,
        }),
        this.prisma.affiliateCode.groupBy({
          by: ['distributionReason'],
          _count: true,
        }),
        this.prisma.affiliateCode.count({
          where: { distributedAt: { gte: start, lte: end } },
        }),
        this.prisma.affiliateCode.count({
          where: { usedAt: { gte: start, lte: end } },
        }),
        this.prisma.affiliateCode.count({
          where: {
            status: 'EXPIRED',
            expiresAt: { gte: start, lte: end },
          },
        }),
        this.prisma.affiliateCode.count({
          where: {
            status: 'ACTIVE',
            expiresAt: {
              gte: new Date(),
              lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),
      ]);

      const getStatusCount = (status: string): number => {
        const found = statusCounts.find((s) => s['status'] === status);
        return (found?.['_count'] as number) ?? 0;
      };

      const getReasonCount = (reason: string): number => {
        const found = reasonCounts.find(
          (r) => r['distributionReason'] === reason
        );
        return (found?.['_count'] as number) ?? 0;
      };

      const activeCodes = getStatusCount('ACTIVE');
      const usedCodes = getStatusCount('USED');
      const expiredCodes = getStatusCount('EXPIRED');
      const cancelledCodes = getStatusCount('CANCELLED');

      const conversionRate =
        totalCodes > 0 ? (usedCodes / totalCodes) * 100 : 0;

      return {
        period: { start, end, name: period },
        allTime: {
          totalCodes,
          byStatus: {
            active: activeCodes,
            used: usedCodes,
            expired: expiredCodes,
            cancelled: cancelledCodes,
          },
          byReason: {
            initial: getReasonCount('INITIAL'),
            monthly: getReasonCount('MONTHLY'),
            adminBonus: getReasonCount('ADMIN_BONUS'),
          },
          conversionRate: Math.round(conversionRate * 10) / 10,
        },
        periodMetrics: {
          distributed: periodDistributed,
          used: periodUsed,
          expired: periodExpired,
          periodConversionRate:
            periodDistributed > 0
              ? Math.round((periodUsed / periodDistributed) * 100 * 10) / 10
              : 0,
        },
        alerts: {
          expiringIn7Days,
          lowActiveCodesWarning: activeCodes < 50,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Admin code inventory report error:', error);
      throw new InternalServerErrorException({
        error: 'Failed to generate code inventory report',
      });
    }
  }

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /admin/affiliates/reports/commission-owings
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  @Get('commission-owings')
  async commissionOwings(@Query() query: Record<string, string>) {
    try {
      const validation = commissionOwingsQuerySchema.safeParse(query);
      if (!validation.success) {
        throw new BadRequestException({ error: 'Invalid query parameters' });
      }

      const { page, limit, minBalance } = validation.data;
      const minimumPayout = minBalance ?? AFFILIATE_CONFIG.MINIMUM_PAYOUT;

      const affiliatesWithPendingRows =
        await this.prisma.affiliateProfile.findMany({
          where: {
            status: 'ACTIVE',
            pendingCommissions: { gte: minimumPayout },
          },
          select: {
            id: true,
            userId: true,
            fullName: true,
            country: true,
            paymentMethod: true,
            paymentDetails: true,
            pendingCommissions: true,
            paidCommissions: true,
            totalEarnings: true,
            commissions: {
              where: { status: 'PENDING' },
              select: { id: true, commissionAmount: true, earnedAt: true },
              orderBy: { earnedAt: 'asc' },
            },
          },
          orderBy: { pendingCommissions: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        });

      const owingsUsers = await this.prisma.user.findMany({
        where: { id: { in: affiliatesWithPendingRows.map((a) => a.userId) } },
        select: { id: true, email: true },
      });
      const owingsUserById = new Map(owingsUsers.map((u) => [u.id, u]));
      const affiliatesWithPending = affiliatesWithPendingRows.map((a) => ({
        ...a,
        user: owingsUserById.get(a.userId),
      }));

      const totalCount = await this.prisma.affiliateProfile.count({
        where: {
          status: 'ACTIVE',
          pendingCommissions: { gte: minimumPayout },
        },
      });

      const affiliatesOwed = affiliatesWithPending.map((affiliate) => {
        const oldestPending =
          affiliate.commissions && affiliate.commissions.length > 0
            ? (affiliate.commissions[0]?.earnedAt ?? null)
            : null;

        return {
          id: affiliate.id,
          fullName: affiliate.fullName,
          email: affiliate.user?.email ?? '',
          country: affiliate.country,
          paymentMethod: affiliate.paymentMethod,
          paymentDetails: affiliate.paymentDetails,
          balance: {
            pending: Number(affiliate.pendingCommissions),
            paid: Number(affiliate.paidCommissions),
            total: Number(affiliate.totalEarnings),
          },
          pendingCount: affiliate.commissions?.length ?? 0,
          oldestPendingDate: oldestPending,
          readyForPayout:
            Number(affiliate.pendingCommissions) >=
            AFFILIATE_CONFIG.MINIMUM_PAYOUT,
        };
      });

      const totalOwed = affiliatesOwed.reduce(
        (sum: number, a) => sum + a.balance.pending,
        0
      );
      const affiliatesReadyCount = affiliatesOwed.filter(
        (a) => a.readyForPayout
      ).length;

      return {
        summary: {
          totalAffiliatesOwed: totalCount,
          affiliatesReadyForPayout: affiliatesReadyCount,
          totalOwed: Math.round(totalOwed * 100) / 100,
          minimumPayoutThreshold: AFFILIATE_CONFIG.MINIMUM_PAYOUT,
        },
        affiliates: affiliatesOwed,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Admin commission owings report error:', error);
      throw new InternalServerErrorException({
        error: 'Failed to generate commission owings report',
      });
    }
  }

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /admin/affiliates/reports/profit-loss
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  @Get('profit-loss')
  async profitLoss(@Query() query: Record<string, string>) {
    try {
      const validation = periodQuerySchema.safeParse(query);
      if (!validation.success) {
        throw new BadRequestException({ error: 'Invalid query parameters' });
      }

      const { period } = validation.data;
      const { start, end } = getReportingPeriod(period);

      const affiliateConfig =
        await this.affiliateConfigService.getAffiliateConfigFromDB();

      const commissions = await this.prisma.commission.findMany({
        where: { earnedAt: { gte: start, lte: end } },
        select: {
          grossRevenue: true,
          discountAmount: true,
          netRevenue: true,
          commissionAmount: true,
          status: true,
        },
      });

      const totalSales = commissions.length;
      const regularPrice = affiliateConfig.basePriceUsd;
      const discountPercent = affiliateConfig.discountPercent;
      const commissionPercent = affiliateConfig.commissionPercent;

      const grossRevenue = commissions.reduce(
        (sum: number, c) => sum + Number(c.grossRevenue),
        0
      );
      const totalDiscounts = commissions.reduce(
        (sum: number, c) => sum + Number(c.discountAmount),
        0
      );
      const netRevenue = commissions.reduce(
        (sum: number, c) => sum + Number(c.netRevenue),
        0
      );

      const paidCommissions = commissions
        .filter((c) => c['status'] === 'PAID')
        .reduce((sum: number, c) => sum + Number(c.commissionAmount), 0);
      const pendingCommissions = commissions
        .filter((c) => c['status'] === 'PENDING')
        .reduce((sum: number, c) => sum + Number(c.commissionAmount), 0);
      const approvedCommissions = commissions
        .filter((c) => c['status'] === 'APPROVED')
        .reduce((sum: number, c) => sum + Number(c.commissionAmount), 0);
      const totalCommissions =
        paidCommissions + pendingCommissions + approvedCommissions;

      const netProfit = netRevenue - totalCommissions;
      const profitMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;
      const averageCommission =
        totalSales > 0 ? totalCommissions / totalSales : 0;

      return {
        period: { start, end, name: period },
        revenue: {
          grossRevenue: Math.round(grossRevenue * 100) / 100,
          discounts: Math.round(totalDiscounts * 100) / 100,
          netRevenue: Math.round(netRevenue * 100) / 100,
          discountPercent,
          averageTicket:
            totalSales > 0
              ? Math.round((netRevenue / totalSales) * 100) / 100
              : 0,
        },
        costs: {
          paidCommissions: Math.round(paidCommissions * 100) / 100,
          pendingCommissions: Math.round(pendingCommissions * 100) / 100,
          approvedCommissions: Math.round(approvedCommissions * 100) / 100,
          totalCommissions: Math.round(totalCommissions * 100) / 100,
          commissionPercent,
          averageCommission: Math.round(averageCommission * 100) / 100,
        },
        profit: {
          netProfit: Math.round(netProfit * 100) / 100,
          margin: Math.round(profitMargin * 10) / 10,
        },
        volume: { totalSales, regularPrice },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Admin P&L report error:', error);
      throw new InternalServerErrorException({
        error: 'Failed to generate P&L report',
      });
    }
  }

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /admin/affiliates/reports/sales-performance
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  @Get('sales-performance')
  async salesPerformance(@Query() query: Record<string, string>) {
    try {
      const validation = salesPerformanceQuerySchema.safeParse(query);
      if (!validation.success) {
        throw new BadRequestException({ error: 'Invalid query parameters' });
      }

      const { period, limit } = validation.data;
      const { start, end } = getReportingPeriod(period);

      const affiliatePerformanceRows =
        await this.prisma.affiliateProfile.findMany({
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            userId: true,
            fullName: true,
            country: true,
            totalCodesDistributed: true,
            totalCodesUsed: true,
            commissions: {
              where: { earnedAt: { gte: start, lte: end } },
              select: { commissionAmount: true, status: true },
            },
          },
          orderBy: { totalCodesUsed: 'desc' },
          take: limit,
        });

      const performanceUsers = await this.prisma.user.findMany({
        where: {
          id: { in: affiliatePerformanceRows.map((a) => a.userId) },
        },
        select: { id: true, email: true },
      });
      const performanceUserById = new Map(
        performanceUsers.map((u) => [u.id, u])
      );
      const affiliatePerformance = affiliatePerformanceRows.map(
        (affiliate) => ({
          ...affiliate,
          user: performanceUserById.get(affiliate.userId),
        })
      );

      const topPerformers = affiliatePerformance.map((affiliate) => {
        const totalCommissions =
          affiliate.commissions?.reduce(
            (sum: number, c) => sum + Number(c.commissionAmount),
            0
          ) ?? 0;
        const conversionCount = affiliate.commissions?.length ?? 0;
        const conversionRate =
          affiliate.totalCodesDistributed > 0
            ? (affiliate.totalCodesUsed / affiliate.totalCodesDistributed) * 100
            : 0;

        return {
          id: affiliate.id,
          fullName: affiliate.fullName,
          email: affiliate.user?.email ?? '',
          country: affiliate.country,
          metrics: {
            codesDistributed: affiliate.totalCodesDistributed,
            codesUsed: affiliate.totalCodesUsed,
            conversionsPeriod: conversionCount,
            totalCommissions: Math.round(totalCommissions * 100) / 100,
            conversionRate: Math.round(conversionRate * 10) / 10,
          },
        };
      });

      topPerformers.sort(
        (a, b) => b.metrics.conversionsPeriod - a.metrics.conversionsPeriod
      );

      const totalConversions = topPerformers.reduce(
        (sum: number, a) => sum + a.metrics.conversionsPeriod,
        0
      );
      const totalCommissionsEarned = topPerformers.reduce(
        (sum: number, a) => sum + a.metrics.totalCommissions,
        0
      );

      return {
        period: { start, end, name: period },
        summary: {
          totalAffiliates: topPerformers.length,
          totalConversions,
          totalCommissionsEarned:
            Math.round(totalCommissionsEarned * 100) / 100,
          averageConversionsPerAffiliate:
            topPerformers.length > 0
              ? Math.round((totalConversions / topPerformers.length) * 10) / 10
              : 0,
        },
        topPerformers,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Admin sales performance report error:', error);
      throw new InternalServerErrorException({
        error: 'Failed to generate sales performance report',
      });
    }
  }
}
