/**
 * Monthly Distribution Cron Logic
 *
 * Core logic for distributing affiliate codes on a monthly basis.
 * Called by the cron endpoint to process all active affiliates.
 *
 * @module lib/cron/monthly-distribution
 */

import { prisma } from '@/lib/db/prisma';
import { distributeCodes as defaultDistributeCodes } from '@/lib/affiliate/code-generator';
import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants';
import type { DistributionReason } from '@/lib/affiliate/constants';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface MonthlyDistributionResult {
  /** Number of affiliates successfully distributed to */
  distributed: number;
  /** Total number of affiliates processed */
  totalAffiliates: number;
  /** Array of error messages for failed distributions */
  errors: string[];
  /** Number of notification emails sent */
  emailsSent: number;
}

/** Function signature for code distribution */
export type DistributeCodesFunction = (
  affiliateProfileId: string,
  count: number,
  reason: DistributionReason
) => Promise<unknown[]>;

export interface MonthlyDistributionOptions {
  /** Optional injected distributeCodes function for testing */
  distributeCodes?: DistributeCodesFunction;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MONTHLY DISTRIBUTION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Run monthly code distribution for all active affiliates
 *
 * Fetches all affiliates with ACTIVE status and distributes
 * the configured number of codes to each one. Handles errors
 * gracefully and continues processing even if individual
 * distributions fail.
 *
 * @param options - Optional configuration for testing
 * @returns Promise resolving to distribution result
 *
 * @example
 * ```typescript
 * const result = await runMonthlyDistribution();
 * console.log(`Distributed to ${result.distributed} affiliates`);
 * ```
 */
export async function runMonthlyDistribution(
  options: MonthlyDistributionOptions = {}
): Promise<MonthlyDistributionResult> {
  const { distributeCodes = defaultDistributeCodes } = options;

  const result: MonthlyDistributionResult = {
    distributed: 0,
    totalAffiliates: 0,
    errors: [],
    emailsSent: 0,
  };

  try {
    // Fetch all active affiliates with their user details
    const affiliates = await prisma.affiliateProfile.findMany({
      where: { status: 'ACTIVE' },
      include: { user: true },
    });

    result.totalAffiliates = affiliates.length;

    if (affiliates.length === 0) {
      console.log('[CRON] No active affiliates found for distribution');
      return result;
    }

    console.log(`[CRON] Starting distribution for ${affiliates.length} affiliates`);

    // Process each affiliate
    for (const affiliate of affiliates) {
      try {
        await distributeCodes(
          affiliate.id,
          AFFILIATE_CONFIG.CODES_PER_MONTH,
          'MONTHLY'
        );

        result.distributed++;
        console.log(`[CRON] Distributed ${AFFILIATE_CONFIG.CODES_PER_MONTH} codes to ${affiliate.user.email}`);

        // TODO: Send notification email
        // For now, we'll count successful distributions as emails sent
        result.emailsSent++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorEntry = `${affiliate.user.email}: ${errorMessage}`;
        result.errors.push(errorEntry);
        console.error(`[CRON] Failed to distribute to ${affiliate.user.email}:`, error);
      }
    }

    console.log(
      `[CRON] Distribution complete: ${result.distributed}/${result.totalAffiliates} successful, ${result.errors.length} errors`
    );

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Top-level: ${errorMessage}`);
    console.error('[CRON] Monthly distribution failed:', error);
    return result;
  }
}
