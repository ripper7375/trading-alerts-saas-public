/**
 * Admin Cancel Code API Route
 *
 * POST: Cancel an affiliate code
 *
 * @module app/api/admin/codes/[code]/cancel/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface RouteParams {
  params: Promise<{ code: string }>;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION SCHEMAS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const cancelSchema = z.object({
  reason: z.string().min(1, 'Reason is required').optional(),
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST - Cancel Code
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * POST /api/admin/codes/[code]/cancel
 *
 * Cancel an affiliate code. Can only cancel ACTIVE codes.
 *
 * Request body:
 * - reason: Optional reason for cancellation
 *
 * @returns 200 - Code cancelled successfully
 * @returns 400 - Code already used or cancelled
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 404 - Code not found
 * @returns 500 - Server error
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    // Require admin access
    await requireAdmin();

    const { code } = await params;

    if (!code) {
      return NextResponse.json(
        { error: 'Code is required' },
        { status: 400 }
      );
    }

    // Normalize code to uppercase
    const normalizedCode = code.toUpperCase();

    // Parse optional request body
    let reason: string | undefined;
    try {
      const body = await request.json();
      const validation = cancelSchema.safeParse(body);
      if (validation.success) {
        reason = validation.data.reason;
      }
    } catch {
      // No body provided, that's fine
    }

    // Get the code
    const affiliateCode = await prisma.affiliateCode.findUnique({
      where: { code: normalizedCode },
      include: {
        affiliateProfile: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (!affiliateCode) {
      return NextResponse.json(
        { error: 'Code not found' },
        { status: 404 }
      );
    }

    // Check if code can be cancelled
    if (affiliateCode.status === 'USED') {
      return NextResponse.json(
        { error: 'Cannot cancel a code that has already been used' },
        { status: 400 }
      );
    }

    if (affiliateCode.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Code is already cancelled' },
        { status: 400 }
      );
    }

    // Cancel the code
    const updatedCode = await prisma.affiliateCode.update({
      where: { code: normalizedCode },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Code cancelled successfully',
      code: {
        code: updatedCode.code,
        status: updatedCode.status,
        cancelledAt: updatedCode.cancelledAt,
        affiliateId: affiliateCode.affiliateProfile.id,
        affiliateName: affiliateCode.affiliateProfile.fullName,
        reason: reason || 'Admin cancellation',
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Admin cancel code error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel code' },
      { status: 500 }
    );
  }
}
