/**
 * Payable Affiliates API Route (Part 19B)
 *
 * GET: List all affiliates with pending payable commissions
 *
 * @module app/api/disbursement/affiliates/payable/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';
import { CommissionAggregator } from '@/lib/disbursement/services/commission-aggregator';

/**
 * GET /api/disbursement/affiliates/payable
 *
 * Returns all affiliates with pending commissions that meet the minimum payout threshold.
 * Includes RiseWorks account status and KYC information.
 *
 * @returns 200 - List of payable affiliates with summary
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();

    const aggregator = new CommissionAggregator(prisma);
    const affiliates = await aggregator.getPayableAffiliatesWithDetails();

    const totalPendingAmount = affiliates.reduce(
      (sum, a) => sum + a.pendingAmount,
      0
    );
    const readyForPayoutCount = affiliates.filter((a) => a.readyForPayout).length;

    return NextResponse.json({
      affiliates,
      summary: {
        totalAffiliates: affiliates.length,
        totalPendingAmount,
        readyForPayout: readyForPayoutCount,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Error fetching payable affiliates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payable affiliates' },
      { status: 500 }
    );
  }
}
