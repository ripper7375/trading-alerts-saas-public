/**
 * Disbursement Summary Report API (Part 19C)
 *
 * GET /api/disbursement/reports/summary
 *
 * Returns summary statistics for disbursement operations.
 * Admin-only endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

interface SummaryReport {
  batches: {
    total: number;
    completed: number;
    pending: number;
    failed: number;
    successRate: number;
  };
  transactions: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    successRate: number;
  };
  amounts: {
    totalPaid: number;
    totalPending: number;
    totalFailed: number;
  };
  period?: {
    startDate: string;
    endDate: string;
  };
}

/**
 * Get disbursement summary report
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build date filter if provided
    const dateFilter =
      startDate && endDate
        ? {
            createdAt: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          }
        : {};

    // Get batch statistics
    const [totalBatches, completedBatches, pendingBatches, failedBatches] =
      await Promise.all([
        prisma.paymentBatch.count({ where: dateFilter }),
        prisma.paymentBatch.count({
          where: { status: 'COMPLETED', ...dateFilter },
        }),
        prisma.paymentBatch.count({
          where: { status: { in: ['PENDING', 'QUEUED', 'PROCESSING'] }, ...dateFilter },
        }),
        prisma.paymentBatch.count({
          where: { status: 'FAILED', ...dateFilter },
        }),
      ]);

    // Get transaction statistics
    const [
      totalTransactions,
      completedTransactions,
      failedTransactions,
      pendingTransactions,
    ] = await Promise.all([
      prisma.disbursementTransaction.count({ where: dateFilter }),
      prisma.disbursementTransaction.count({
        where: { status: 'COMPLETED', ...dateFilter },
      }),
      prisma.disbursementTransaction.count({
        where: { status: 'FAILED', ...dateFilter },
      }),
      prisma.disbursementTransaction.count({
        where: { status: 'PENDING', ...dateFilter },
      }),
    ]);

    // Get amount statistics
    const [totalPaid, totalPending, totalFailed] = await Promise.all([
      prisma.disbursementTransaction.aggregate({
        where: { status: 'COMPLETED', ...dateFilter },
        _sum: { amount: true },
      }),
      prisma.commission.aggregate({
        where: {
          status: 'APPROVED',
          disbursementTransaction: null,
        },
        _sum: { commissionAmount: true },
      }),
      prisma.disbursementTransaction.aggregate({
        where: { status: 'FAILED', ...dateFilter },
        _sum: { amount: true },
      }),
    ]);

    const summary: SummaryReport = {
      batches: {
        total: totalBatches,
        completed: completedBatches,
        pending: pendingBatches,
        failed: failedBatches,
        successRate:
          totalBatches > 0
            ? Math.round((completedBatches / totalBatches) * 100 * 10) / 10
            : 0,
      },
      transactions: {
        total: totalTransactions,
        completed: completedTransactions,
        failed: failedTransactions,
        pending: pendingTransactions,
        successRate:
          totalTransactions > 0
            ? Math.round(
                (completedTransactions / totalTransactions) * 100 * 10
              ) / 10
            : 0,
      },
      amounts: {
        totalPaid: Number((totalPaid['_sum'] as { amount?: number | null })?.amount || 0),
        totalPending: Number((totalPending['_sum'] as { commissionAmount?: number | null })?.commissionAmount || 0),
        totalFailed: Number((totalFailed['_sum'] as { amount?: number | null })?.amount || 0),
      },
    };

    if (startDate && endDate) {
      summary.period = { startDate, endDate };
    }

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
