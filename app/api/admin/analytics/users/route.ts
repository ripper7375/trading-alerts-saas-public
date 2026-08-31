/**
 * Admin BI Dashboard 2 -- User Base & Funnel API Route
 *
 * GET: Metrics #1-#6 (user/tier counts + MoM growth), #7 (Overall
 * Conversion Rate + 6M history), #12 (True Churn Rate + 6M history). Thin
 * wrapper -- all aggregation logic lives in `lib/admin/analytics/users.ts`.
 *
 * @module app/api/admin/analytics/users/route
 */

import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { getUsersAnalytics } from '@/lib/admin/analytics/users';

/**
 * GET /api/admin/analytics/users
 *
 * @returns 200 - Users analytics
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function GET(): Promise<NextResponse> {
  try {
    await requireAdmin();

    const analytics = await getUsersAnalytics();

    return NextResponse.json(analytics);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Admin users analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to generate users analytics' },
      { status: 500 }
    );
  }
}
