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
import { isValidProvider } from '@/lib/disbursement/constants';

/**
 * Query parameter schema for GET
 */
const querySchema = z.object({
  status: z
    .enum([
      'PENDING',
      'QUEUED',
      'PROCESSING',
      'COMPLETED',
      'FAILED',
      'CANCELLED',
    ])
    .optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

/**
 * Request body schema for POST
 */
const createBatchSchema = z.object({
  affiliateIds: z.array(z.string()).optional(),
  provider: z.enum(['MOCK', 'RISE']).default('MOCK'),
});

/**
 * GET /api/disbursement/batches
 *
 * List all payment batches with optional status filter.
 *
 * @returns 200 - List of payment batches
 * @returns 400 - Invalid query parameters
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Require admin access
    await requireAdmin();

    // Parse and validate query params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const validation = querySchema.safeParse(searchParams);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { status, limit } = validation.data;

    const batchManager = new BatchManager(prisma);
    const batches = await batchManager.getBatchesWithSummary(status, limit);

    // Get overall statistics
    const stats = await batchManager.getBatchStatistics();

    type BatchWithCounts = (typeof batches)[number];

    return NextResponse.json({
      batches: batches.map((batch: BatchWithCounts) => ({
        id: batch.id,
        batchNumber: batch.batchNumber,
        provider: batch.provider,
        status: batch.status,
        paymentCount: batch.paymentCount,
        totalAmount: Number(batch.totalAmount),
        currency: batch.currency,
        transactionCounts: batch.transactionCounts,
        scheduledAt: batch.scheduledAt,
        executedAt: batch.executedAt,
        completedAt: batch.completedAt,
        failedAt: batch.failedAt,
        errorMessage: batch.errorMessage,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
      })),
      statistics: stats,
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
 * Create a new payment batch from payable affiliates.
 * If affiliateIds is not provided, includes all affiliates meeting the payout threshold.
 *
 * @returns 201 - Batch created successfully
 * @returns 400 - Invalid request body or no payable affiliates
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Require admin access
    const session = await requireAdmin();

    // Parse and validate body
    const body = await request.json();
    const validation = createBatchSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { affiliateIds, provider } = validation.data;

    // Validate provider
    if (!isValidProvider(provider)) {
      return NextResponse.json(
        { error: `Invalid provider: ${provider}` },
        { status: 400 }
      );
    }

    const aggregator = new CommissionAggregator(prisma);
    const batchManager = new BatchManager(prisma);

    // Get aggregates for specified affiliates or all payable affiliates
    let aggregates;
    if (affiliateIds && affiliateIds.length > 0) {
      aggregates = await Promise.all(
        affiliateIds.map((id: string) =>
          aggregator.getAggregatesByAffiliate(id)
        )
      );
    } else {
      aggregates = await aggregator.getAllPayableAffiliates();
    }

    // Filter to only payable aggregates (meeting threshold)
    const payableAggregates = aggregates.filter(
      (agg: { canPayout: boolean }) => agg.canPayout
    );

    if (payableAggregates.length === 0) {
      return NextResponse.json(
        {
          error: 'No payable affiliates found',
          details:
            'All affiliates are either below the minimum payout threshold or have no approved commissions',
        },
        { status: 400 }
      );
    }

    // Create batch
    const batch = await batchManager.createBatch(
      payableAggregates,
      provider,
      session.user?.id
    );

    // Get batch with full details
    const batchWithDetails = await batchManager.getBatchById(batch.id);

    return NextResponse.json(
      {
        message: 'Payment batch created successfully',
        batch: {
          id: batch.id,
          batchNumber: batch.batchNumber,
          provider: batch.provider,
          status: batch.status,
          paymentCount: batch.paymentCount,
          totalAmount: Number(batch.totalAmount),
          currency: batch.currency,
          affiliateCount: payableAggregates.length,
          transactionCount: batchWithDetails?.transactions?.length || 0,
          createdAt: batch.createdAt,
        },
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
      { error: 'Failed to create batch' },
      { status: 500 }
    );
  }
}
