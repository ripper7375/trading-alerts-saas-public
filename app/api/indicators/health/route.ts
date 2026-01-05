/**
 * Part 20 - Phase 04e: Health Check API Route
 *
 * GET /api/indicators/health
 * Returns health status of the PostgreSQL database and data freshness.
 * This is a public endpoint (no authentication required).
 *
 * @see docs/sqlite-and-mt5service/part-20-sqlite-sync-postgresql-openapi.yaml
 */

import { NextResponse } from 'next/server';

import { checkConnection, query } from '@/lib/db/postgresql';
import { getTableCount, getDataFreshness } from '@/lib/db/queries';

interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  components: {
    postgresql: {
      connected: boolean;
      tables: number;
      latency_ms: number;
    };
    data_freshness: {
      last_sync: string | null;
      sync_interval_seconds: number;
      symbols_updated: number;
    };
  };
}

interface ErrorResponse {
  success: boolean;
  error: string;
  message: string;
}

/**
 * GET /api/indicators/health
 *
 * Check if the indicator data system is operational.
 * Returns status of PostgreSQL and data freshness.
 *
 * @returns 200: System is healthy
 * @returns 503: System is unhealthy
 */
export async function GET(): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Check PostgreSQL connection
    const isConnected = await checkConnection();
    const latencyMs = Date.now() - startTime;

    if (!isConnected) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Database connection failed',
        message: 'Unable to connect to PostgreSQL database',
      };
      return NextResponse.json(errorResponse, { status: 503 });
    }

    // Get table count
    const tableCount = await getTableCount();

    // Get data freshness (sample from EURUSD H1)
    const lastUpdate = await getDataFreshness('EURUSD', 'H1');

    // Check how many symbols have H1 tables (used as proxy for symbols updated)
    const recentUpdatesResult = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT table_name) as count
       FROM information_schema.tables t
       WHERE t.table_schema = 'public'
       AND t.table_type = 'BASE TABLE'
       AND t.table_name LIKE '%_h1'`
    );
    const symbolsUpdated = parseInt(recentUpdatesResult[0]?.count || '0', 10);

    // Determine overall status
    let status: 'ok' | 'degraded' | 'error' = 'ok';
    if (tableCount < 135) {
      status = 'degraded';
    }
    if (!isConnected) {
      status = 'error';
    }

    const response: HealthResponse = {
      status,
      version: '20.0.0',
      components: {
        postgresql: {
          connected: isConnected,
          tables: tableCount,
          latency_ms: latencyMs,
        },
        data_freshness: {
          last_sync: lastUpdate ? lastUpdate.toISOString() : null,
          sync_interval_seconds: 30,
          symbols_updated: symbolsUpdated,
        },
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('GET /api/indicators/health error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    const errorResponse: ErrorResponse = {
      success: false,
      error: 'Health check failed',
      message:
        error instanceof Error ? error.message : 'Unknown error occurred',
    };

    return NextResponse.json(errorResponse, { status: 503 });
  }
}
