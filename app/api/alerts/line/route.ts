/**
 * Line-touch alerts API
 *
 * GET  /api/alerts/line?symbol=&timeframe=  - list the user's line alerts
 * POST /api/alerts/line                      - attach an alert to a drawn line
 *
 * The targetLevel is validated against the drawing's available alert levels
 * (shared geometry `levelsForMark`), so the API and chart never drift. TEXT
 * drawings are rejected (not alertable). Creates Alert + DrawingAlert atomically
 * and publishes `alerts:changed` for the Phase 4 worker.
 *
 * @module app/api/alerts/line/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { levelsForMark } from '@/components/charts/drawing/geometry';
import type { MarkSnapshot } from '@/components/charts/drawing/geometry';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { AlertAttachZ } from '@/lib/drawing/schema';
import { publishAlertsChanged } from '@/lib/drawing/invalidate';
import { type Tier } from '@/lib/tier-config';
import { getAlertLimit } from '@/lib/tier-validation';

interface ApiResponse {
  success: boolean;
  alerts?: unknown[];
  alert?: unknown;
  error?: string;
  message?: string;
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') ?? undefined;
    const timeframe = searchParams.get('timeframe') ?? undefined;

    const alerts = await prisma.drawingAlert.findMany({
      where: {
        drawing: {
          userId: session.user.id,
          ...(symbol ? { symbol } : {}),
          ...(timeframe ? { timeframe } : {}),
        },
      },
      include: { alert: true, drawing: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, alerts }, { status: 200 });
  } catch (error) {
    console.error('GET /api/alerts/line error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch line alerts' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = AlertAttachZ.safeParse(body);
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

    const {
      drawingId,
      targetLevel,
      direction,
      tolerance,
      cooldownSec,
      oneShot,
      name,
    } = parsed.data;

    const drawing = await prisma.drawing.findUnique({
      where: { id: drawingId },
    });
    if (!drawing) {
      return NextResponse.json(
        { success: false, error: 'Drawing not found' },
        { status: 404 }
      );
    }
    if (drawing.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Validate the target level against the drawing's available levels.
    const snapshot = {
      id: drawing.id,
      type: drawing.type,
      anchors: drawing.anchors,
      style: drawing.style,
    } as unknown as MarkSnapshot;
    const levelIds = levelsForMark(snapshot).map((l) => l.id);

    if (levelIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not alertable',
          message: `Drawings of type ${drawing.type} cannot have alerts.`,
        },
        { status: 400 }
      );
    }
    if (!levelIds.includes(targetLevel)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid target level',
          message: `targetLevel must be one of: ${levelIds.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Alert quota by tier.
    const tier = (session.user.tier as Tier) || 'FREE';
    const limit = getAlertLimit(tier);
    const current = await prisma.alert.count({
      where: { userId: session.user.id },
    });
    if (current >= limit) {
      return NextResponse.json(
        {
          success: false,
          error: 'Alert limit reached',
          message: `${tier} tier allows ${limit} alerts.${
            tier === 'FREE' ? ' Upgrade to PRO for more.' : ''
          }`,
        },
        { status: 403 }
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const alert = await tx.alert.create({
        data: {
          userId: session.user.id,
          name: name ?? null,
          symbol: drawing.symbol,
          timeframe: drawing.timeframe,
          alertType: 'PRICE_TOUCH_LINE',
          condition: JSON.stringify({
            targetLevel,
            direction,
            tolerance,
            cooldownSec,
            oneShot,
          }),
          isActive: true,
        },
      });
      const drawingAlert = await tx.drawingAlert.create({
        data: {
          drawingId,
          alertId: alert.id,
          targetLevel,
          direction,
          tolerance,
          cooldownSec,
          oneShot,
        },
        include: { alert: true, drawing: true },
      });
      return drawingAlert;
    });

    await publishAlertsChanged({
      symbol: drawing.symbol,
      timeframe: drawing.timeframe,
      alertId: created.alertId,
      drawingId: drawing.id,
      reason: 'alert_created',
    });

    return NextResponse.json(
      { success: true, alert: created },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/alerts/line error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create line alert' },
      { status: 500 }
    );
  }
}
