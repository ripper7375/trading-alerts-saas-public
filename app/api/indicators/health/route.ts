/**
 * Health Check API Route
 *
 * Part 20 - Phase 04: Next.js API Routes
 *
 * GET /api/indicators/health
 * Returns system health status including PostgreSQL connection status.
 *
 * @module app/api/indicators/health/route
 */

import { NextResponse } from 'next/server';

import { checkHealth, getTableCount } from '@/lib/db/postgresql';
import type { HealthResponse } from '@/lib/indicators/types';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const API_VERSION = '20.0.0';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET HANDLER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/indicators/health
 *
 * Health check endpoint - no authentication required.
 * Returns status of PostgreSQL connection and table count.
 *
 * @returns 200: System is healthy
 * @returns 503: System unhealthy
 *
 * @example Response (healthy):
 * {
 *   "status": "ok",
 *   "version": "20.0.0",
 *   "components": {
 *     "postgresql": {
 *       "connected": true,
 *       "tables": 135,
 *       "latency_ms": 5
 *     }
 *   }
 * }
 */
export async function GET(): Promise<NextResponse> {
  try {
    // Check PostgreSQL health
    const pgHealth = await checkHealth();
    const tableCount = await getTableCount();

    // Determine overall status
    const isHealthy = pgHealth.connected;

    const response: HealthResponse = {
      status: isHealthy ? 'ok' : 'error',
      version: API_VERSION,
      components: {
        postgresql: {
          connected: pgHealth.connected,
          tables: tableCount,
          latency_ms: pgHealth.latencyMs,
        },
      },
    };

    return NextResponse.json(response, {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[Health] Check failed:', error);

    const errorResponse: HealthResponse = {
      status: 'error',
      version: API_VERSION,
      components: {
        postgresql: {
          connected: false,
          tables: 0,
          latency_ms: 0,
        },
      },
    };

    return NextResponse.json(errorResponse, { status: 503 });
  }
}
