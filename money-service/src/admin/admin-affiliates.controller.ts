/**
 * Admin Affiliates Controller (Session 4A-6, File 2/3; extended Session
 * 4A-9, File 7/10)
 *
 * Maps app/api/admin/affiliates/route.ts (list) and
 * app/api/admin/affiliates/[id]/route.ts (detail) to NestJS. Auth:
 * JwtAuthGuard (401) + AdminGuard (403) replace requireAdmin(); the
 * source's `if (error instanceof AuthError)` branch in each route's catch
 * block is now handled by the guard before the handler body ever runs, so
 * it's dropped here — everything else (validation 400, not-found 404,
 * generic 500) is ported unchanged.
 *
 * `distributeCodes` (4A-9) additionally maps
 * app/api/admin/affiliates/[id]/distribute-codes/route.ts -- see
 * admin-code-distribution.service.ts for its own Deviation note on the
 * idempotency mechanism.
 */

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { z } from 'zod';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';

import { AdminGuard } from './admin.guard';
import { AdminCodeDistributionService } from './admin-code-distribution.service';
import { AdminAffiliateManagementService } from './affiliate-management.service';

const distributeCodesSchema = z.object({
  count: z.number().min(1).max(50),
  reason: z.string().min(1, 'Reason is required'),
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION SCHEMA (list)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const listQuerySchema = z.object({
  status: z
    .enum(['ACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED', 'INACTIVE'])
    .optional(),
  country: z.string().optional(),
  paymentMethod: z
    .enum(['BANK_TRANSFER', 'PAYPAL', 'CRYPTOCURRENCY', 'WISE'])
    .optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(10).max(100).default(20),
});

@Controller('admin/affiliates')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminAffiliatesController {
  constructor(
    private readonly affiliateManagement: AdminAffiliateManagementService,
    private readonly codeDistribution: AdminCodeDistributionService
  ) {}

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /admin/affiliates
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  @Get()
  async list(@Query() query: Record<string, string>) {
    try {
      const validation = listQuerySchema.safeParse(query);
      if (!validation.success) {
        throw new BadRequestException({
          error: 'Invalid query parameters',
          details: validation.error.flatten(),
        });
      }

      const { status, country, paymentMethod, page, limit } = validation.data;

      return await this.affiliateManagement.getAffiliatesList({
        status,
        country,
        paymentMethod,
        page,
        limit,
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Admin affiliates list error:', error);
      throw new InternalServerErrorException({
        error: 'Failed to fetch affiliates',
      });
    }
  }

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /admin/affiliates/:id
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  @Get(':id')
  async detail(@Param('id') id: string) {
    try {
      return await this.affiliateManagement.getAffiliateDetails(id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error instanceof Error && error.message === 'Affiliate not found') {
        throw new NotFoundException({ error: 'Affiliate not found' });
      }
      console.error('Admin affiliate detail error:', error);
      throw new InternalServerErrorException({
        error: 'Failed to fetch affiliate details',
      });
    }
  }

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /admin/affiliates/:id/distribute-codes (Session 4A-9, File 7/10)
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  @Post(':id/distribute-codes')
  @UseInterceptors(IdempotencyInterceptor)
  async distributeCodes(@Param('id') id: string, @Body() body: unknown) {
    try {
      if (!id) {
        throw new BadRequestException({ error: 'Affiliate ID is required' });
      }

      const validation = distributeCodesSchema.safeParse(body);
      if (!validation.success) {
        throw new BadRequestException({
          error: 'Invalid request',
          details: validation.error.flatten(),
        });
      }

      const { count, reason } = validation.data;

      return await this.codeDistribution.distributeCodesAdmin(
        id,
        count,
        reason
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;

      if (error instanceof Error) {
        if (error.message === 'Affiliate not found') {
          throw new NotFoundException({ error: 'Affiliate not found' });
        }

        if (
          error.message.includes('Count must be') ||
          error.message.includes('Can only distribute')
        ) {
          throw new BadRequestException({ error: error.message });
        }
      }

      console.error('Admin distribute codes error:', error);
      throw new InternalServerErrorException({
        error: 'Failed to distribute codes',
      });
    }
  }
}
