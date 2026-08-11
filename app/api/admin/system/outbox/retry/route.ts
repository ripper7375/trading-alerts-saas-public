/**
 * Admin Outbox Retry API Route (Session 6-11, B2-16)
 *
 * Bulk-resets every FAILED OutboxEvent row back to PENDING with a fresh
 * attemptCount so money-service's `OutboxPublisherCron` (Session 4A-8, F14)
 * picks it up on its next 5s poll. No `operation-service`/`money-service`
 * code change -- this only writes to the shared `OutboxEvent` table the
 * monolith already has direct Prisma access to.
 *
 * @module app/api/admin/system/outbox/retry/route
 */

import { NextResponse } from 'next/server';

import { AuthError } from '@/lib/auth/errors';
import { requireAdmin } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export async function POST(): Promise<NextResponse> {
  try {
    await requireAdmin();

    const result = await prisma.outboxEvent.updateMany({
      where: { status: 'FAILED' },
      data: { status: 'PENDING', attemptCount: 0, lastError: null },
    });

    return NextResponse.json({ success: true, retried: result.count });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Admin outbox retry error:', error);
    return NextResponse.json(
      { error: 'Failed to retry outbox events' },
      { status: 500 }
    );
  }
}
