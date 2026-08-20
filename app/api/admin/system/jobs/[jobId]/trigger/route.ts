/**
 * Admin Cron Job Manual Trigger API Route (Session 6-11, B2-15)
 *
 * The 8 `app/api/cron/<job>/route.ts` handlers are no longer the live
 * execution path -- `vercel.json`'s `crons` array has been empty since
 * Session 4A-3 (`migration-cutover-table.md`, Slice 1: "money-service's own
 * scheduler is now the sole live execution path"). This forwards a real
 * admin-triggered run to money-service's `CronTriggerController`
 * (`POST /v1/cron-trigger/<jobId>`), the actual production execution
 * surface, using the same `CRON_SECRET` value both services' guards are
 * designed to share (`money-service/src/crons/cron-secret.guard.ts`'s own
 * header comment: "mirrors the CRON_SECRET protection every source route
 * had").
 *
 * No run history is written anywhere by this route -- the result is
 * returned inline for the caller to render as an ephemeral "last triggered
 * this session" value, not a persisted audit trail (none exists; fabricating
 * one would violate this session's Data Discipline rule).
 *
 * Session 7-2 Deviation 1: this route previously called
 * `callMoneyService('/cron-trigger/${jobId}', ...)` -- missing the `/v1`
 * prefix money-service's global route prefix actually requires (`main.ts`'s
 * `setGlobalPrefix('v1', ...)`, not excluded for `cron-trigger`), so the real
 * request almost certainly 404'd. Migrating onto `createMoneyApi` fixes this
 * as a disclosed side effect (Davin confirmed live, 2026-08-20) rather than
 * silently preserving the bug. `CronTriggerController` exposes one literal
 * sub-route per job id (`/v1/cron-trigger/expire-codes`, etc.), not a single
 * templated `/v1/cron-trigger/{jobId}` path, so the generated `paths` type
 * has no entry a runtime `jobId` string can be checked against statically --
 * the cast below is narrowly scoped to that one enumeration gap, not a
 * blanket type-safety opt-out.
 *
 * @module app/api/admin/system/jobs/[jobId]/trigger/route
 */

import { NextResponse } from 'next/server';

import type { paths } from '@/lib/api/generated/money-api/schema';
import {
  createMoneyApi,
  unwrapMoneyApi,
} from '@/lib/api/generated/money-api/client';
import { AuthError } from '@/lib/auth/errors';
import { requireAdmin } from '@/lib/auth/session';
import { SYSTEM_CRON_JOB_IDS } from '@/lib/admin/system-jobs';
import { MoneyServiceError } from '@/lib/money-service/client';

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

export async function POST(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    await requireAdmin();

    const { jobId } = await params;

    if (!SYSTEM_CRON_JOB_IDS.has(jobId)) {
      return NextResponse.json({ error: 'Unknown job id' }, { status: 400 });
    }

    const cronSecret = process.env['CRON_SECRET'];
    if (!cronSecret) {
      return NextResponse.json(
        { error: 'Server configuration error: CRON_SECRET not set' },
        { status: 500 }
      );
    }

    const api = createMoneyApi(cronSecret);
    const apiResult = await api.POST(
      `/v1/cron-trigger/${jobId}` as keyof paths & `/v1/cron-trigger/${string}`,
      {}
    );
    const result = await unwrapMoneyApi(apiResult);

    return NextResponse.json({
      success: true,
      jobId,
      result,
      triggeredAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    if (error instanceof MoneyServiceError) {
      return NextResponse.json(
        {
          error:
            error.body.message ??
            error.body.error ??
            'money-service rejected the trigger request',
        },
        { status: error.status }
      );
    }

    console.error('Admin cron trigger error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger job' },
      { status: 500 }
    );
  }
}
