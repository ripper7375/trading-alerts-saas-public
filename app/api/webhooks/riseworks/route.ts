/**
 * RiseWorks Webhook Endpoint (ARCHIVED, F42)
 *
 * POST /api/webhooks/riseworks
 *
 * RiseWorks payouts were replaced by Wise (Part 19.5). This endpoint no longer
 * accepts webhooks: every request gets 410 Gone, the body is never read and
 * the database is never touched. The former handler is preserved, unchanged,
 * in lib/disbursement/rise/archived-webhook-handler.ts (F42: nothing
 * RiseWorks-related is deleted).
 */

import { NextRequest, NextResponse } from 'next/server';

export function POST(_request: NextRequest): NextResponse {
  return NextResponse.json(
    { error: 'RiseWorks webhook endpoint is archived' },
    { status: 410 }
  );
}
