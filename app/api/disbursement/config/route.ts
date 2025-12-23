/**
 * Disbursement Configuration API (Part 19C)
 *
 * GET /api/disbursement/config - Get current configuration
 * PATCH /api/disbursement/config - Update configuration (future)
 *
 * Manages disbursement system configuration.
 * Admin-only endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import {
  MINIMUM_PAYOUT_USD,
  MAX_BATCH_SIZE,
  getDefaultProvider,
  DEFAULT_RETRY_CONFIG,
} from '@/lib/disbursement/constants';
import { isProviderAvailable } from '@/lib/disbursement/providers/provider-factory';

interface DisbursementConfiguration {
  provider: {
    default: string;
    available: string[];
    riseEnabled: boolean;
  };
  enabled: boolean;
  minimumPayout: number;
  batchSize: number;
  retry: {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };
  environment: string;
  features: {
    webhooksEnabled: boolean;
    cronEnabled: boolean;
    quickPayEnabled: boolean;
  };
}

/**
 * Get disbursement configuration
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const config: DisbursementConfiguration = {
      provider: {
        default: getDefaultProvider(),
        available: ['MOCK', isProviderAvailable('RISE') ? 'RISE' : null].filter(
          Boolean
        ) as string[],
        riseEnabled: isProviderAvailable('RISE'),
      },
      enabled: process.env['DISBURSEMENT_ENABLED'] !== 'false',
      minimumPayout: MINIMUM_PAYOUT_USD,
      batchSize: MAX_BATCH_SIZE,
      retry: {
        maxAttempts: DEFAULT_RETRY_CONFIG.maxAttempts,
        initialDelay: DEFAULT_RETRY_CONFIG.initialDelay,
        maxDelay: DEFAULT_RETRY_CONFIG.maxDelay,
        backoffMultiplier: DEFAULT_RETRY_CONFIG.backoffMultiplier,
      },
      environment: process.env['RISE_ENVIRONMENT'] || 'staging',
      features: {
        webhooksEnabled: !!process.env['RISE_WEBHOOK_SECRET'],
        cronEnabled: !!process.env['CRON_SECRET'],
        quickPayEnabled: true,
      },
    };

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Error fetching config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Update disbursement configuration
 * Note: Currently configuration is environment-based.
 * This endpoint is a placeholder for future database-backed configuration.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Validate incoming configuration
    if (body.minimumPayout !== undefined) {
      if (typeof body.minimumPayout !== 'number' || body.minimumPayout < 0) {
        return NextResponse.json(
          { error: 'Invalid minimumPayout value' },
          { status: 400 }
        );
      }
    }

    if (body.batchSize !== undefined) {
      if (
        typeof body.batchSize !== 'number' ||
        body.batchSize < 1 ||
        body.batchSize > 500
      ) {
        return NextResponse.json(
          { error: 'Invalid batchSize value (must be 1-500)' },
          { status: 400 }
        );
      }
    }

    // In production, this would update a database configuration table
    // For now, log the requested changes
    console.log('Configuration update requested:', body);

    return NextResponse.json({
      message:
        'Configuration update noted. Environment-based configuration is currently in use.',
      requestedChanges: body,
      note: 'To change configuration, update environment variables and restart the application.',
    });
  } catch (error) {
    console.error('Error updating config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
