/**
 * Cron API Route: Check Expiring Subscriptions
 *
 * Daily cron job that identifies dLocal subscriptions expiring in 3 days
 * and marks them for renewal reminder emails.
 *
 * Security: Requires CRON_SECRET authorization header.
 *
 * @module app/api/cron/check-expiring-subscriptions/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { checkExpiringSubscriptions } from '@/lib/cron/check-expiring-subscriptions';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/check-expiring-subscriptions
 *
 * Vercel Cron uses GET requests.
 * Finds dLocal subscriptions expiring in 3 days and marks for reminder.
 *
 * @param request - Incoming request with cron authorization
 * @returns JSON response with processing results
 *
 * Authorization: Bearer <CRON_SECRET>
 *
 * Response 200:
 * {
 *   "success": true,
 *   "message": "Found 5 expiring subscriptions",
 *   "processed": 5,
 *   "reminders": [...],
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

    logger.info('[CRON] Starting check expiring subscriptions...');
    const startTime = Date.now();

    const result = await checkExpiringSubscriptions();

    const duration = Date.now() - startTime;
    logger.info(`[CRON] Check expiring completed in ${duration}ms`);

    // TODO: Part 18C will add actual email sending here
    // For now, we just mark reminders as sent

    return NextResponse.json({
      success: true,
      message: `Found ${result.processed} expiring subscriptions, ${result.reminders.length} reminders marked`,
      processed: result.processed,
      reminders: result.reminders.map((r) => ({
        userId: r.userId,
        email: r.email,
        expiresAt: r.expiresAt.toISOString(),
      })),
      errors: result.errors.length > 0 ? result.errors : undefined,
      duration: `${duration}ms`,
    });
  } catch (error) {
    logger.error('[CRON] Check expiring subscriptions error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
