/**
 * Affiliate Dashboard Controller (Session 4A-6, File 2/3)
 *
 * Maps 4 GET routes from app/api/affiliate/dashboard/* to NestJS. Route
 * paths keep the source's own segment names 1:1 (main.ts's global `/v1`
 * prefix, F16, replaces the source's `/api` prefix — same convention as
 * Session 4A-4's webhook controllers). Response shapes match the source
 * routes exactly for the success/validation/not-found paths.
 *
 * Auth: JwtAuthGuard (401 if no valid session token) + AffiliateGuard
 * (403 if not an affiliate) replace requireAffiliate(). getAffiliateProfile()
 * is inlined as a single Prisma lookup keyed on the already-verified
 * request.user.id — no need to re-check isAffiliate, AffiliateGuard did
 * that already.
 *
 * Unique base path, no live traffic until Session 4A-7 (this order's own
 * Safety Gate).
 */

import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

import {
  codesListQuerySchema,
  commissionReportQuerySchema,
} from './affiliate-read.validators';
import { AffiliateGuard } from './affiliate.guard';
import { ReportBuilderService } from './report-builder.service';

@Controller('affiliate/dashboard')
@UseGuards(JwtAuthGuard, AffiliateGuard)
export class AffiliateDashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reportBuilder: ReportBuilderService
  ) {}

  private async getProfile(userId: string) {
    return this.prisma.affiliateProfile.findUnique({ where: { userId } });
  }

  private profileNotFound(): never {
    throw new NotFoundException({
      error: 'Profile not found',
      message: 'Affiliate profile not found',
      code: 'PROFILE_NOT_FOUND',
    });
  }

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /affiliate/dashboard/stats
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  @Get('stats')
  async getStats(@Req() request: AuthenticatedRequest) {
    try {
      const profile = await this.getProfile(request.user.id);
      if (!profile) this.profileNotFound();

      return await this.reportBuilder.buildDashboardStats(profile.id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('[Affiliate Stats] Error:', error);
      throw new InternalServerErrorException({
        error: 'Failed to fetch stats',
        message: 'Unable to retrieve dashboard statistics',
        code: 'STATS_ERROR',
      });
    }
  }

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /affiliate/dashboard/codes
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  @Get('codes')
  async getCodes(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, string>
  ) {
    try {
      const profile = await this.getProfile(request.user.id);
      if (!profile) this.profileNotFound();

      const validation = codesListQuerySchema.safeParse(query);
      if (!validation.success) {
        throw new BadRequestException({
          error: 'Validation failed',
          message: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: validation.error.errors,
        });
      }

      const { page, limit, status } = validation.data;
      const where = {
        affiliateProfileId: profile.id,
        ...(status && { status }),
      };

      const [codes, total] = await Promise.all([
        this.prisma.affiliateCode.findMany({
          where,
          orderBy: { distributedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.affiliateCode.count({ where }),
      ]);

      return { codes, total, page, limit };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('[Affiliate Codes] Error:', error);
      throw new InternalServerErrorException({
        error: 'Failed to fetch codes',
        message: 'Unable to retrieve affiliate codes',
        code: 'CODES_ERROR',
      });
    }
  }

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /affiliate/dashboard/code-inventory
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  @Get('code-inventory')
  async getCodeInventory(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, string>
  ) {
    try {
      const profile = await this.getProfile(request.user.id);
      if (!profile) this.profileNotFound();

      const endDateParam = query['endDate'];
      const startDateParam = query['startDate'];

      const endDate = endDateParam ? new Date(endDateParam) : new Date();
      const startDate = startDateParam
        ? new Date(startDateParam)
        : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new BadRequestException({
          error: 'Invalid dates',
          message: 'Invalid start or end date format',
          code: 'INVALID_DATES',
        });
      }

      return await this.reportBuilder.buildCodeInventoryReport(profile.id, {
        start: startDate,
        end: endDate,
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('[Code Inventory] Error:', error);
      throw new InternalServerErrorException({
        error: 'Failed to generate report',
        message: 'Unable to generate code inventory report',
        code: 'REPORT_ERROR',
      });
    }
  }

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /affiliate/dashboard/commission-report
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  @Get('commission-report')
  async getCommissionReport(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, string>
  ) {
    try {
      const profile = await this.getProfile(request.user.id);
      if (!profile) this.profileNotFound();

      const validation = commissionReportQuerySchema.safeParse(query);
      if (!validation.success) {
        throw new BadRequestException({
          error: 'Validation failed',
          message: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: validation.error.errors,
        });
      }

      const { page, limit, status, startDate, endDate } = validation.data;
      const where = {
        affiliateProfileId: profile.id,
        ...(status && { status }),
        ...((startDate || endDate) && {
          earnedAt: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          },
        }),
      };

      const [commissions, total, summary] = await Promise.all([
        this.prisma.commission.findMany({
          where,
          include: {
            affiliateCode: {
              select: {
                code: true,
                usedAt: true,
              },
            },
          },
          orderBy: { earnedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.commission.count({ where }),
        this.reportBuilder.buildCommissionSummary(profile.id),
      ]);

      return {
        summary,
        commissions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('[Commission Report] Error:', error);
      throw new InternalServerErrorException({
        error: 'Failed to generate report',
        message: 'Unable to generate commission report',
        code: 'REPORT_ERROR',
      });
    }
  }
}
