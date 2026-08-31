/**
 * Admin BI Dashboard 4 -- Affiliate Partner Network API Route
 *
 * GET: Metrics #20-#25 (partner growth, tier ratio, avg commission,
 * privacy-preserving Top 20 leaderboard). Thin wrapper -- all aggregation
 * logic lives in `lib/admin/analytics/affiliates.ts`.
 *
 * @module app/api/admin/analytics/affiliates/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { getAffiliatesAnalytics } from '@/lib/admin/analytics/affiliates';

const querySchema = z.object({
  period: z.enum(['3months', '6months', '1year']).default('3months'),
});

/**
 * GET /api/admin/analytics/affiliates
 *
 * Query params:
 * - period: 3months | 6months | 1year (default: 3months) -- scopes the
 *   Top 20 leaderboard's gross-sales/commission window only; partner
 *   counts and geographic distribution are always all-time.
 *
 * @returns 200 - Affiliates analytics
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const validation = querySchema.safeParse(searchParams);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const { period } = validation.data;
    const analytics = await getAffiliatesAnalytics(period);

    return NextResponse.json(analytics);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Admin affiliates analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to generate affiliates analytics' },
      { status: 500 }
    );
  }
}
