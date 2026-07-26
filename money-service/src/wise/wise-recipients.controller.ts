/**
 * Wise Recipients Controller (Session 4A-W3a, File 8/10)
 *
 * Implements `/wise/recipients*` from `part19.5-wise-disbursement-openapi.yaml`
 * (frozen at 4A-W1 — "law" per the migration plan §6). Route prefix here is
 * `wise/recipients`; `main.ts`'s global `/v1` prefix makes the real paths
 * `/v1/wise/recipients*`.
 *
 * Guards per **F39 = Affiliate self-service** (resolved this session,
 * `DECISION-LOG.md`): `JwtAuthGuard` (controller-level, every route) +
 * `AffiliateGuard` on every affiliate-facing route; `AdminGuard` only on
 * the admin list (`GET /wise/recipients`). `:id`-scoped routes additionally
 * verify the id belongs to the caller's own `AffiliateProfile` —
 * `AffiliateGuard` alone only proves "is an affiliate", not "owns this
 * recipient".
 *
 * Deviations from the order's own File 8/10 prose, discovered against the
 * frozen OpenAPI contract while building this controller (recorded in
 * full in the order's Deviations section at session close):
 *  - `GET requirements` uses the discouraged non-quote-scoped Wise endpoint
 *    (`GET /v1/account-requirements?source=USD&target=...`) rather than
 *    creating a throwaway Wise quote first. Quote creation
 *    (`POST /v3/profiles/{id}/quotes`) is not in this order's 10-file
 *    breakdown; building it here would be undeclared scope expansion.
 *    `WISE_SOURCE_CURRENCY` is hardcoded to `'USD'` — this is the
 *    platform's own fixed source-currency decision (4A-W1), not a bank
 *    field, so Hard Invariant #1 is unaffected.
 *  - `POST /wise/recipients`'s "replacing an existing recipient archives
 *    the previous row rather than mutating it" (OpenAPI description) is
 *    NOT implemented — `AffiliateWiseRecipient.affiliateProfileId` is
 *    `@unique` in the schema frozen at 4A-W2 (out of scope to change this
 *    session), so this controller upserts in place instead. Flagged for
 *    Davin/Advisor: the schema and the OpenAPI contract disagree.
 *  - `DELETE /wise/recipients/{id}` (deactivate) was present in the
 *    OpenAPI spec but missing from the order's own File 8/10 endpoint
 *    prose — implemented anyway since the frozen contract requires it.
 */

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';

import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../admin/admin.guard';
import { AffiliateGuard } from '../affiliate/affiliate.guard';
import { PrismaService } from '../prisma/prisma.service';

import { WiseApiError } from './wise-api.client';
import { WiseConfig } from './wise.config';
import { WiseRecipientService } from './wise-recipient.service';

// The platform's fixed source-currency decision (4A-W1) — not a bank
// field, so Hard Invariant #1 ("never hard-code bank fields") is
// unaffected. Every Wise route in this system pays out FROM this
// currency.
const WISE_SOURCE_CURRENCY = 'USD';

const requirementsQuerySchema = z.object({
  targetCurrency: z.string().length(3),
  recipientCountry: z.string().length(2).optional(),
  legalType: z.enum(['PRIVATE', 'BUSINESS']).default('PRIVATE'),
  addressRequired: z.coerce.boolean().default(false),
});

const refreshRequirementsBodySchema = z.object({
  quoteId: z.string().min(1),
  partial: z.record(z.unknown()),
});

const createRecipientBodySchema = z.object({
  // Admin-mode only, per the OpenAPI description. F39 resolved to
  // self-service — always ignored, affiliateProfileId is taken from the
  // authenticated token instead.
  affiliateProfileId: z.string().optional(),
  targetCurrency: z.string().length(3),
  recipientCountry: z.string().length(2),
  legalType: z.enum(['PRIVATE', 'BUSINESS']),
  accountHolderName: z.string().min(1).max(255),
  requirementsType: z.string().min(1),
  details: z.record(z.unknown()),
});

const adminListQuerySchema = z.object({
  status: z
    .enum(['DRAFT', 'PENDING_DETAILS', 'ACTIVE', 'INVALID', 'ARCHIVED'])
    .optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(25),
});

