/**
 * Affiliate Email Verification API Route
 *
 * POST /api/affiliate/auth/verify-email
 * Verifies affiliate email and activates account.
 *
 * @module app/api/affiliate/auth/verify-email/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { verifyAffiliateEmail } from '@/lib/affiliate/registration';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const verifyEmailSchema = z.object({
  token: z.string().min(32, 'Invalid verification token'),
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/affiliate/auth/verify-email
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Verify affiliate email with token
 *
 * @param request - Next.js request with verification token
 * @returns JSON response with verification result
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = verifyEmailSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: 'Invalid verification token',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    const { token } = validation.data;

    // Verify email
    const result = await verifyAffiliateEmail(token);

    return NextResponse.json({
      success: result.success,
      message: result.message,
      codesDistributed: result.codesDistributed,
    });
  } catch (error) {
    console.error('[Affiliate Verify Email] Error:', error);

    if (error instanceof Error) {
      if (error.message === 'Invalid verification token') {
        return NextResponse.json(
          {
            error: 'Invalid token',
            message: error.message,
            code: 'INVALID_TOKEN',
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Verification failed',
        message: 'Failed to verify email. Please try again.',
        code: 'VERIFICATION_ERROR',
      },
      { status: 500 }
    );
  }
}
