/**
 * Transaction Service (Part 19B)
 *
 * Helper service for creating and managing DisbursementTransaction records.
 * Bridges Commission records with disbursement transactions.
 */

import { PrismaClient, DisbursementProvider, DisbursementTransactionStatus } from '@prisma/client';
import { generateTransactionId, usdToRiseUnits } from '../constants';

/**
 * Transaction service for creating disbursement transactions
 */
export class TransactionService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create disbursement transactions for approved commissions
   *
   * @param batchId Batch ID to associate transactions with
   * @param commissionIds Array of commission IDs to create transactions for
   * @param provider Payment provider (MOCK or RISE)
   * @returns Number of transactions created
   */
  async createTransactionsForCommissions(
    batchId: string,
    commissionIds: string[],
    provider: DisbursementProvider
  ): Promise<number> {
    let count = 0;

    for (const commissionId of commissionIds) {
      // Get commission with affiliate info
      const commission = await this.prisma.commission.findUnique({
        where: { id: commissionId },
        include: {
          affiliateProfile: {
            include: {
              riseAccount: true,
            },
          },
        },
      });

      if (!commission) {
        console.error(`Commission ${commissionId} not found`);
        continue;
      }

      // Skip if already has a disbursement transaction
      const existingTxn = await this.prisma.disbursementTransaction.findUnique({
        where: { commissionId },
      });

      if (existingTxn) {
        console.warn(`Commission ${commissionId} already has a transaction`);
        continue;
      }

      // Create transaction
      await this.prisma.disbursementTransaction.create({
        data: {
          batchId,
          commissionId,
          transactionId: generateTransactionId(),
          provider,
          affiliateRiseAccountId: commission.affiliateProfile.riseAccount?.id,
          payeeRiseId: commission.affiliateProfile.riseAccount?.riseId,
          amount: commission.commissionAmount,
          amountRiseUnits:
            provider === 'RISE'
              ? usdToRiseUnits(Number(commission.commissionAmount))
              : null,
          currency: 'USD',
          status: 'PENDING',
        },
      });

      count++;
    }

    return count;
  }

  /**
   * Get transaction by internal ID
   *
   * @param id Internal transaction ID
   * @returns Transaction with related data or null
   */
  async getTransactionById(id: string) {
    return this.prisma.disbursementTransaction.findUnique({
      where: { id },
      include: {
        commission: {
          include: {
            affiliateProfile: {
              select: {
                id: true,
                fullName: true,
                user: { select: { email: true } },
              },
            },
          },
        },
        affiliateRiseAccount: true,
        batch: {
          select: {
            id: true,
            batchNumber: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Get transaction by external transaction ID
   *
   * @param transactionId External transaction ID (TXN-xxx format)
   * @returns Transaction with related data or null
   */
  async getTransactionByExternalId(transactionId: string) {
    return this.prisma.disbursementTransaction.findUnique({
      where: { transactionId },
      include: {
        commission: true,
        affiliateRiseAccount: true,
        batch: true,
      },
    });
  }

  /**
   * Update transaction status
   *
   * @param id Internal transaction ID
   * @param status New status
   * @param options Optional update data
   */
  async updateTransactionStatus(
    id: string,
    status: DisbursementTransactionStatus,
    options?: {
      providerTxId?: string;
      errorMessage?: string;
    }
  ): Promise<void> {
    interface UpdateData {
      status: DisbursementTransactionStatus;
      completedAt?: Date;
      failedAt?: Date;
      errorMessage?: string;
      providerTxId?: string;
    }

    const updateData: UpdateData = { status };

    if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
    } else if (status === 'FAILED') {
      updateData.failedAt = new Date();
      if (options?.errorMessage) {
        updateData.errorMessage = options.errorMessage;
      }
    }

    if (options?.providerTxId) {
      updateData.providerTxId = options.providerTxId;
    }

    await this.prisma.disbursementTransaction.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Mark commission as paid after successful transaction
   *
   * @param commissionId Commission ID
   */
  async markCommissionPaid(commissionId: string): Promise<void> {
    await this.prisma.commission.update({
      where: { id: commissionId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    // Update affiliate profile pending/paid amounts
    const commission = await this.prisma.commission.findUnique({
      where: { id: commissionId },
    });

    if (commission) {
      await this.prisma.affiliateProfile.update({
        where: { id: commission.affiliateProfileId },
        data: {
          pendingCommissions: { decrement: commission.commissionAmount },
          paidCommissions: { increment: commission.commissionAmount },
        },
      });
    }
  }

  /**
   * Get all transactions for a batch
   *
   * @param batchId Batch ID
   * @returns Array of transactions
   */
  async getTransactionsByBatch(batchId: string) {
    return this.prisma.disbursementTransaction.findMany({
      where: { batchId },
      include: {
        commission: {
          select: {
            id: true,
            commissionAmount: true,
            status: true,
          },
        },
        affiliateRiseAccount: {
          select: {
            riseId: true,
            affiliateProfileId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Count transactions by status for a batch
   *
   * @param batchId Batch ID
   * @returns Count by status
   */
  async getTransactionCountsByStatus(batchId: string): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
  }> {
    const counts = await this.prisma.disbursementTransaction.groupBy({
      by: ['status'],
      where: { batchId },
      _count: true,
    });

    const result = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const item of counts) {
      const status = item.status.toLowerCase() as keyof typeof result;
      if (status in result) {
        result[status] = item._count;
      }
    }

    return result;
  }
}
