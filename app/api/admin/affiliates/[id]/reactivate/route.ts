/**
 * Admin Reactivate Affiliate API Route
 *
 * POST: Reactivate a suspended affiliate account
 *
 * @module app/api/admin/affiliates/[id]/reactivate/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { reactivateAffiliate } from '@/lib/admin/code-distribution';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface RouteParams {
  params: Promise<{ id: string }>;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST - Reactivate Affiliate
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * POST /api/admin/affiliates/[id]/reactivate
 *
 * Reactivate a suspended affiliate account.
 *
 * @returns 200 - Reactivation successful
 * @returns 400 - Invalid request or not suspended
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 404 - Affiliate not found
 * @returns 500 - Server error
 */
export async function POST(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    // Require admin access
    await requireAdmin();

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Affiliate ID is required' },
        { status: 400 }
      );
    }

    // Reactivate affiliate
    const affiliate = await reactivateAffiliate(id);

    return NextResponse.json({
      success: true,
      message: 'Affiliate reactivated',
      affiliate,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    if (error instanceof Error) {
      if (error.message === 'Affiliate not found') {
        return NextResponse.json(
          { error: 'Affiliate not found' },
          { status: 404 }
        );
      }

      if (error.message.includes('not suspended')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }

    console.error('Admin reactivate affiliate error:', error);
    return NextResponse.json(
      { error: 'Failed to reactivate affiliate' },
      { status: 500 }
    );
  }
}
