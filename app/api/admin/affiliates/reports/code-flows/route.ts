/**
 * Admin Global Code Flows Report API Route
 *
 * GET: Global code inventory FLOWS for a period, across all affiliates.
 * Complements /reports/code-inventory (point-in-time census) with a
 * period reconciliation: closing = opening + additions - reductions.
 *
 * @module app/api/admin/affiliates/reports/code-flows/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { buildGlobalCodeInventoryReport } from '@/lib/affiliate/report-builder';
import { MoneyServiceError } from '@/lib/money-service/client';
import { isAdminReadApiMigrated } from '@/lib/money-service/flags';
import {
  getMoneyServiceToken,
  fetchAdminCodeFlowsReport,
} from '@/lib/money-service/routes';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION SCHEMAS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const querySchema = z.object({
  /** ISO date (inclusive). Defaults to start of current month. */
  start: z.string().datetime().optional(),
  /** ISO date (inclusive). Defaults to now. */
  end: z.string().datetime().optional(),
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET - Global Code Flows Report
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/admin/affiliates/reports/code-flows
 *
 * Global code flows reconciliation for a period:
 * - Opening balance (ACTIVE codes at period start)
 * - Additions by reason (INITIAL, MONTHLY, ADMIN_BONUS)
 * - Reductions (used, expired, cancelled)
 * - Closing balance
 * - Affiliates with code activity in the period
 *
 * Query params:
 * - start: ISO datetime (default: start of current month)
 * - end: ISO datetime (default: now)
 *
 * @returns 200 - Global code flows report
 * @returns 400 - Invalid query parameters
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Require admin access
    await requireAdmin();

    // Parse query params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const validation = querySchema.safeParse(searchParams);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const start = validation.data.start
      ? new Date(validation.data.start)
      : defaultStart;
    const end = validation.data.end ? new Date(validation.data.end) : now;

    if (start >= end) {
      return NextResponse.json(
        { error: 'start must be before end' },
        { status: 400 }
      );
    }

    // Session 4A-7a (F45 server-side proxy) — see affiliate stats/route.ts's comment.
    if (isAdminReadApiMigrated()) {
      const token = await getMoneyServiceToken();
      if (token) {
        try {
          const result = await fetchAdminCodeFlowsReport(token, {
            start: validation.data.start,
            end: validation.data.end,
          });
          return NextResponse.json(result);
        } catch (error) {
          if (error instanceof MoneyServiceError) {
            return NextResponse.json(error.body, { status: error.status });
          }
          throw error;
        }
      }
    }

    const report = await buildGlobalCodeInventoryReport({ start, end });

    return NextResponse.json({ report });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('[Admin] Code flows report error:', error);
    return NextResponse.json(
      { error: 'Failed to build code flows report' },
      { status: 500 }
    );
  }
}
