/**
 * Admin System Terminals Health API Route (Session 6-11, B2-14)
 *
 * Live reachability check against the Flask MT5 service's admin endpoints
 * (`docs/open-api-documents/part-06-flask_mt5_openapi.yaml`). Runs
 * server-side so `MT5_ADMIN_API_KEY` never reaches the browser.
 *
 * Base URL follows `lib/monitoring/system-monitor.ts`'s established
 * `MT5_SERVICE_URL` convention (the env var actually present in live
 * `.env`/`.env.local` per `docs/secret-matrix.md` -- `MT5_API_URL` is
 * `.env.example`-only drift, not used here).
 *
 * Returns an honest status discriminant rather than fabricating "online" --
 * `not_configured` (no admin key set in this environment), `restricted`
 * (key set but rejected), `offline` (unreachable), `degraded` (reachable,
 * non-2xx), or `online` (real telemetry attached).
 *
 * @module app/api/admin/system/terminals/route
 */

import { NextResponse } from 'next/server';

import { AuthError } from '@/lib/auth/errors';
import { requireAdmin } from '@/lib/auth/session';

const MT5_SERVICE_URL =
  process.env['MT5_SERVICE_URL'] || 'http://localhost:5001';
const HEALTH_CHECK_TIMEOUT_MS = 5000;

interface AdminTerminalStatus {
  connected: boolean;
  terminal_id: string;
  last_check: string;
  error?: string;
  uptime_percentage?: number;
  reconnect_count?: number;
  last_error?: string;
}

interface AdminHealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  total_terminals: number;
  connected_terminals: number;
  terminals: Record<string, AdminTerminalStatus>;
}

interface TerminalStatsResponse {
  success: boolean;
  stats: {
    total_uptime_percentage: number;
    total_reconnects_24h: number;
    avg_response_time_ms: number;
    terminals_by_status: {
      connected: number;
      disconnected: number;
      reconnecting: number;
    };
    most_problematic_terminals: Array<{
      terminal_id: string;
      symbol: string;
      reconnect_count: number;
      uptime: number;
    }>;
  };
}

type TerminalsApiResponse =
  | { status: 'not_configured'; message: string }
  | { status: 'restricted'; message: string }
  | { status: 'offline'; message: string }
  | { status: 'degraded'; message: string }
  | {
      status: 'online';
      health: AdminHealthResponse;
      stats: TerminalStatsResponse['stats'] | null;
    };

async function fetchWithTimeout(
  path: string,
  apiKey: string
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
  try {
    return await fetch(`${MT5_SERVICE_URL}${path}`, {
      method: 'GET',
      headers: { 'X-Admin-API-Key': apiKey },
      signal: controller.signal,
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * GET /api/admin/system/terminals
 *
 * Admin-only. Never throws for a downstream flask-api failure -- every
 * failure mode is reported as a 200 with an honest `status` discriminant so
 * the page can render a real alert card instead of a generic error boundary.
 */
export async function GET(): Promise<NextResponse<TerminalsApiResponse>> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 'restricted', message: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      {
        status: 'restricted',
        message: 'Unable to verify administrator status',
      },
      { status: 403 }
    );
  }

  const apiKey = process.env['MT5_ADMIN_API_KEY'];
  if (!apiKey) {
    return NextResponse.json({
      status: 'not_configured',
      message:
        'MT5_ADMIN_API_KEY is not set in this environment -- terminal admin endpoints cannot be reached.',
    });
  }

  let healthResponse: Response;
  try {
    healthResponse = await fetchWithTimeout(
      '/api/admin/terminals/health',
      apiKey
    );
  } catch {
    return NextResponse.json({
      status: 'offline',
      message: 'flask-api is unreachable -- attempting reconnection.',
    });
  }

  if (healthResponse.status === 401 || healthResponse.status === 403) {
    return NextResponse.json({
      status: 'restricted',
      message: `flask-api rejected the configured admin API key (${healthResponse.status}).`,
    });
  }

  if (!healthResponse.ok) {
    return NextResponse.json({
      status: 'degraded',
      message: `flask-api returned ${healthResponse.status}.`,
    });
  }

  const health = (await healthResponse.json()) as AdminHealthResponse;

  let stats: TerminalStatsResponse['stats'] | null = null;
  try {
    const statsResponse = await fetchWithTimeout(
      '/api/admin/terminals/stats',
      apiKey
    );
    if (statsResponse.ok) {
      const statsBody = (await statsResponse.json()) as TerminalStatsResponse;
      stats = statsBody.stats;
    }
  } catch {
    // Stats are supplementary -- health alone is enough to render the page.
  }

  return NextResponse.json({ status: 'online', health, stats });
}
