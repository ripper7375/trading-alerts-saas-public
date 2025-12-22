/**
 * Batch Details API Route (Part 19B)
 *
 * GET: Get batch details by ID
 * DELETE: Delete a pending batch
 *
 * @module app/api/disbursement/batches/[batchId]/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';
import { BatchManager } from '@/lib/disbursement/services/batch-manager';

interface RouteParams {
  params: Promise<{ batchId: string }>;
}

/**
 * GET /api/disbursement/batches/[batchId]
 *
 * Returns detailed information about a specific batch including transactions.
 *
 * @returns 200 - Batch details
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 404 - Batch not found
 * @returns 500 - Server error
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    await requireAdmin();

    const { batchId } = await params;
    const batchManager = new BatchManager(prisma);
    const batch = await batchManager.getBatchById(batchId);

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    // Calculate transaction statistics
    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const txn of batch.transactions) {
      const status = txn.status.toLowerCase() as keyof typeof stats;
      if (status in stats) {
        stats[status]++;
      }
    }

    return NextResponse.json({
      batch,
      transactionStats: stats,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Error fetching batch:', error);
    return NextResponse.json(
      { error: 'Failed to fetch batch' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/disbursement/batches/[batchId]
 *
 * Deletes a batch. Only PENDING or CANCELLED batches can be deleted.
 *
 * @returns 200 - Success message
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 404 - Batch not found
 * @returns 409 - Cannot delete (wrong status)
 * @returns 500 - Server error
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    await requireAdmin();

    const { batchId } = await params;
    const batchManager = new BatchManager(prisma);

    try {
      await batchManager.deleteBatch(batchId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message === 'Batch not found') {
        return NextResponse.json(
          { error: 'Batch not found' },
          { status: 404 }
        );
      }

      if (message.includes('Cannot delete')) {
        return NextResponse.json(
          { error: message },
          { status: 409 }
        );
      }

      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Batch deleted successfully',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Error deleting batch:', error);
    return NextResponse.json(
      { error: 'Failed to delete batch' },
      { status: 500 }
    );
  }
}
