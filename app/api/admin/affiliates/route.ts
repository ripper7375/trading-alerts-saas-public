/**
 * Admin Affiliates API Route
 *
 * GET: List all affiliates with filtering and pagination
 *
 * @module app/api/admin/affiliates/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { getAffiliatesList } from '@/lib/admin/affiliate-management';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION SCHEMAS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const querySchema = z.object({
  status: z
    .enum(['ACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED', 'INACTIVE'])
    .optional(),
  country: z.string().optional(),
  paymentMethod: z
    .enum(['BANK_TRANSFER', 'PAYPAL', 'CRYPTOCURRENCY', 'WISE'])
    .optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(10).max(100).default(20),
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET - List Affiliates
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/admin/affiliates
 *
 * List all affiliates with optional filtering by status, country, payment method.
 * Supports pagination.
 *
 * Query params:
 * - status: ACTIVE | PENDING_VERIFICATION | SUSPENDED | INACTIVE
 * - country: Country code (US, UK, etc.)
 * - paymentMethod: BANK_TRANSFER | PAYPAL | CRYPTOCURRENCY | WISE
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 *
 * @returns 200 - Paginated affiliate list
 * @returns 400 - Invalid query parameters
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Require admin access
    await requireAdmin();

    // Parse and validate query params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const validation = querySchema.safeParse(searchParams);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { status, country, paymentMethod, page, limit } = validation.data;

    // Get affiliates with filters
    const result = await getAffiliatesList({
      status: status as
        | 'ACTIVE'
        | 'PENDING_VERIFICATION'
        | 'SUSPENDED'
        | 'INACTIVE'
        | undefined,
      country,
      paymentMethod,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Admin affiliates list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch affiliates' },
      { status: 500 }
    );
  }
}
