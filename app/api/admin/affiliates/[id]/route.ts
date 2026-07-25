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
import { MoneyServiceError } from '@/lib/money-service/client';
import { isAdminReadApiMigrated } from '@/lib/money-service/flags';
import {
  getMoneyServiceToken,
  fetchAdminAffiliateDetail,
} from '@/lib/money-service/routes';

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

    // Session 4A-7a (F45 server-side proxy) — see affiliate stats/route.ts's comment.
    if (isAdminReadApiMigrated()) {
      const token = await getMoneyServiceToken();
      if (token) {
        try {
          const affiliate = await fetchAdminAffiliateDetail(token, id);
          return NextResponse.json(affiliate);
        } catch (error) {
          if (error instanceof MoneyServiceError) {
            return NextResponse.json(error.body, { status: error.status });
          }
          throw error;
        }
      }
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
