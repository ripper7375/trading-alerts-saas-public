/**
 * Admin Code Distribution Service (Session 4A-9, File 7/10)
 *
 * Ports lib/admin/code-distribution.ts's `distributeCodesAdmin` only --
 * `suspendAffiliate`/`reactivateAffiliate` are separate admin actions
 * outside this order's Slice 4 write-API scope (only code distribution is
 * named in the order's File 7/10).
 *
 * Deviation: the SOURCE guards duplicate submits with its own internal
 * Redis lock (`acquireIdempotencyLock`, keyed on a hash of
 * affiliateId/count/reason, 30s TTL) and a `DuplicateDistributionError`.
 * Per the order's own explicit File 7/10 spec, this is replaced by the
 * standard `IdempotencyInterceptor` (client-supplied `Idempotency-Key`
 * header, 24h TTL) attached at the controller route -- not reimplemented
 * here. This is a real behavior difference: the SOURCE's lock fires on
 * ANY duplicate admin action within 30s regardless of client headers; the
 * interceptor only dedupes when the admin UI actually sends a matching
 * Idempotency-Key. Reuses `CodeGeneratorService.distributeCodes` (built
 * 4A-2) unchanged.
 */

import { Injectable } from '@nestjs/common';

import { CodeGeneratorService } from '../affiliate/code-generator.service';
import { PrismaService } from '../prisma/prisma.service';

export interface DistributeCodesResult {
  success: true;
  message: string;
  codesDistributed: number;
}

@Injectable()
export class AdminCodeDistributionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGenerator: CodeGeneratorService
  ) {}

  /**
   * Distribute bonus codes to an affiliate (admin action).
   *
   * @throws Error 'Count must be between 1 and 50' | 'Affiliate not found'
   *   | 'Can only distribute codes to active affiliates'
   */
  async distributeCodesAdmin(
    affiliateId: string,
    count: number,
    _reason: string
  ): Promise<DistributeCodesResult> {
    if (count < 1 || count > 50) {
      throw new Error('Count must be between 1 and 50');
    }

    const affiliate = await this.prisma.affiliateProfile.findUnique({
      where: { id: affiliateId },
    });

    if (!affiliate) {
      throw new Error('Affiliate not found');
    }

    if (affiliate.status !== 'ACTIVE') {
      throw new Error('Can only distribute codes to active affiliates');
    }

    await this.codeGenerator.distributeCodes(affiliateId, count, 'ADMIN_BONUS');

    return {
      success: true,
      message: `Successfully distributed ${count} codes to affiliate`,
      codesDistributed: count,
    };
  }
}
