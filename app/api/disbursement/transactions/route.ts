/**
 * Disbursement Transactions List API (Part 19C)
 *
 * GET /api/disbursement/transactions
 *
 * Returns paginated list of disbursement transactions.
 * Supports filtering by status and provider.
 * Admin-only endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import type { DisbursementTransactionStatus } from '@prisma/client';

interface TransactionListItem {
  id: string;
  transactionId: string;
  providerTxId: string | null;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  retryCount: number;
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
  failedAt: Date | null;
  batch: {
    id: string;
    batchNumber: string;
    status: string;
  };
  commission: {
    id: string;
    commissionAmount: number;
    affiliateProfileId: string;
  };
}

/**
 * Get disbursement transactions list
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as DisbursementTransactionStatus | null;
    const provider = searchParams.get('provider');
    const batchId = searchParams.get('batchId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build filter conditions
    const where: {
      status?: DisbursementTransactionStatus;
      provider?: 'MOCK' | 'RISE';
      batchId?: string;
    } = {};

    if (status) {
      where.status = status;
    }
    if (provider === 'MOCK' || provider === 'RISE') {
      where.provider = provider;
    }
    if (batchId) {
      where.batchId = batchId;
    }

    // Get transactions with pagination
    const [transactions, total] = await Promise.all([
      prisma.disbursementTransaction.findMany({
        where,
        include: {
          batch: {
            select: {
              id: true,
              batchNumber: true,
              status: true,
            },
          },
          commission: {
            select: {
              id: true,
              commissionAmount: true,
              affiliateProfileId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200), // Cap at 200 for safety
        skip: offset,
      }),
      prisma.disbursementTransaction.count({ where }),
    ]);

    // Map to response format
    const transactionList: TransactionListItem[] = transactions.map((t) => ({
      id: t.id,
      transactionId: t.transactionId,
      providerTxId: t.providerTxId,
      amount: Number(t.amount),
      currency: t.currency,
      status: t.status,
      provider: t.provider,
      retryCount: t.retryCount,
      errorMessage: t.errorMessage,
      createdAt: t.createdAt,
      completedAt: t.completedAt,
      failedAt: t.failedAt,
      batch: {
        id: t.batch?.id || '',
        batchNumber: t.batch?.batchNumber || '',
        status: t.batch?.status || '',
      },
      commission: {
        id: t.commission?.id || '',
        commissionAmount: Number(t.commission?.commissionAmount || 0),
        affiliateProfileId: t.commission?.affiliateProfileId || '',
      },
    }));

    // Get status counts for filters
    const statusCounts = await prisma.disbursementTransaction.groupBy({
      by: ['status'],
      _count: true,
    });

    const counts: Record<string, number> = {};
    for (const item of statusCounts) {
      counts[item['status'] as string] = (item['_count'] as number) || 0;
    }

    return NextResponse.json({
      transactions: transactionList,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      statusCounts: counts,
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
