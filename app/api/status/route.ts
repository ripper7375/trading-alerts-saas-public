/**
 * Public System Status API (Session 6-10, B2-12)
 *
 * GET /api/status
 *
 * Returns real, live health of the API, Database, Realtime service, and
 * Payment Gateway configuration. Public endpoint for monitoring -- same
 * shape as the existing app/api/disbursement/health/route.ts precedent.
 */

import { NextResponse } from 'next/server';

import { getSystemStatus } from '@/lib/status/check-system-status';

export async function GET(): Promise<NextResponse> {
  const status = await getSystemStatus();
  return NextResponse.json(status, {
    status: status.overall === 'degraded' ? 503 : 200,
  });
}
