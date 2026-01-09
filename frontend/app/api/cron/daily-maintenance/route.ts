/**
 * Cron API Route: Daily Maintenance
 *
 * Consolidated daily cron job that performs all maintenance tasks:
 * 1. Expire affiliate codes (codes past their expiresAt date)
 * 2. Check expiring dLocal subscriptions (3-day reminder)
 * 3. Downgrade expired dLocal subscriptions
 *
 * This consolidation reduces Vercel cron count from 4 to 2.
 *
 * Security: Requires CRON_SECRET authorization header.
 *
 * @module app/api/cron/daily-maintenance/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { checkExpiringSubscriptions } from '@/lib/cron/check-expiring-subscriptions';
import { downgradeExpiredSubscriptions } from '@/lib/cron/downgrade-expired-subscriptions';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Result type for the consolidated maintenance job
 */
interface MaintenanceResult {
  expiredCodes: {
    count: number;
  };
  expiringSubscriptions: {
    processed: number;
    remindersMarked: number;
    errors: string[];
  };
  expiredSubscriptions: {
    processed: number;
    downgraded: number;
    errors: string[];
  };
}

/**
 * GET /api/cron/daily-maintenance
 *
 * Vercel Cron uses GET requests.
 * Runs all daily maintenance tasks in sequence.
 *
 * @param request - Incoming request with cron authorization
 * @returns JSON response with all maintenance results
 *
 * Authorization: Bearer <CRON_SECRET>
 *
 * Response 200:
 * {
 *   "success": true,
 *   "message": "Daily maintenance completed",
 *   "results": {
 *     "expiredCodes": { "count": 5 },
 *     "expiringSubscriptions": { "processed": 3, "remindersMarked": 2 },
 *     "expiredSubscriptions": { "processed": 10, "downgraded": 1 }
 *   },
 *   "duration": "1234ms"
 * }
 *
 * Response 401:
 * { "error": "Unauthorized" }
 *
 * Response 500:
 * { "error": "Maintenance job failed" }
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

    logger.info('[CRON] Starting daily maintenance...');
    const startTime = Date.now();

    const results: MaintenanceResult = {
      expiredCodes: { count: 0 },
      expiringSubscriptions: { processed: 0, remindersMarked: 0, errors: [] },
      expiredSubscriptions: { processed: 0, downgraded: 0, errors: [] },
    };

    // Task 1: Expire affiliate codes
    logger.info('[CRON] Task 1/3: Expiring affiliate codes...');
    try {
      const now = new Date();
      const expireResult = await prisma.affiliateCode.updateMany({
        where: {
          status: 'ACTIVE',
          expiresAt: { lte: now },
        },
        data: {
          status: 'EXPIRED',
        },
      });
      results.expiredCodes.count = expireResult.count;
      logger.info(`[CRON] Expired ${expireResult.count} affiliate codes`);
    } catch (error) {
      logger.error('[CRON] Error expiring codes:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Continue with other tasks even if this fails
    }

    // Task 2: Check expiring subscriptions (3-day reminder)
    logger.info('[CRON] Task 2/3: Checking expiring subscriptions...');
    try {
      const expiringResult = await checkExpiringSubscriptions();
      results.expiringSubscriptions = {
        processed: expiringResult.processed,
        remindersMarked: expiringResult.reminders.length,
        errors: expiringResult.errors,
      };
      logger.info(
        `[CRON] Found ${expiringResult.processed} expiring, ${expiringResult.reminders.length} reminders marked`
      );
    } catch (error) {
      logger.error('[CRON] Error checking expiring subscriptions:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      results.expiringSubscriptions.errors.push(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }

    // Task 3: Downgrade expired subscriptions
    logger.info('[CRON] Task 3/3: Downgrading expired subscriptions...');
    try {
      const downgradeResult = await downgradeExpiredSubscriptions();
      results.expiredSubscriptions = {
        processed: downgradeResult.processed,
        downgraded: downgradeResult.downgrades.length,
        errors: downgradeResult.errors,
      };
      logger.info(
        `[CRON] Processed ${downgradeResult.processed}, downgraded ${downgradeResult.downgrades.length}`
      );
    } catch (error) {
      logger.error('[CRON] Error downgrading subscriptions:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      results.expiredSubscriptions.errors.push(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }

    const duration = Date.now() - startTime;
    logger.info(`[CRON] Daily maintenance completed in ${duration}ms`);

    // Check if there were any errors
    const hasErrors =
      results.expiringSubscriptions.errors.length > 0 ||
      results.expiredSubscriptions.errors.length > 0;

    return NextResponse.json({
      success: !hasErrors,
      message: hasErrors
        ? 'Daily maintenance completed with some errors'
        : 'Daily maintenance completed successfully',
      results,
      duration: `${duration}ms`,
    });
  } catch (error) {
    logger.error('[CRON] Daily maintenance failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Maintenance job failed' },
      { status: 500 }
    );
  }
}
