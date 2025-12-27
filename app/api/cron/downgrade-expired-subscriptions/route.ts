/**
 * Cron API Route: Downgrade Expired Subscriptions
 *
 * Daily cron job that identifies expired dLocal subscriptions and
 * downgrades users to FREE tier.
 *
 * Security: Requires CRON_SECRET authorization header.
 *
 * @module app/api/cron/downgrade-expired-subscriptions/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { downgradeExpiredSubscriptions } from '@/lib/cron/downgrade-expired-subscriptions';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/downgrade-expired-subscriptions
 *
 * Vercel Cron uses GET requests.
 * Finds expired dLocal subscriptions and downgrades users to FREE.
 *
 * @param request - Incoming request with cron authorization
 * @returns JSON response with downgrade results
 *
 * Authorization: Bearer <CRON_SECRET>
 *
 * Response 200:
 * {
 *   "success": true,
 *   "message": "Downgraded 3 users",
 *   "processed": 3,
 *   "downgrades": [...],
 *   "errors": []
 * }
 *
 * Response 401:
 * { "error": "Unauthorized" }
 *
 * Response 500:
 * { "error": "Cron job failed" }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env['CRON_SECRET'];

    if (!cronSecret) {
      logger.error('[CRON] CRON_SECRET environment variable not set');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('[CRON] Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('[CRON] Starting downgrade expired subscriptions...');
    const startTime = Date.now();

    const result = await downgradeExpiredSubscriptions();

    const duration = Date.now() - startTime;
    logger.info(`[CRON] Downgrade expired completed in ${duration}ms`);

    // TODO: Part 18C will add actual email sending here
    // For now, notifications are created in the service

    return NextResponse.json({
      success: true,
      message: `Downgraded ${result.downgrades.length} users`,
      processed: result.processed,
      downgrades: result.downgrades.map((d) => ({
        userId: d.userId,
        email: d.email,
        expiredAt: d.expiredAt.toISOString(),
      })),
      errors: result.errors.length > 0 ? result.errors : undefined,
      duration: `${duration}ms`,
    });
  } catch (error) {
    logger.error('[CRON] Downgrade expired subscriptions error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
