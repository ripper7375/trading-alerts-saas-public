/**
 * Commission Aggregator Service (Part 19A)
 *
 * Aggregates pending approved commissions by affiliate for disbursement.
 * Groups commissions and calculates totals for batch payment processing.
 */

import { PrismaClient } from '@prisma/client';
import type { CommissionAggregate, PayableAffiliate, RiseWorksKycStatus } from '@/types/disbursement';
import { MINIMUM_PAYOUT_USD } from '../constants';

/**
 * Commission aggregator for disbursement processing
 */
export class CommissionAggregator {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Get aggregate commission data for a specific affiliate
   *
   * @param affiliateId The affiliate profile ID
   * @returns Aggregated commission data
   */
  async getAggregatesByAffiliate(
    affiliateId: string
  ): Promise<CommissionAggregate> {
    const commissions = await this.prisma.commission.findMany({
      where: {
        affiliateProfileId: affiliateId,
        status: 'APPROVED',
        // Only include commissions not already linked to a disbursement
        disbursementTransaction: null,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const totalAmount = commissions.reduce(
      (sum, comm) => sum + Number(comm.commissionAmount),
      0
    );

    const canPayout = totalAmount >= MINIMUM_PAYOUT_USD;

    return {
      affiliateId,
      commissionIds: commissions.map((c) => c.id),
      totalAmount,
      commissionCount: commissions.length,
      oldestDate: commissions[0]?.createdAt ?? new Date(),
      canPayout,
      reason: !canPayout
        ? `Below minimum payout of $${MINIMUM_PAYOUT_USD}`
        : undefined,
    };
  }

  /**
   * Get all affiliates with payable commissions (meeting minimum threshold)
   *
   * @returns Array of commission aggregates for payable affiliates
   */
  async getAllPayableAffiliates(): Promise<CommissionAggregate[]> {
    // Get all approved commissions not yet disbursed
    const commissions = await this.prisma.commission.findMany({
      where: {
        status: 'APPROVED',
        disbursementTransaction: null,
      },
      include: {
        affiliateProfile: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group by affiliate
    const groupedByAffiliate = new Map<string, typeof commissions>();

    for (const comm of commissions) {
      const affiliateId = comm.affiliateProfileId;
      const existing = groupedByAffiliate.get(affiliateId) ?? [];
      existing.push(comm);
      groupedByAffiliate.set(affiliateId, existing);
    }

    // Build aggregates for affiliates meeting minimum threshold
    const aggregates: CommissionAggregate[] = [];

    for (const [affiliateId, comms] of groupedByAffiliate) {
      const totalAmount = comms.reduce(
        (sum, c) => sum + Number(c.commissionAmount),
        0
      );

      if (totalAmount >= MINIMUM_PAYOUT_USD) {
        aggregates.push({
          affiliateId,
          commissionIds: comms.map((c) => c.id),
          totalAmount,
          commissionCount: comms.length,
          oldestDate: comms[0]?.createdAt ?? new Date(),
          canPayout: true,
        });
      }
    }

    // Sort by total amount descending
    return aggregates.sort((a, b) => b.totalAmount - a.totalAmount);
  }

  /**
   * Get detailed payable affiliate information including RiseWorks account status
   *
   * @returns Array of payable affiliates with full details
   */
  async getPayableAffiliatesWithDetails(): Promise<PayableAffiliate[]> {
    const affiliatesWithCommissions = await this.prisma.affiliateProfile.findMany({
      where: {
        status: 'ACTIVE',
        commissions: {
          some: {
            status: 'APPROVED',
            disbursementTransaction: null,
          },
        },
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
        commissions: {
          where: {
            status: 'APPROVED',
            disbursementTransaction: null,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        riseAccount: true,
      },
    });

    return affiliatesWithCommissions
      .map((affiliate) => {
        const commissions = affiliate.commissions ?? [];
        const pendingAmount = commissions.reduce(
          (sum: number, c) => sum + Number(c.commissionAmount),
          0
        );

        const oldestPendingDate =
          commissions.length > 0
            ? commissions[0]?.createdAt ?? null
            : null;

        const hasRiseAccount = !!affiliate.riseAccount;
        const kycApproved =
          hasRiseAccount && affiliate.riseAccount?.kycStatus === 'APPROVED';
        const canReceivePayments = hasRiseAccount && kycApproved;
        const meetsMinimum = pendingAmount >= MINIMUM_PAYOUT_USD;

        return {
          id: affiliate.id,
          fullName: affiliate.fullName,
          email: affiliate.user?.email ?? '',
          country: affiliate.country,
          pendingAmount,
          paidAmount: Number(affiliate.paidCommissions),
          pendingCommissionCount: commissions.length,
          oldestPendingDate,
          readyForPayout: meetsMinimum && canReceivePayments,
          riseAccount: {
            hasAccount: hasRiseAccount,
            riseId: affiliate.riseAccount?.riseId,
            kycStatus: hasRiseAccount
              ? (affiliate.riseAccount?.kycStatus as RiseWorksKycStatus) ?? 'PENDING'
              : 'none' as const,
            canReceivePayments,
          },
        };
      })
      .filter((a) => a.pendingAmount >= MINIMUM_PAYOUT_USD);
  }

  /**
   * Get total pending commissions across all affiliates
   *
   * @returns Total pending amount in USD
   */
  async getTotalPendingAmount(): Promise<number> {
    const result = await this.prisma.commission.aggregate({
      where: {
        status: 'APPROVED',
        disbursementTransaction: null,
      },
      _sum: {
        commissionAmount: true,
      },
    });

    return Number((result['_sum'] as { commissionAmount?: number } | undefined)?.commissionAmount ?? 0);
  }

  /**
   * Get count of commissions by status
   *
   * @returns Object with counts by status
   */
  async getCommissionStatusCounts(): Promise<{
    pending: number;
    approved: number;
    paid: number;
    cancelled: number;
  }> {
    const counts = await this.prisma.commission.groupBy({
      by: ['status'],
      _count: true,
    });

    const result = {
      pending: 0,
      approved: 0,
      paid: 0,
      cancelled: 0,
    };

    for (const item of counts) {
      const status = (item['status'] as string).toLowerCase() as keyof typeof result;
      if (status in result) {
        result[status] = item['_count'] as number;
      }
    }

    return result;
  }

  /**
   * Mark commissions as being processed (transitional state before payment)
   *
   * @param commissionIds Array of commission IDs to mark
   * @returns Number of updated commissions
   */
  async markCommissionsProcessing(commissionIds: string[]): Promise<number> {
    if (commissionIds.length === 0) {
      return 0;
    }

    // This is a placeholder - in production, you might want to
    // add a PROCESSING status or use a different mechanism
    // to prevent double-processing
    const result = await this.prisma.commission.updateMany({
      where: {
        id: { in: commissionIds },
        status: 'APPROVED',
        disbursementTransaction: null,
      },
      data: {
        // We could add a processingAt timestamp here
        updatedAt: new Date(),
      },
    });

    return result.count;
  }
}
