/**
 * Admin Analytics Controller (Session 4A-6, File 2/3)
 *
 * Maps app/api/admin/analytics/route.ts to NestJS. This route is the one
 * outlier among the 8 ported admin/affiliate routes (confirmed at
 * CONFIRM): its source never calls requireAdmin()/lib/auth/session.ts at
 * all — it does its own inline `getServerSession(authOptions)` +
 * `session.user.role !== 'ADMIN'` check, with its own distinct response
 * bodies (`{ error: 'Unauthorized' }` / `{ error: 'Forbidden: Admin
 * access required' }`) rather than session.ts's AuthError shape. Ported
 * as its own inline check against JwtAuthGuard's request.user (NOT the
 * shared AdminGuard, whose body is the OTHER 7 routes' shape) to preserve
 * that distinction — JwtAuthGuard still supplies the 401 (no valid
 * session token) path.
 */

import {
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  InternalServerErrorException,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PRO_MONTHLY_PRICE = 29;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AnalyticsResponse {
  overview: {
    totalUsers: number;
    freeUsers: number;
    proUsers: number;
    freePercentage: number;
    proPercentage: number;
  };
  revenue: {
    mrr: number;
    arr: number;
    conversionRate: number;
    pricePerUser: number;
  };
  growth: {
    newUsersThisMonth: number;
    churnedThisMonth: number;
  };
}

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard)
export class AdminAnalyticsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getAnalytics(
    @Req() request: AuthenticatedRequest
  ): Promise<AnalyticsResponse> {
    if (request.user.role !== 'ADMIN') {
      throw new ForbiddenException({
        error: 'Forbidden: Admin access required',
      });
    }

    try {
      const [totalUsers, freeUsers, proUsers] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { tier: 'FREE' } }),
        this.prisma.user.count({ where: { tier: 'PRO' } }),
      ]);

      const freePercentage =
        totalUsers > 0 ? (freeUsers / totalUsers) * 100 : 0;
      const proPercentage = totalUsers > 0 ? (proUsers / totalUsers) * 100 : 0;

      const mrr = proUsers * PRO_MONTHLY_PRICE;
      const arr = mrr * 12;

      const conversionRate = totalUsers > 0 ? (proUsers / totalUsers) * 100 : 0;

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const newUsersThisMonth = await this.prisma.user.count({
        where: { createdAt: { gte: startOfMonth } },
      });

      // Churn calculation would require subscription history tracking.
      // For now, return 0 as placeholder (matches source).
      const churnedThisMonth = 0;

      return {
        overview: {
          totalUsers,
          freeUsers,
          proUsers,
          freePercentage: Math.round(freePercentage * 100) / 100,
          proPercentage: Math.round(proPercentage * 100) / 100,
        },
        revenue: {
          mrr,
          arr,
          conversionRate: Math.round(conversionRate * 100) / 100,
          pricePerUser: PRO_MONTHLY_PRICE,
        },
        growth: {
          newUsersThisMonth,
          churnedThisMonth,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Admin analytics error:', error);
      throw new InternalServerErrorException({
        error: 'Failed to fetch analytics',
      });
    }
  }
}
