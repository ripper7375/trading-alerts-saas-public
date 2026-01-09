/**
 * Affiliate Code Generator
 *
 * Generates unique affiliate codes and handles code distribution
 * to affiliate accounts.
 *
 * SYSTEMCONFIG INTEGRATION:
 * - Discount and commission percentages are fetched from SystemConfig
 * - Admin can change these values without code deployment
 *
 * @module lib/affiliate/code-generator
 */

import crypto from 'crypto';

import { prisma } from '@/lib/db/prisma';

import {
  CODE_GENERATION,
  getAffiliateConfigFromDB,
  type DistributionReason,
} from './constants';
import type { AffiliateCode } from './types';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CODE GENERATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate a unique 8-character alphanumeric affiliate code
 *
 * Uses cryptographic randomness and checks database for uniqueness.
 * Retries up to MAX_GENERATION_ATTEMPTS times if collision detected.
 *
 * @returns Promise resolving to unique code string
 * @throws Error if unable to generate unique code after max attempts
 *
 * @example
 * ```typescript
 * const code = await generateUniqueCode();
 * // code = "ABC12345"
 * ```
 */
export async function generateUniqueCode(): Promise<string> {
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
    const existing = await prisma.affiliateCode.findUnique({
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

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CODE DISTRIBUTION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Calculate end of current month for code expiry
 *
 * @returns Date set to 23:59:59.999 on last day of current month
 */
function calculateEndOfMonth(): Date {
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
 *
 * @example
 * ```typescript
 * // Distribute initial 15 codes to new affiliate
 * const codes = await distributeCodes('aff-123', 15, 'INITIAL');
 * ```
 */
export async function distributeCodes(
  affiliateProfileId: string,
  count: number,
  reason: DistributionReason
): Promise<AffiliateCode[]> {
  const expiresAt = calculateEndOfMonth();
  const createdCodes: AffiliateCode[] = [];

  // Fetch current config from SystemConfig (dynamic values)
  const config = await getAffiliateConfigFromDB();

  // Create each code individually to ensure uniqueness
  for (let i = 0; i < count; i++) {
    const code = await generateUniqueCode();

    const affiliateCode = await prisma.affiliateCode.create({
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

    createdCodes.push(affiliateCode);
  }

  // Update affiliate profile with total codes distributed
  await prisma.affiliateProfile.update({
    where: { id: affiliateProfileId },
    data: { totalCodesDistributed: { increment: count } },
  });

  return createdCodes;
}
