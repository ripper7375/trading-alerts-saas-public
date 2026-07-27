/**
 * Admin Code Distribution
 *
 * Library functions for admin-level code distribution,
 * affiliate suspension, and reactivation.
 *
 * @module lib/admin/code-distribution
 */

import { createHash } from 'crypto';

import { prisma } from '@/lib/db/prisma';
import { distributeCodes } from '@/lib/affiliate/code-generator';
import type { AffiliateStatus } from '@/lib/affiliate/constants';
import { acquireIdempotencyLock } from '@/lib/idempotency/idempotency-guard';

/** 30s: absorbs a double-click/client retry without blocking a deliberate follow-up distribution. */
const DISTRIBUTE_CODES_IDEMPOTENCY_TTL_SECONDS = 30;

/** Thrown when a duplicate distribution request is collapsed by the idempotency guard (4A-8, CC-C). */
export class DuplicateDistributionError extends Error {
  constructor() {
    super(
      'Duplicate distribution request -- an identical request for this affiliate is already being processed. Please wait a moment before retrying.'
    );
    this.name = 'DuplicateDistributionError';
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface DistributeResult {
  success: boolean;
  message: string;
  codesDistributed?: number;
}

interface AffiliateProfile {
  id: string;
  status: AffiliateStatus;
  suspensionReason?: string | null;
  suspendedAt?: Date | null;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DISTRIBUTE CODES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Distribute bonus codes to an affiliate (admin action)
 *
 * @param affiliateId - Affiliate profile ID
 * @param count - Number of codes to distribute (1-50)
 * @param reason - Reason for distribution
 * @returns Distribution result
 * @throws Error if validation fails or affiliate not eligible
 */
export async function distributeCodesAdmin(
  affiliateId: string,
  count: number,
  _reason: string
): Promise<DistributeResult> {
  // Validate count
  if (count < 1 || count > 50) {
    throw new Error('Count must be between 1 and 50');
  }

  // Get affiliate
  const affiliate = await prisma.affiliateProfile.findUnique({
    where: { id: affiliateId },
  });

  if (!affiliate) {
    throw new Error('Affiliate not found');
  }

  // Only active affiliates can receive codes
  if (affiliate.status !== 'ACTIVE') {
    throw new Error('Can only distribute codes to active affiliates');
  }

  // Idempotency guard (4A-8, CC-C audit fix): collapse a double-click or
  // client retry into a single distribution instead of issuing `count`
  // codes twice for the same admin action.
  const requestKey = createHash('sha256')
    .update(`admin-distribute:${affiliateId}:${count}:${_reason}`)
    .digest('hex');
  const acquiredLock = await acquireIdempotencyLock(
    `idempotency:${requestKey}`,
    DISTRIBUTE_CODES_IDEMPOTENCY_TTL_SECONDS
  );
  if (!acquiredLock) {
    throw new DuplicateDistributionError();
  }

  // Use Part 17A function - NO DUPLICATION
  await distributeCodes(affiliateId, count, 'ADMIN_BONUS');

  return {
    success: true,
    message: `Successfully distributed ${count} codes to affiliate`,
    codesDistributed: count,
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUSPEND AFFILIATE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Suspend an affiliate account
 *
 * @param affiliateId - Affiliate profile ID
 * @param reason - Reason for suspension
 * @returns Updated affiliate profile
 * @throws Error if affiliate not found or already suspended
 */
export async function suspendAffiliate(
  affiliateId: string,
  reason: string
): Promise<AffiliateProfile> {
  // Validate reason
  if (!reason || reason.trim() === '') {
    throw new Error('Suspension reason is required');
  }

  // Get affiliate
  const affiliate = await prisma.affiliateProfile.findUnique({
    where: { id: affiliateId },
  });

  if (!affiliate) {
    throw new Error('Affiliate not found');
  }

  if (affiliate.status === 'SUSPENDED') {
    throw new Error('Affiliate is already suspended');
  }

  // Update affiliate status
  const updated = await prisma.affiliateProfile.update({
    where: { id: affiliateId },
    data: {
      status: 'SUSPENDED',
      suspensionReason: reason,
      suspendedAt: new Date(),
    },
  });

  return updated as AffiliateProfile;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REACTIVATE AFFILIATE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Reactivate a suspended affiliate account
 *
 * @param affiliateId - Affiliate profile ID
 * @returns Updated affiliate profile
 * @throws Error if affiliate not found or not suspended
 */
export async function reactivateAffiliate(
  affiliateId: string
): Promise<AffiliateProfile> {
  // Get affiliate
  const affiliate = await prisma.affiliateProfile.findUnique({
    where: { id: affiliateId },
  });

  if (!affiliate) {
    throw new Error('Affiliate not found');
  }

  if (affiliate.status !== 'SUSPENDED') {
    throw new Error('Affiliate is not suspended');
  }

  // Update affiliate status
  const updated = await prisma.affiliateProfile.update({
    where: { id: affiliateId },
    data: {
      status: 'ACTIVE',
      suspensionReason: null,
      suspendedAt: null,
    },
  });

  return updated as AffiliateProfile;
}
