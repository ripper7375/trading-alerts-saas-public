/**
 * Affiliate Cron Service
 *
 * Ported from lib/cron/monthly-distribution.ts (Session 4A-2, File 2/6).
 * Core logic for distributing affiliate codes on a monthly basis. Query
 * logic is byte-identical to source; the module-level `defaultDistributeCodes`
 * import became an injected CodeGeneratorService, preserving the same
 * optional-override-via-options shape the ported test suite exercises.
 *
 * @module crons/affiliate.service
 */

import { Injectable } from '@nestjs/common';

import {
  AFFILIATE_CONFIG,
  type DistributionReason,
} from '../affiliate/affiliate.constants';
import { CodeGeneratorService } from '../affiliate/code-generator.service';
import { PrismaService } from '../prisma/prisma.service';

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

@Injectable()
export class AffiliateCronService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGenerator: CodeGeneratorService
  ) {}

  /**
   * Run monthly code distribution for all active affiliates
   *
   * Fetches all affiliates with ACTIVE status and distributes the
   * configured number of codes to each one. Handles errors gracefully and
   * continues processing even if individual distributions fail.
   *
   * @param options - Optional configuration for testing
   * @returns Promise resolving to distribution result
   */
  async runMonthlyDistribution(
    options: MonthlyDistributionOptions = {}
  ): Promise<MonthlyDistributionResult> {
    const {
      distributeCodes = (
        affiliateProfileId: string,
        count: number,
        reason: DistributionReason
      ) =>
        this.codeGenerator.distributeCodes(affiliateProfileId, count, reason),
    } = options;

    const result: MonthlyDistributionResult = {
      distributed: 0,
      totalAffiliates: 0,
      errors: [],
      emailsSent: 0,
    };

    try {
      // Fetch all active affiliates with their user details
      const affiliates = await this.prisma.affiliateProfile.findMany({
        where: { status: 'ACTIVE' },
      });

      // AffiliateProfile no longer carries a `user` relation (Session 2-3 FK
      // audit) — batch-fetch contact users separately by userId.
      const affiliateUsers = await this.prisma.user.findMany({
        where: { id: { in: affiliates.map((a) => a.userId) } },
      });
      const affiliateUserById = new Map(affiliateUsers.map((u) => [u.id, u]));

      result.totalAffiliates = affiliates.length;

      if (affiliates.length === 0) {
        console.log('[CRON] No active affiliates found for distribution');
        return result;
      }

      console.log(
        `[CRON] Starting distribution for ${affiliates.length} affiliates`
      );

      // Process each affiliate
      for (const affiliate of affiliates) {
        const affiliateUser = affiliateUserById.get(affiliate.userId);
        try {
          if (!affiliateUser) {
            result.errors.push(`Affiliate ${affiliate.id}: Missing user`);
            continue;
          }

          await distributeCodes(
            affiliate.id,
            AFFILIATE_CONFIG.CODES_PER_MONTH,
            'MONTHLY'
          );

          result.distributed++;
          console.log(
            `[CRON] Distributed ${AFFILIATE_CONFIG.CODES_PER_MONTH} codes to ${affiliateUser.email}`
          );

          // TODO: Send notification email
          // For now, we'll count successful distributions as emails sent
          result.emailsSent++;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          const errorEntry = affiliateUser
            ? `${affiliateUser.email}: ${errorMessage}`
            : `Affiliate ${affiliate.id}: ${errorMessage}`;
          result.errors.push(errorEntry);
          console.error(
            `[CRON] Failed to distribute to ${affiliateUser?.email || affiliate.id}:`,
            error
          );
        }
      }

      console.log(
        `[CRON] Distribution complete: ${result.distributed}/${result.totalAffiliates} successful, ${result.errors.length} errors`
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Top-level: ${errorMessage}`);
      console.error('[CRON] Monthly distribution failed:', error);
      return result;
    }
  }
}