@Controller('wise/recipients')
@UseGuards(JwtAuthGuard)
export class WiseRecipientsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wiseRecipientService: WiseRecipientService,
    private readonly wiseConfig: WiseConfig
  ) {}

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /wise/recipients/requirements
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  @Get('requirements')
  @UseGuards(AffiliateGuard)
  async getRequirements(@Query() query: Record<string, string>) {
    const validation = requirementsQuerySchema.safeParse(query);
    if (!validation.success) {
      throw new BadRequestException({
        error: 'Invalid query parameters',
        details: validation.error.flatten(),
      });
    }

    try {
      const groups = await this.wiseRecipientService.getAccountRequirements(
        undefined,
        WISE_SOURCE_CURRENCY,
        validation.data.targetCurrency
      );
      return { quoteId: null, groups };
    } catch (error) {
      throw this.mapProviderError(error);
    }
  }

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /wise/recipients/requirements/refresh
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  @Post('requirements/refresh')
  @UseGuards(AffiliateGuard)
  async refreshRequirements(@Body() body: unknown) {
    const validation = refreshRequirementsBodySchema.safeParse(body);
    if (!validation.success) {
      throw new BadRequestException({
        error: 'Invalid request body',
        details: validation.error.flatten(),
      });
    }

    try {
      const groups =
        await this.wiseRecipientService.refreshRequirementsOnChange(
          validation.data.quoteId,
          validation.data.partial
        );
      return { groups };
    } catch (error) {
      throw this.mapProviderError(error);
    }
  }

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /wise/recipients (admin list)
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  @Get()
  @UseGuards(AdminGuard)
  async list(@Query() query: Record<string, string>) {
    const validation = adminListQuerySchema.safeParse(query);
    if (!validation.success) {
      throw new BadRequestException({
        error: 'Invalid query parameters',
        details: validation.error.flatten(),
      });
    }

    const { status, page, pageSize } = validation.data;
    const where = status ? { status } : {};

    const [items, total] = await Promise.all([
      this.prisma.affiliateWiseRecipient.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.affiliateWiseRecipient.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /wise/recipients
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  @Post()
  @UseGuards(AffiliateGuard)
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const validation = createRecipientBodySchema.safeParse(body);
    if (!validation.success) {
      throw new BadRequestException({
        error: 'Validation failed',
        message: 'Invalid recipient details',
        fieldErrors: validation.error.flatten().fieldErrors,
      });
    }

    const profile = await this.getAffiliateProfile(request.user.id);
    const data = validation.data;

    try {
      return await this.wiseRecipientService.createRecipient(
        profile.id,
        {
          currency: data.targetCurrency,
          type: data.requirementsType,
          profile: Number(this.wiseConfig.profileId),
          accountHolderName: data.accountHolderName,
          details: data.details,
        },
        {
          recipientCountry: data.recipientCountry,
          legalType: data.legalType,
        }
      );
    } catch (error) {
      throw this.mapProviderError(error);
    }
  }

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /wise/recipients/me
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  @Get('me')
  @UseGuards(AffiliateGuard)
  async getMine(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response
  ) {
    const profile = await this.getAffiliateProfile(request.user.id);
    const recipient =
      await this.wiseRecipientService.getRecipientByAffiliateProfileId(
        profile.id
      );

    if (!recipient) {
      response.status(204);
      return;
    }
    return recipient;
  }

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /wise/recipients/:id/revalidate
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  @Post(':id/revalidate')
  @UseGuards(AffiliateGuard)
  async revalidate(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string
  ) {
    const profile = await this.getAffiliateProfile(request.user.id);
    await this.assertOwnsRecipient(id, profile.id);

    try {
      const recipient = await this.wiseRecipientService.revalidateRecipient(
        profile.id
      );
      if (!recipient) this.recipientNotFound();
      return recipient;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw this.mapProviderError(error);
    }
  }

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DELETE /wise/recipients/:id
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  @Delete(':id')
  @UseGuards(AffiliateGuard)
  @HttpCode(204)
  async deactivate(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string
  ): Promise<void> {
    const profile = await this.getAffiliateProfile(request.user.id);
    await this.assertOwnsRecipient(id, profile.id);

    try {
      await this.wiseRecipientService.deactivateRecipient(profile.id);
    } catch (error) {
      throw this.mapProviderError(error);
    }
  }

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Helpers
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  private async getAffiliateProfile(userId: string) {
    const profile = await this.prisma.affiliateProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException({
        error: 'Profile not found',
        message: 'Affiliate profile not found',
      });
    }
    return profile;
  }

  private recipientNotFound(): never {
    throw new NotFoundException({ error: 'Recipient not found' });
  }

  /**
   * AffiliateGuard only proves "is an affiliate" — a `:id` path param is
   * caller-supplied, so ownership must be checked explicitly before any
   * `:id`-scoped route acts on it.
   */
  private async assertOwnsRecipient(
    recipientId: string,
    affiliateProfileId: string
  ): Promise<void> {
    const recipient = await this.prisma.affiliateWiseRecipient.findUnique({
      where: { id: recipientId },
    });
    if (!recipient || recipient.affiliateProfileId !== affiliateProfileId) {
      this.recipientNotFound();
    }
  }

  private mapProviderError(error: unknown): HttpException {
    if (error instanceof HttpException) return error;
    if (error instanceof WiseApiError) {
      return new InternalServerErrorException({
        error: 'Wise provider error',
        message: 'Wise returned an error or was unreachable',
        providerStatus: error.status,
        correlationId: error.correlationId,
      });
    }
    console.error('[Wise Recipients] Unexpected error:', error);
    return new InternalServerErrorException({
      error: 'Unexpected error',
      message: 'An unexpected error occurred',
    });
  }
}
