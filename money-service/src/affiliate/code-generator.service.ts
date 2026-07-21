/**
 * Affiliate Code Generator
 *
 * Ported from lib/affiliate/code-generator.ts (Session 4A-2, File 2/6).
 * Generates unique affiliate codes and handles code distribution to
 * affiliate accounts.
 *
 * @module affiliate/code-generator.service
 */

import crypto from 'crypto';

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { AffiliateConfigService } from './affiliate-config.service';
import {
  CODE_GENERATION,
  type DistributionReason,
} from './affiliate.constants';
import type { AffiliateCode } from './affiliate.types';

@Injectable()
export class CodeGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly affiliateConfig: AffiliateConfigService
  ) {}

  /**
   * Generate a unique 8-character alphanumeric affiliate code
   *
   * Uses cryptographic randomness and checks database for uniqueness.
   * Retries up to MAX_GENERATION_ATTEMPTS times if collision detected.
   *
   * @returns Promise resolving to unique code string
   * @throws Error if unable to generate unique code after max attempts
   */
  async generateUniqueCode(): Promise<string> {
    for (
      let attempt = 0;
      attempt < CODE_GENERATION.MAX_GENERATION_ATTEMPTS;
      attempt++
    ) {
      // Generate random bytes and convert to uppercase alphanumeric
      const bytes = crypto.randomBytes(6);
      const code = bytes
        .toString('hex')
        .toUpperCase()
        .slice(0, CODE_GENERATION.CODE_LENGTH);

      // Check if code already exists in database
      const existing = await this.prisma.affiliateCode.findUnique({
        where: { code },
      });

      if (!existing) {
        return code;
      }
    }

    throw new Error(
      `Failed to generate unique code after ${CODE_GENERATION.MAX_GENERATION_ATTEMPTS} attempts`
    );
  }

  /**
   * Calculate end of current month for code expiry
   *
   * @returns Date set to 23:59:59.999 on last day of current month
   */
  private calculateEndOfMonth(): Date {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);
    return endOfMonth;
  }

  /**
   * Distribute affiliate codes to an affiliate profile
   *
   * Creates specified number of unique codes and assigns them to
   * the affiliate. Updates profile's totalCodesDistributed count.
   *
   * @param affiliateProfileId - ID of affiliate profile to distribute to
   * @param count - Number of codes to distribute
   * @param reason - Reason for distribution (INITIAL, MONTHLY, ADMIN_BONUS)
   * @returns Promise resolving to array of created code records
   */
  async distributeCodes(
    affiliateProfileId: string,
    count: number,
    reason: DistributionReason
  ): Promise<AffiliateCode[]> {
    const expiresAt = this.calculateEndOfMonth();
    const createdCodes: AffiliateCode[] = [];

    // Fetch current config from SystemConfig (dynamic values)
    const config = await this.affiliateConfig.getAffiliateConfigFromDB();

    // Create each code individually to ensure uniqueness
    for (let i = 0; i < count; i++) {
      const code = await this.generateUniqueCode();

      const affiliateCode = await this.prisma.affiliateCode.create({
        data: {
          code,
          affiliateProfileId,
          discountPercent: config.discountPercent,
          commissionPercent: config.commissionPercent,
          status: 'ACTIVE',
          distributedAt: new Date(),
          expiresAt,
          distributionReason: reason,
        },
      });

      createdCodes.push(affiliateCode as unknown as AffiliateCode);
    }

    // Update affiliate profile with total codes distributed
    await this.prisma.affiliateProfile.update({
      where: { id: affiliateProfileId },
      data: { totalCodesDistributed: { increment: count } },
    });

    return createdCodes;
  }
}
