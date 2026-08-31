/**
 * Admin BI Dashboard 1 -- Revenue & Growth API Route
 *
 * GET: Metrics #8 (monthly sales), #9 (quarterly sales), #10 (monthly
 * YoY), #11 (quarterly YoY). Thin wrapper -- all aggregation logic lives
 * in `lib/admin/analytics/revenue.ts` so this route and the Server
 * Component dashboard page share one cached data source.
 *
 * @module app/api/admin/analytics/revenue/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { getRevenueAnalytics } from '@/lib/admin/analytics/revenue';

const querySchema = z.object({
  timeframe: z.enum(['6M', '12M', 'YTD', 'ALL']).default('6M'),
});

/**
 * GET /api/admin/analytics/revenue
 *
 * Query params:
 * - timeframe: 6M | 12M | YTD | ALL (default: 6M)
 *
 * @returns 200 - Revenue analytics
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

    const { timeframe } = validation.data;
    const analytics = await getRevenueAnalytics(timeframe);

    return NextResponse.json(analytics);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Admin revenue analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to generate revenue analytics' },
      { status: 500 }
    );
  }
}
