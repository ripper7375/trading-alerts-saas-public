/**
 * Batches API Route (Part 19B)
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
import { BatchManager, type BatchStatus } from '@/lib/disbursement/services/batch-manager';
import { CommissionAggregator } from '@/lib/disbursement/services/commission-aggregator';
import { isValidProvider } from '@/lib/disbursement/constants';
import type { DisbursementProvider } from '@/types/disbursement';

/**
 * Query schema for GET
 */
const querySchema = z.object({
  status: z
    .enum(['PENDING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'])
    .optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

/**
 * Request schema for POST
 */
const createBatchSchema = z.object({
  affiliateIds: z.array(z.string()).optional(),
  provider: z.enum(['RISE', 'MOCK']).default('MOCK'),
});

/**
 * GET /api/disbursement/batches
 *
 * Returns all payment batches with optional filtering by status.
 *
 * @returns 200 - List of batches
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const validation = querySchema.safeParse({
      status: searchParams.get('status'),
      limit: searchParams.get('limit'),
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { status, limit } = validation.data;
    const batchManager = new BatchManager(prisma);
    const batches = await batchManager.getAllBatches(status as BatchStatus, limit);

    return NextResponse.json({
      batches,
      count: batches.length,
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
 * Creates a new payment batch from pending commissions.
 * Can optionally specify specific affiliate IDs.
 *
 * @returns 201 - Created batch
 * @returns 400 - Invalid request / No payable affiliates
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAdmin();

    const body = await request.json();
    const validation = createBatchSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { affiliateIds, provider } = validation.data;

    if (!isValidProvider(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider' },
        { status: 400 }
      );
    }

    const aggregator = new CommissionAggregator(prisma);
    const batchManager = new BatchManager(prisma);

    // Get commission aggregates
    let aggregates;
    if (affiliateIds && affiliateIds.length > 0) {
      // Get aggregates for specific affiliates
      const aggregatePromises = affiliateIds.map((id) =>
        aggregator.getAggregatesByAffiliate(id)
      );
      aggregates = await Promise.all(aggregatePromises);
    } else {
      // Get all payable affiliates
      aggregates = await aggregator.getAllPayableAffiliates();
    }

    // Filter to only payable aggregates
    const payableAggregates = aggregates.filter((agg) => agg.canPayout);

    if (payableAggregates.length === 0) {
      return NextResponse.json(
        { error: 'No payable affiliates found' },
        { status: 400 }
      );
    }

    // Create the batch
    const batch = await batchManager.createBatch(
      payableAggregates,
      provider as DisbursementProvider,
      session.user?.id
    );

    return NextResponse.json({ batch }, { status: 201 });
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
