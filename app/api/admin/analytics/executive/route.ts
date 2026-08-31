/**
 * Admin BI Dashboard 5 -- Executive Command Center API Route
 *
 * GET: Unified 4-pillar summary + cross-functional RAG health matrix.
 * Thin wrapper -- composition logic lives in
 * `lib/admin/analytics/executive.ts`.
 *
 * @module app/api/admin/analytics/executive/route
 */

import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { getExecutiveAnalytics } from '@/lib/admin/analytics/executive';

/**
 * GET /api/admin/analytics/executive
 *
 * @returns 200 - Executive analytics
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function GET(): Promise<NextResponse> {
  try {
    await requireAdmin();

    const analytics = await getExecutiveAnalytics();

    return NextResponse.json(analytics);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Admin executive analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to generate executive analytics' },
      { status: 500 }
    );
  }
}
