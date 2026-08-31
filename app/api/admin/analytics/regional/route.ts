/**
 * Admin BI Dashboard 3 -- Regional & Tax Surveillance API Route
 *
 * GET: Metrics #13-#19 (country rankings, VAT/tax threshold surveillance,
 * market-share donuts). Thin wrapper -- all aggregation logic lives in
 * `lib/admin/analytics/regional.ts`.
 *
 * @module app/api/admin/analytics/regional/route
 */

import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { getRegionalAnalytics } from '@/lib/admin/analytics/regional';

/**
 * GET /api/admin/analytics/regional
 *
 * @returns 200 - Regional analytics
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function GET(): Promise<NextResponse> {
  try {
    await requireAdmin();

    const analytics = await getRegionalAnalytics();

    return NextResponse.json(analytics);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Admin regional analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to generate regional analytics' },
      { status: 500 }
    );
  }
}
