/**
 * Payment Batches API Route (Part 19B)
 *
 * GET: List all payment batches
 * POST: Create a new payment batch
 *
 * @module app/api/disbursement/batches/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';
import { BatchManager } from '@/lib/disbursement/services/batch-manager';
import { CommissionAggregator } from '@/lib/disbursement/services/commission-aggregator';

/**
 * Validation schema for batch creation
 */
const createBatchSchema = z.object({
  affiliateIds: z.array(z.string()).optional(),
  provider: z.enum(['RISE', 'MOCK']).default('MOCK'),
});

/**
 * GET /api/disbursement/batches
 *
 * Returns all payment batches with optional filtering.
 *
 * Query params:
 * - status: Filter by batch status
 * - limit: Max number of batches to return (default: 50)
 * - offset: Pagination offset (default: 0)
 *
 * @returns 200 - List of payment batches
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  try {
    // Require admin access
    await requireAdmin();

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as
      | 'PENDING'
      | 'QUEUED'
      | 'PROCESSING'
      | 'COMPLETED'
      | 'FAILED'
      | 'CANCELLED'
      | undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
    const offset = parseInt(searchParams.get('offset') ?? '0');

    const batchManager = new BatchManager(prisma);
    const batches = await batchManager.getAllBatches(status, limit, offset);
    const totalCount = await batchManager.getBatchCount(status);
    const stats = await batchManager.getBatchStats();

    return NextResponse.json({
      batches: batches.map((batch) => ({
        id: batch.id,
        batchNumber: batch.batchNumber,
        status: batch.status,
        provider: batch.provider,
        paymentCount: batch.paymentCount,
        totalAmount: Number(batch.totalAmount),
        currency: batch.currency,
        scheduledAt: batch.scheduledAt,
        executedAt: batch.executedAt,
        completedAt: batch.completedAt,
        failedAt: batch.failedAt,
        errorMessage: batch.errorMessage,
        createdAt: batch.createdAt,
        transactionSummary: {
          total: batch.transactions.length,
          pending: batch.transactions.filter((t) => t.status === 'PENDING').length,
          completed: batch.transactions.filter((t) => t.status === 'COMPLETED').length,
          failed: batch.transactions.filter((t) => t.status === 'FAILED').length,
        },
      })),
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + batches.length < totalCount,
      },
      stats,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Error fetching batches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch batches' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/disbursement/batches
 *
 * Creates a new payment batch.
 *
 * Body:
 * - affiliateIds: Optional array of affiliate IDs to include (default: all payable)
 * - provider: Payment provider to use (default: MOCK)
 *
 * @returns 201 - Created batch
 * @returns 400 - Validation error or no payable affiliates
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  try {
    // Require admin access
    const session = await requireAdmin();

    // Parse and validate body
    const body = await request.json();
    const validation = createBatchSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { affiliateIds, provider } = validation.data;

    const aggregator = new CommissionAggregator(prisma);
    const batchManager = new BatchManager(prisma);

    // Get aggregates
    let aggregates;
    if (affiliateIds && affiliateIds.length > 0) {
      // Get aggregates for specific affiliates
      aggregates = await Promise.all(
        affiliateIds.map((id) => aggregator.getAggregatesByAffiliate(id))
      );
    } else {
      // Get all payable affiliates
      aggregates = await aggregator.getAllPayableAffiliates();
    }

    // Filter to only payable aggregates
    const payableAggregates = aggregates.filter((agg) => agg.canPayout);

    if (payableAggregates.length === 0) {
      return NextResponse.json(
        {
          error: 'No payable affiliates found',
          details: 'All affiliates either do not meet the minimum payout threshold or have no approved commissions.',
        },
        { status: 400 }
      );
    }

    // Create batch
    const result = await batchManager.createBatch(
      payableAggregates,
      provider,
      session.user?.id
    );

    return NextResponse.json(
      {
        batch: {
          id: result.batch.id,
          batchNumber: result.batch.batchNumber,
          status: result.batch.status,
          provider: result.batch.provider,
          paymentCount: result.batch.paymentCount,
          transactionCount: result.transactionCount,
          totalAmount: Number(result.batch.totalAmount),
          currency: result.batch.currency,
          createdAt: result.batch.createdAt,
        },
        message: `Created batch with ${result.transactionCount} transactions`,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Error creating batch:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create batch' },
      { status: 500 }
    );
  }
}
