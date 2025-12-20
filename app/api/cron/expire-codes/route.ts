/**
 * Cron API Route: Expire Codes
 *
 * End-of-month cron job that marks expired affiliate codes.
 * Called by Vercel Cron on days 28-31 at 23:59 UTC.
 *
 * Security: Requires CRON_SECRET authorization header.
 *
 * @module app/api/cron/expire-codes/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/expire-codes
 *
 * Marks all expired affiliate codes as EXPIRED status.
 *
 * @param request - Incoming request with cron authorization
 * @returns JSON response with expiry results
 *
 * Authorization: Bearer <CRON_SECRET>
 *
 * Response 200:
 * {
 *   "success": true,
 *   "message": "Expired 42 codes"
 * }
 *
 * Response 401:
 * { "error": "Unauthorized" }
 *
 * Response 500:
 * { "error": "Cron job failed" }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('[CRON] CRON_SECRET environment variable not set');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[CRON] Unauthorized cron request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[CRON] Starting code expiry check...');
    const startTime = Date.now();

    const now = new Date();

    // Find and update all expired codes
    const result = await prisma.affiliateCode.updateMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lte: now },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    const duration = Date.now() - startTime;
    console.log(`[CRON] Expired ${result.count} codes in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: `Expired ${result.count} codes`,
      expiredCount: result.count,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error('[CRON] Expire codes error:', error);
    return NextResponse.json(
      { error: 'Cron job failed' },
      { status: 500 }
    );
  }
}
