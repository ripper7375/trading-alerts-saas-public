/**
 * Drawings API
 *
 * GET  /api/drawings?symbol=&timeframe=  - list the user's drawings
 * POST /api/drawings                      - create a drawing
 *
 * Auth required; tier-gated by symbol/timeframe access and a per-tier drawing
 * quota. Geometry is stored as price/time anchors so the server can recompute
 * levels headlessly (Phase 4).
 *
 * @module app/api/drawings/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '.prisma/non-market-client';
import { DRAWING_LIMITS, DrawingCreateZ } from '@/lib/drawing/schema';
import { type Tier } from '@/lib/tier-config';
import {
  canAccessSymbol,
  validateTimeframeAccess,
} from '@/lib/tier-validation';

interface ApiResponse {
  success: boolean;
  drawings?: unknown[];
  drawing?: unknown;
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

    const drawings = await prisma.drawing.findMany({
      where: {
        userId: session.user.id,
        ...(symbol ? { symbol } : {}),
        ...(timeframe ? { timeframe } : {}),
      },
      include: { alerts: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, drawings }, { status: 200 });
  } catch (error) {
    console.error('GET /api/drawings error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch drawings' },
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
    const parsed = DrawingCreateZ.safeParse(body);
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

    const { symbol, timeframe, type, anchors, style } = parsed.data;
    const tier = (session.user.tier as Tier) || 'FREE';

    if (!canAccessSymbol(tier, symbol)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Symbol access denied',
          message: `Symbol ${symbol} is not available in your ${tier} tier.`,
        },
        { status: 403 }
      );
    }

    const tf = validateTimeframeAccess(tier, timeframe);
    if (!tf.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Timeframe access denied',
          message: tf.reason ?? `Timeframe ${timeframe} requires PRO tier.`,
        },
        { status: 403 }
      );
    }

    const count = await prisma.drawing.count({
      where: { userId: session.user.id },
    });
    const limit = DRAWING_LIMITS[tier] ?? DRAWING_LIMITS.FREE;
    if (count >= limit) {
      return NextResponse.json(
        {
          success: false,
          error: 'Drawing limit reached',
          message: `${tier} tier allows ${limit} drawings.${
            tier === 'FREE' ? ' Upgrade to PRO for more.' : ''
          }`,
        },
        { status: 403 }
      );
    }

    const drawing = await prisma.drawing.create({
      data: {
        userId: session.user.id,
        symbol,
        timeframe,
        type,
        anchors,
        style: style as Prisma.InputJsonValue,
      },
      include: { alerts: true },
    });

    return NextResponse.json({ success: true, drawing }, { status: 201 });
  } catch (error) {
    console.error('POST /api/drawings error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create drawing' },
      { status: 500 }
    );
  }
}
