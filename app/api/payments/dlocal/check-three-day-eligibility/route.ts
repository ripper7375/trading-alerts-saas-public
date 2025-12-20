/**
 * GET /api/payments/dlocal/check-three-day-eligibility
 *
 * Checks if the current user is eligible for the 3-day trial plan.
 *
 * Eligibility rules:
 * 1. User must not have already used the 3-day plan (lifetime limit)
 * 2. User must not have an active subscription
 *
 * Response:
 * - 200: { eligible: boolean, reason?: string }
 * - 401: Unauthorized
 *
 * @module app/api/payments/dlocal/check-three-day-eligibility/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { canPurchaseThreeDayPlan } from '@/lib/dlocal/three-day-validator.service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    logger.info('Checking 3-day plan eligibility', { userId });

    // Check eligibility using the validator service
    const result = await canPurchaseThreeDayPlan(userId);

    logger.info('3-day plan eligibility result', {
      userId,
      eligible: result.canPurchase,
      reason: result.reason,
    });

    return NextResponse.json({
      eligible: result.canPurchase,
      reason: result.reason,
      details: result.details,
    });
  } catch (error) {
    logger.error('Failed to check 3-day plan eligibility', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Return not eligible on error to be safe
    return NextResponse.json({
      eligible: false,
      reason: 'Unable to verify eligibility. Please try again.',
    });
  }
}
