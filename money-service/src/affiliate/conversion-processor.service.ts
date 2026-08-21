/**
 * Affiliate Conversion Processor
 *
 * Ported from lib/affiliate/conversion-processor.ts (Session 4A-4, File
 * 2/4). Converted to a real `@Injectable()` with `PrismaService` and
 * `AffiliateConfigService` constructor-injected (was free functions taking
 * the `prisma` singleton import and a bare `getBasePriceUsd` import), same
 * pattern as Session 4A-2's cron/disbursement services. Query/mutation
 * logic byte-identical.
 *
 * Shared, provider-agnostic processing of an affiliate code conversion.
 * Called by BOTH payment webhooks (Stripe and dLocal) when a payment that
 * carried an affiliate/discount code completes. Stripe webhook is Slice 4,
 * out of scope this session — only the dLocal call site is wired up here.
 *
 * Responsibilities:
 * - Mark the affiliate code as USED (idempotent)
 * - Create the Commission record (PENDING)
 * - Update AffiliateProfile usage/earnings counters
 *
 * SYSTEMCONFIG INTEGRATION:
 * - Base price is fetched dynamically via AffiliateConfigService.getBasePriceUsd()
 * - Discount/commission percentages come from the code itself (snapshotted
 *   from SystemConfig at distribution time), keeping payout consistent with
 *   what the customer was actually promised.
 */

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { AffiliateConfigService } from './affiliate-config.service';
import { calculateFullBreakdown } from './commission-calculator';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ConversionInput {
  /** The affiliate code string used at checkout (normalized or raw) */
  code: string;
  /** ID of the paying user */
  userId: string;
  /** ID of the subscription created by the payment (if available) */
  subscriptionId?: string | null;
  /**
   * Gross revenue for the sale in USD, BEFORE discount.
   * When omitted, the dynamic base price from SystemConfig is used.
   */
  grossRevenueUsd?: number;
  /** Payment provider for audit logging ('STRIPE' | 'DLOCAL') */
  provider: string;
}

export interface ConversionResult {
  processed: boolean;
  reason?: string;
  commissionId?: string;
  commissionAmount?: number;
  /** The affiliate's own `User.id` (F50) -- the commission recipient, NOT
   * `input.userId` (the paying subscriber). */
  affiliateUserId?: string;
  /** The affiliate code used for this conversion (F50). */
  code?: string;
  /** The affiliate's running total earnings in USD after this conversion
   * (F50). */
  totalEarnings?: number;
}

@Injectable()
export class ConversionProcessorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly affiliateConfigService: AffiliateConfigService
  ) {}

  /**
   * Process an affiliate code conversion after a completed payment.
   *
   * Idempotent: if the code is already USED (e.g. webhook retry), the call
   * is a no-op and reports why.
   *
   * @param input - Conversion details
   * @returns Result describing what was (or was not) processed
   */
  async processAffiliateConversion(
    input: ConversionInput
  ): Promise<ConversionResult> {
    const normalizedCode = input.code.trim().toUpperCase();

    const affiliateCode = await this.prisma.affiliateCode.findUnique({
      where: { code: normalizedCode },
      include: {
        affiliateProfile: { select: { id: true, status: true, userId: true } },
      },
    });

    if (!affiliateCode) {
      return { processed: false, reason: 'CODE_NOT_FOUND' };
    }

    // Idempotency guard: webhook retries must not double-pay
    if (affiliateCode.status === 'USED') {
      return { processed: false, reason: 'ALREADY_USED' };
    }

    if (affiliateCode.status !== 'ACTIVE') {
      return { processed: false, reason: `CODE_${affiliateCode.status}` };
    }

    if (affiliateCode.affiliateProfile?.status !== 'ACTIVE') {
      return { processed: false, reason: 'AFFILIATE_NOT_ACTIVE' };
    }

    // Gross revenue: actual sale amount when provided, dynamic base otherwise
    const grossRevenue =
      input.grossRevenueUsd && input.grossRevenueUsd > 0
        ? input.grossRevenueUsd
        : await this.affiliateConfigService.getBasePriceUsd();

    const breakdown = calculateFullBreakdown(
      grossRevenue,
      affiliateCode.discountPercent,
      affiliateCode.commissionPercent
    );

    // Atomic: code flip + commission + profile counters succeed or fail together
    const { commission, updatedProfile } = await this.prisma.$transaction(
      async (tx) => {
        await tx.affiliateCode.update({
          where: { id: affiliateCode.id },
          data: {
            status: 'USED',
            usedAt: new Date(),
            usedBy: input.userId,
            subscriptionId: input.subscriptionId ?? null,
          },
        });

        const commission = await tx.commission.create({
          data: {
            affiliateProfileId: affiliateCode.affiliateProfileId,
            affiliateCodeId: affiliateCode.id,
            userId: input.userId,
            subscriptionId: input.subscriptionId ?? null,
            grossRevenue: breakdown.grossRevenue,
            discountAmount: breakdown.discountAmount,
            netRevenue: breakdown.netRevenue,
            commissionAmount: breakdown.commissionAmount,
            status: 'PENDING',
            earnedAt: new Date(),
          },
        });

        const updatedProfile = await tx.affiliateProfile.update({
          where: { id: affiliateCode.affiliateProfileId },
          data: {
            totalCodesUsed: { increment: 1 },
            totalEarnings: { increment: breakdown.commissionAmount },
            pendingCommissions: { increment: breakdown.commissionAmount },
          },
        });

        return { commission, updatedProfile };
      }
    );

    return {
      processed: true,
      commissionId: commission.id,
      commissionAmount: breakdown.commissionAmount,
      affiliateUserId: affiliateCode.affiliateProfile.userId,
      code: affiliateCode.code,
      totalEarnings: Number(updatedProfile.totalEarnings),
    };
  }
}
