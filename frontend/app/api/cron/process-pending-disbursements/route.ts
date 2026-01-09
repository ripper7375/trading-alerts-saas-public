/**
 * Process Pending Disbursements Cron Job (Part 19C)
 *
 * POST /api/cron/process-pending-disbursements
 *
 * Automated cron job to process pending disbursements.
 * Runs daily at 2:00 AM UTC (configured in vercel.json).
 * Protected by CRON_SECRET environment variable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { DisbursementProcessor } from '@/lib/disbursement/cron/disbursement-processor';

/**
 * Process pending disbursements
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env['CRON_SECRET'];

  if (!cronSecret) {
    console.error('CRON_SECRET not configured');
    return NextResponse.json(
      { error: 'Cron job not configured' },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('Unauthorized cron attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('Starting automated disbursement processing...');

    const processor = new DisbursementProcessor(prisma);
    const result = await processor.processAutomatedDisbursements();

    console.log('Disbursement processing completed:', {
      success: result.success,
      batchesCreated: result.batchesCreated,
      batchesExecuted: result.batchesExecuted,
      affiliatesProcessed: result.affiliatesProcessed,
      totalAmount: result.totalAmount,
      durationMs: result.durationMs,
      errorCount: result.errors.length,
    });

    return NextResponse.json({
      success: result.success,
      timestamp: new Date().toISOString(),
      result: {
        batchesCreated: result.batchesCreated,
        batchesExecuted: result.batchesExecuted,
        affiliatesProcessed: result.affiliatesProcessed,
        totalAmount: result.totalAmount,
        durationMs: result.durationMs,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      {
        success: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * Health check for cron endpoint (used by monitoring)
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: '/api/cron/process-pending-disbursements',
    method: 'POST',
    status: 'configured',
    description: 'Automated disbursement processing cron job',
    schedule: '0 2 * * * (daily at 2:00 AM UTC)',
    requiresAuth: true,
    authType: 'Bearer token (CRON_SECRET)',
  });
}
