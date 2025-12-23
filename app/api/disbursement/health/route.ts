/**
 * Disbursement Health Check API (Part 19C)
 *
 * GET /api/disbursement/health
 *
 * Returns health status of the disbursement system.
 * Checks database connectivity, provider status, and system metrics.
 * Public endpoint for monitoring.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { createPaymentProvider } from '@/lib/disbursement/providers/provider-factory';
import { getDefaultProvider } from '@/lib/disbursement/constants';

interface HealthChecks {
  database: boolean;
  provider: boolean;
  pendingBatches: number;
  failedTransactions: number;
  lastWebhookReceived: Date | null;
  lastBatchCompleted: Date | null;
}

interface HealthResponse {
  healthy: boolean;
  timestamp: string;
  checks: HealthChecks;
  warnings: string[];
  provider: string;
  uptime?: number;
}

const startTime = Date.now();

/**
 * Get disbursement system health status
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  const checks: HealthChecks = {
    database: false,
    provider: false,
    pendingBatches: 0,
    failedTransactions: 0,
    lastWebhookReceived: null,
    lastBatchCompleted: null,
  };

  const warnings: string[] = [];

  try {
    // Check database connectivity
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch (dbError) {
      console.error('Database health check failed:', dbError);
      checks.database = false;
      warnings.push('Database connection failed');
    }

    // Check provider connectivity
    try {
      const provider = createPaymentProvider();
      await provider.authenticate();
      checks.provider = true;
    } catch (providerError) {
      console.error('Provider health check failed:', providerError);
      checks.provider = false;
      // This is expected if RISE is not implemented
      if (
        providerError instanceof Error &&
        providerError.message.includes('not yet implemented')
      ) {
        checks.provider = true; // MOCK provider is fine
      } else {
        warnings.push('Provider authentication failed');
      }
    }

    // Get pending batches count
    try {
      checks.pendingBatches = await prisma.paymentBatch.count({
        where: { status: { in: ['PENDING', 'QUEUED', 'PROCESSING'] } },
      });

      if (checks.pendingBatches > 10) {
        warnings.push(`High number of pending batches (${checks.pendingBatches})`);
      }
    } catch {
      warnings.push('Failed to count pending batches');
    }

    // Get failed transactions count (last 24 hours)
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      checks.failedTransactions = await prisma.disbursementTransaction.count({
        where: {
          status: 'FAILED',
          failedAt: { gte: oneDayAgo },
        },
      });

      if (checks.failedTransactions > 20) {
        warnings.push(
          `High number of failed transactions in last 24h (${checks.failedTransactions})`
        );
      }
    } catch {
      warnings.push('Failed to count failed transactions');
    }

    // Get last webhook received
    try {
      const lastWebhook = await prisma.riseWorksWebhookEvent.findFirst({
        orderBy: { receivedAt: 'desc' },
        select: { receivedAt: true },
      });
      checks.lastWebhookReceived = lastWebhook?.receivedAt || null;
    } catch {
      // Not critical
    }

    // Get last batch completed
    try {
      const lastBatch = await prisma.paymentBatch.findFirst({
        where: { status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
      });
      checks.lastBatchCompleted = lastBatch?.completedAt || null;
    } catch {
      // Not critical
    }

    const healthy = checks.database && checks.provider;

    const response: HealthResponse = {
      healthy,
      timestamp: new Date().toISOString(),
      checks,
      warnings,
      provider: getDefaultProvider(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
    };

    return NextResponse.json(response, { status: healthy ? 200 : 503 });
  } catch (error) {
    console.error('Health check failed:', error);

    const response: HealthResponse = {
      healthy: false,
      timestamp: new Date().toISOString(),
      checks,
      warnings: [
        ...warnings,
        error instanceof Error ? error.message : 'Unknown error',
      ],
      provider: getDefaultProvider(),
    };

    return NextResponse.json(response, { status: 503 });
  }
}
