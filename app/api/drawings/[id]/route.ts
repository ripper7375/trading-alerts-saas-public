/**
 * Drawing item API
 *
 * PATCH  /api/drawings/:id  - update anchors/style (ownership-checked)
 * DELETE /api/drawings/:id  - delete a drawing (cascades to its alerts)
 *
 * Both publish `alerts:changed` so the Phase 4 worker rebuilds affected watches
 * (geometry edits change alert level prices).
 *
 * @module app/api/drawings/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '.prisma/non-market-client';
import { DrawingUpdateZ } from '@/lib/drawing/schema';
import { publishAlertsChanged } from '@/lib/drawing/invalidate';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface ApiResponse {
  success: boolean;
  drawing?: unknown;
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

    const { id } = await params;
    const existing = await prisma.drawing.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Not found' },
        { status: 404 }
      );
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = DrawingUpdateZ.safeParse(body);
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

    const drawing = await prisma.drawing.update({
      where: { id },
      data: {
        ...(parsed.data.anchors ? { anchors: parsed.data.anchors } : {}),
        ...(parsed.data.style
          ? { style: parsed.data.style as Prisma.InputJsonValue }
          : {}),
      },
      include: { alerts: true },
    });

    await publishAlertsChanged({
      symbol: drawing.symbol,
      timeframe: drawing.timeframe,
      drawingId: drawing.id,
      reason: 'drawing_updated',
    });

    return NextResponse.json({ success: true, drawing }, { status: 200 });
  } catch (error) {
    console.error('PATCH /api/drawings/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update drawing' },
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
    const existing = await prisma.drawing.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Not found' },
        { status: 404 }
      );
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    await prisma.drawing.delete({ where: { id } });

    await publishAlertsChanged({
      symbol: existing.symbol,
      timeframe: existing.timeframe,
      drawingId: existing.id,
      reason: 'drawing_deleted',
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('DELETE /api/drawings/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete drawing' },
      { status: 500 }
    );
  }
}
