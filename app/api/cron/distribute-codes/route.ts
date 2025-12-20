/**
 * Cron API Route: Distribute Codes
 *
 * Monthly cron job that distributes affiliate codes to all active affiliates.
 * Called by Vercel Cron on the 1st of each month at midnight UTC.
 *
 * Security: Requires CRON_SECRET authorization header.
 *
 * @module app/api/cron/distribute-codes/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { runMonthlyDistribution } from '@/lib/cron/monthly-distribution';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/distribute-codes
 *
 * Triggers monthly code distribution for all active affiliates.
 *
 * @param request - Incoming request with cron authorization
 * @returns JSON response with distribution results
 *
 * Authorization: Bearer <CRON_SECRET>
 *
 * Response 200:
 * {
 *   "success": true,
 *   "message": "Distributed codes to 25 affiliates",
 *   "distributed": 25,
 *   "totalAffiliates": 25,
 *   "errors": []
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
    const cronSecret = process.env['CRON_SECRET'];

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

    console.log('[CRON] Starting monthly code distribution...');
    const startTime = Date.now();

    const result = await runMonthlyDistribution();

    const duration = Date.now() - startTime;
    console.log(`[CRON] Distribution completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: `Distributed codes to ${result.distributed} affiliates`,
      distributed: result.distributed,
      totalAffiliates: result.totalAffiliates,
      emailsSent: result.emailsSent,
      errors: result.errors.length > 0 ? result.errors : undefined,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error('[CRON] Distribute codes error:', error);
    return NextResponse.json(
      { error: 'Cron job failed' },
      { status: 500 }
    );
  }
}
