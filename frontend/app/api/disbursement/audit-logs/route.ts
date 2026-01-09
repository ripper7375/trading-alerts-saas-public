/**
 * Disbursement Audit Logs API (Part 19C)
 *
 * GET /api/disbursement/audit-logs
 *
 * Returns audit trail logs for disbursement operations.
 * Supports filtering by action, transaction, and batch.
 * Admin-only endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

interface AuditLogItem {
  id: string;
  action: string;
  status: string;
  actor: string | null;
  details: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  transaction: {
    transactionId: string;
    amount: number;
    status: string;
  } | null;
  batch: {
    batchNumber: string;
    status: string;
  } | null;
}

/**
 * Get disbursement audit logs
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const transactionId = searchParams.get('transactionId');
    const batchId = searchParams.get('batchId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build filter conditions
    const where: {
      action?: string;
      transactionId?: string;
      batchId?: string;
    } = {};

    if (action) {
      where.action = action;
    }
    if (transactionId) {
      where.transactionId = transactionId;
    }
    if (batchId) {
      where.batchId = batchId;
    }

    // Get logs with pagination
    const [logs, total] = await Promise.all([
      prisma.disbursementAuditLog.findMany({
        where,
        include: {
          transaction: {
            select: {
              transactionId: true,
              amount: true,
              status: true,
            },
          },
          batch: {
            select: {
              batchNumber: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 500), // Cap at 500 for safety
        skip: offset,
      }),
      prisma.disbursementAuditLog.count({ where }),
    ]);

    // Map to response format
    const auditLogs: AuditLogItem[] = logs.map((log) => ({
      id: log.id,
      action: log.action,
      status: log.status,
      actor: log.actor,
      details: log.details,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
      transaction: log.transaction
        ? {
            transactionId: log.transaction.transactionId,
            amount: Number(log.transaction.amount),
            status: log.transaction.status,
          }
        : null,
      batch: log.batch
        ? {
            batchNumber: log.batch.batchNumber,
            status: log.batch.status,
          }
        : null,
    }));

    // Get distinct actions for filter dropdown
    const distinctActions = await prisma.disbursementAuditLog.findMany({
      select: { action: true },
      distinct: ['action'],
    });

    return NextResponse.json({
      logs: auditLogs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      filters: {
        availableActions: distinctActions.map((a) => a.action),
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
