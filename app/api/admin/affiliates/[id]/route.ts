/**
 * Admin Affiliate Detail API Route
 *
 * GET: Get detailed affiliate information
 *
 * @module app/api/admin/affiliates/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { getAffiliateDetails } from '@/lib/admin/affiliate-management';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface RouteParams {
  params: Promise<{ id: string }>;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET - Affiliate Details
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/admin/affiliates/[id]
 *
 * Get detailed affiliate information including:
 * - Full profile data
 * - User email
 * - All affiliate codes
 * - Recent commissions
 *
 * @returns 200 - Affiliate details
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 404 - Affiliate not found
 * @returns 500 - Server error
 */
export async function GET(
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

    // Get affiliate details
    const affiliate = await getAffiliateDetails(id);

    return NextResponse.json(affiliate);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    if (error instanceof Error && error.message === 'Affiliate not found') {
      return NextResponse.json(
        { error: 'Affiliate not found' },
        { status: 404 }
      );
    }

    console.error('Admin affiliate detail error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch affiliate details' },
      { status: 500 }
    );
  }
}
