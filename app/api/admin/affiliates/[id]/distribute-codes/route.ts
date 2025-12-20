/**
 * Admin Distribute Codes API Route
 *
 * POST: Distribute bonus codes to an affiliate
 *
 * @module app/api/admin/affiliates/[id]/distribute-codes/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { distributeCodesAdmin } from '@/lib/admin/code-distribution';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface RouteParams {
  params: Promise<{ id: string }>;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION SCHEMAS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const distributeSchema = z.object({
  count: z.number().min(1).max(50),
  reason: z.string().min(1, 'Reason is required'),
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST - Distribute Codes
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * POST /api/admin/affiliates/[id]/distribute-codes
 *
 * Distribute bonus codes to an affiliate.
 *
 * Request body:
 * - count: Number of codes to distribute (1-50)
 * - reason: Reason for distribution
 *
 * @returns 200 - Distribution successful
 * @returns 400 - Invalid request or affiliate not eligible
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
    const validation = distributeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { count, reason } = validation.data;

    // Distribute codes
    const result = await distributeCodesAdmin(id, count, reason);

    return NextResponse.json(result);
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
        error.message.includes('Count must be') ||
        error.message.includes('Can only distribute')
      ) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }

    console.error('Admin distribute codes error:', error);
    return NextResponse.json(
      { error: 'Failed to distribute codes' },
      { status: 500 }
    );
  }
}
