/**
 * Affiliate Payment History Report API (Part 19C)
 *
 * GET /api/disbursement/reports/affiliate/[affiliateId]
 *
 * Returns payment history for a specific affiliate.
 * Admin-only endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

interface RouteParams {
  params: Promise<{ affiliateId: string }>;
}

interface TransactionHistoryItem {
  id: string;
  transactionId: string;
  amount: number;
  status: string;
  provider: string;
  createdAt: Date;
  completedAt: Date | null;
  failedAt: Date | null;
  errorMessage: string | null;
  batch: {
    batchNumber: string;
    status: string;
  };
  commission: {
    id: string;
    commissionAmount: number;
    status: string;
  };
}

interface AffiliateHistorySummary {
  totalTransactions: number;
  totalPaid: number;
  totalFailed: number;
  totalPending: number;
  successRate: number;
}

/**
 * Get affiliate payment history
 */
export async function GET(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { affiliateId } = await context.params;

    // Verify affiliate exists
    const affiliate = await prisma.affiliateProfile.findUnique({
      where: { id: affiliateId },
      select: {
        id: true,
        fullName: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!affiliate) {
      return NextResponse.json(
        { error: 'Affiliate not found' },
        { status: 404 }
      );
    }

    // Get transaction history
    const transactions = await prisma.disbursementTransaction.findMany({
      where: {
        commission: {
          affiliateProfileId: affiliateId,
        },
      },
      include: {
        batch: {
          select: {
            batchNumber: true,
            status: true,
          },
        },
        commission: {
          select: {
            id: true,
            commissionAmount: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Map to response format
    const history: TransactionHistoryItem[] = transactions.map((t) => ({
      id: t.id,
      transactionId: t.transactionId,
      amount: Number(t.amount),
      status: t.status,
      provider: t.provider,
      createdAt: t.createdAt,
      completedAt: t.completedAt,
      failedAt: t.failedAt,
      errorMessage: t.errorMessage,
      batch: {
        batchNumber: t.batch.batchNumber,
        status: t.batch.status,
      },
      commission: {
        id: t.commission.id,
        commissionAmount: Number(t.commission.commissionAmount),
        status: t.commission.status,
      },
    }));

    // Calculate summary
    const completedTxns = transactions.filter((t) => t.status === 'COMPLETED');
    const failedTxns = transactions.filter((t) => t.status === 'FAILED');
    const pendingTxns = transactions.filter((t) => t.status === 'PENDING');

    const totalPaid = completedTxns.reduce(
      (sum, t) => sum + Number(t.amount),
      0
    );
    const totalFailed = failedTxns.reduce(
      (sum, t) => sum + Number(t.amount),
      0
    );
    const totalPending = pendingTxns.reduce(
      (sum, t) => sum + Number(t.amount),
      0
    );

    const summary: AffiliateHistorySummary = {
      totalTransactions: transactions.length,
      totalPaid,
      totalFailed,
      totalPending,
      successRate:
        transactions.length > 0
          ? Math.round((completedTxns.length / transactions.length) * 100 * 10) /
            10
          : 0,
    };

    return NextResponse.json({
      affiliate: {
        id: affiliate.id,
        name: affiliate.fullName,
        email: affiliate.user.email,
      },
      history,
      summary,
    });
  } catch (error) {
    console.error('Error fetching affiliate history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
