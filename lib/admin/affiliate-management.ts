/**
 * Admin Affiliate Management
 *
 * Library functions for admin-level affiliate operations including
 * listing, filtering, and detail retrieval.
 *
 * @module lib/admin/affiliate-management
 */

import { prisma } from '@/lib/db/prisma';
import type { AffiliateStatus } from '@/lib/affiliate/constants';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface AffiliateListFilters {
  status?: AffiliateStatus;
  country?: string;
  paymentMethod?: string;
  page: number;
  limit: number;
}

export interface AffiliateListResult {
  affiliates: AffiliateWithUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AffiliateWithUser {
  id: string;
  userId: string;
  fullName: string;
  country: string;
  paymentMethod: string;
  status: string;
  totalCodesDistributed: number;
  totalCodesUsed: number;
  totalEarnings: number | { toNumber: () => number };
  pendingCommissions: number | { toNumber: () => number };
  paidCommissions: number | { toNumber: () => number };
  createdAt: Date;
  user?: {
    email: string;
    name?: string | null;
  };
  affiliateCodes?: Array<{
    id: string;
    code: string;
    status: string;
  }>;
}

export interface AffiliateDetails extends AffiliateWithUser {
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  twitterUrl?: string | null;
  youtubeUrl?: string | null;
  tiktokUrl?: string | null;
  paymentDetails: Record<string, unknown>;
  verifiedAt?: Date | null;
  suspendedAt?: Date | null;
  suspensionReason?: string | null;
  commissions?: Array<{
    id: string;
    commissionAmount: number | { toNumber: () => number };
    status: string;
    earnedAt: Date;
  }>;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LIST AFFILIATES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get paginated list of affiliates with optional filters
 *
 * @param filters - Filtering and pagination options
 * @returns Paginated affiliate list
 */
export async function getAffiliatesList(
  filters: AffiliateListFilters
): Promise<AffiliateListResult> {
  const { status, country, paymentMethod, page, limit } = filters;

  // Build where clause
  const where: Record<string, unknown> = {};
  if (status) where['status'] = status;
  if (country) where['country'] = country;
  if (paymentMethod) where['paymentMethod'] = paymentMethod;

  // Execute queries in parallel
  const [affiliates, total] = await Promise.all([
    prisma.affiliateProfile.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
        affiliateCodes: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            code: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.affiliateProfile.count({ where }),
  ]);

  return {
    affiliates: affiliates as AffiliateWithUser[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET AFFILIATE DETAILS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get detailed affiliate information by ID
 *
 * @param affiliateId - Affiliate profile ID
 * @returns Affiliate details with user, codes, and commissions
 * @throws Error if affiliate not found
 */
export async function getAffiliateDetails(
  affiliateId: string
): Promise<AffiliateDetails> {
  const affiliate = await prisma.affiliateProfile.findUnique({
    where: { id: affiliateId },
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
      affiliateCodes: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          code: true,
          status: true,
          discountPercent: true,
          commissionPercent: true,
          distributedAt: true,
          expiresAt: true,
          usedAt: true,
          distributionReason: true,
        },
      },
      commissions: {
        orderBy: { earnedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          commissionAmount: true,
          status: true,
          earnedAt: true,
          paidAt: true,
        },
      },
    },
  });

  if (!affiliate) {
    throw new Error('Affiliate not found');
  }

  return affiliate as unknown as AffiliateDetails;
}
