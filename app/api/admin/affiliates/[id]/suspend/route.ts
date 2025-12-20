/**
 * Admin Suspend Affiliate API Route
 *
 * POST: Suspend an affiliate account
 *
 * @module app/api/admin/affiliates/[id]/suspend/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { suspendAffiliate } from '@/lib/admin/code-distribution';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface RouteParams {
  params: Promise<{ id: string }>;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION SCHEMAS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const suspendSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST - Suspend Affiliate
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * POST /api/admin/affiliates/[id]/suspend
 *
 * Suspend an affiliate account.
 *
 * Request body:
 * - reason: Reason for suspension
 *
 * @returns 200 - Suspension successful
 * @returns 400 - Invalid request or already suspended
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 404 - Affiliate not found
 * @returns 500 - Server error
 */
export async function POST(
  request: NextRequest,
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

    // Parse and validate request body
    const body = await request.json();
    const validation = suspendSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { reason } = validation.data;

    // Suspend affiliate
    const affiliate = await suspendAffiliate(id, reason);

    return NextResponse.json({
      success: true,
      message: 'Affiliate suspended',
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

      if (
        error.message.includes('already suspended') ||
        error.message.includes('reason is required')
      ) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }

    console.error('Admin suspend affiliate error:', error);
    return NextResponse.json(
      { error: 'Failed to suspend affiliate' },
      { status: 500 }
    );
  }
}
