/**
 * Admin Affiliate Management Service (Session 4A-6, File 2/3)
 *
 * Ported from lib/admin/affiliate-management.ts. Converted to a real
 * `@Injectable()` with `PrismaService` constructor-injected (was free
 * functions taking the `prisma` singleton import), same pattern as
 * Session 4A-4's ConversionProcessorService. Query logic byte-identical,
 * including the manual user-relation batch-join (AffiliateProfile has no
 * `user` FK relation post Session 2-3's FK audit — same note the source
 * carries).
 *
 * @module admin/affiliate-management.service
 */

import { Injectable } from '@nestjs/common';

import type { AffiliateStatus } from '../affiliate/affiliate.constants';
import { PrismaService } from '../prisma/prisma.service';

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
    paidAt?: Date | null;
    /** davintrade-vat-stack follow-up: set only on a clawback deduction row. */
    clawbackOfCommissionId?: string | null;
  }>;
}

@Injectable()
export class AdminAffiliateManagementService {
  constructor(private readonly prisma: PrismaService) {}

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LIST AFFILIATES
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Get paginated list of affiliates with optional filters
   *
   * @param filters - Filtering and pagination options
   * @returns Paginated affiliate list
   */
  async getAffiliatesList(
    filters: AffiliateListFilters
  ): Promise<AffiliateListResult> {
    const { status, country, paymentMethod, page, limit } = filters;

    // Build where clause
    const where: Record<string, unknown> = {};
    if (status) where['status'] = status;
    if (country) where['country'] = country;
    if (paymentMethod) where['paymentMethod'] = paymentMethod;

    // Execute queries in parallel
    const [affiliateRows, total] = await Promise.all([
      this.prisma.affiliateProfile.findMany({
        where,
        include: {
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
      this.prisma.affiliateProfile.count({ where }),
    ]);

    // AffiliateProfile no longer carries a `user` relation (Session 2-3 FK
    // audit) — batch-fetch contact users separately by userId.
    const affiliateManagementUsers = await this.prisma.user.findMany({
      where: { id: { in: affiliateRows.map((a) => a.userId) } },
      select: { id: true, email: true, name: true },
    });
    const affiliateManagementUserById = new Map(
      affiliateManagementUsers.map((u) => [u.id, u])
    );
    const affiliates = affiliateRows.map((a) => ({
      ...a,
      user: affiliateManagementUserById.get(a.userId),
    }));

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
  async getAffiliateDetails(affiliateId: string): Promise<AffiliateDetails> {
    const affiliateRow = await this.prisma.affiliateProfile.findUnique({
      where: { id: affiliateId },
      include: {
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
            clawbackOfCommissionId: true,
          },
        },
      },
    });

    if (!affiliateRow) {
      throw new Error('Affiliate not found');
    }

    // AffiliateProfile no longer carries a `user` relation (Session 2-3 FK
    // audit) — look the contact up separately by userId.
    const affiliateUser = await this.prisma.user.findUnique({
      where: { id: affiliateRow.userId },
      select: { email: true, name: true },
    });
    const affiliate = { ...affiliateRow, user: affiliateUser };

    return affiliate as unknown as AffiliateDetails;
  }
}
