/**
 * Line-touch alert item API
 *
 * PATCH  /api/alerts/line/:id  - update alert rule / pause-resume
 * DELETE /api/alerts/line/:id  - remove the alert (and its DrawingAlert)
 *
 * `:id` is the DrawingAlert id. Ownership is checked via drawing.userId. Both
 * publish `alerts:changed` for the Phase 4 worker.
 *
 * @module app/api/alerts/line/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { AlertUpdateZ } from '@/lib/drawing/schema';
import { publishAlertsChanged } from '@/lib/drawing/invalidate';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface ApiResponse {
  success: boolean;
  alert?: unknown;
  error?: string;
  message?: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // V8: line alerts are PRO-exclusive — FREE users (e.g. after downgrade)
    // cannot modify or re-enable them; DELETE remains available for cleanup.
    if (((session.user.tier as string) || 'FREE') !== 'PRO') {
      return NextResponse.json(
        {
          success: false,
          error: 'Line alerts are a PRO feature',
          message:
            'Your plan cannot modify line alerts. Upgrade to PRO, or delete this alert.',
        },
        { status: 403 }
      );
    }

    const { id } = await params;
    const existing = await prisma.drawingAlert.findUnique({
      where: { id },
      include: { drawing: true },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Not found' },
        { status: 404 }
      );
    }
    const draw = existing.drawing;
    if (!draw || draw.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = AlertUpdateZ.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid input',
          message: parsed.error.errors[0]?.message ?? 'Invalid request data',
        },
        { status: 400 }
      );
    }
    const d = parsed.data;

    const alert = await prisma.$transaction(async (tx) => {
      await tx.drawingAlert.update({
        where: { id },
        data: {
          ...(d.direction !== undefined ? { direction: d.direction } : {}),
          ...(d.tolerance !== undefined ? { tolerance: d.tolerance } : {}),
          ...(d.cooldownSec !== undefined
            ? { cooldownSec: d.cooldownSec }
            : {}),
          ...(d.oneShot !== undefined ? { oneShot: d.oneShot } : {}),
        },
      });
      if (d.name !== undefined || d.isActive !== undefined) {
        await tx.alert.update({
          where: { id: existing.alertId },
          data: {
            ...(d.name !== undefined ? { name: d.name } : {}),
            ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
          },
        });
      }
      return tx.drawingAlert.findUnique({
        where: { id },
        include: { alert: true, drawing: true },
      });
    });

    await publishAlertsChanged({
      symbol: draw.symbol,
      timeframe: draw.timeframe,
      alertId: existing.alertId,
      drawingId: existing.drawingId,
      reason: 'alert_updated',
    });

    return NextResponse.json({ success: true, alert }, { status: 200 });
  } catch (error) {
    console.error('PATCH /api/alerts/line/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update line alert' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const existing = await prisma.drawingAlert.findUnique({
      where: { id },
      include: { drawing: true },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Not found' },
        { status: 404 }
      );
    }
    const draw = existing.drawing;
    if (!draw || draw.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Deleting the Alert cascades to its DrawingAlert.
    await prisma.alert.delete({ where: { id: existing.alertId } });

    await publishAlertsChanged({
      symbol: draw.symbol,
      timeframe: draw.timeframe,
      alertId: existing.alertId,
      drawingId: existing.drawingId,
      reason: 'alert_deleted',
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('DELETE /api/alerts/line/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete line alert' },
      { status: 500 }
    );
  }
}
