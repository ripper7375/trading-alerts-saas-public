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
import { shouldUseOperationServiceForDrawings } from '@/lib/operation-service/flags';
import {
  forwardRequestToOperationService,
  OperationServiceError,
} from '@/lib/operation-service/write-routes';
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

    // Session 4B-8: when the flag is on, operation-service's
    // DrawingsController (Session 4B-8 PORT) already re-implements the
    // list/filter logic below against the same schema — forward instead.
    if (shouldUseOperationServiceForDrawings()) {
      const { status: opStatus, body } =
        await forwardRequestToOperationService<ApiResponse>(
          request,
          `/drawings${new URL(request.url).search}`
        );
      return NextResponse.json(body, { status: opStatus });
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
    if (error instanceof OperationServiceError) {
      return NextResponse.json(error.body as ApiResponse, {
        status: error.status,
      });
    }
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

    // Session 4B-8: when the flag is on, operation-service's
    // DrawingsController (Session 4B-8 PORT) already re-implements every
    // check below (symbol/timeframe access, quota, validation) against the
    // same schema — forward the raw request there instead of running it
    // twice.
    if (shouldUseOperationServiceForDrawings()) {
      const { status: opStatus, body: opBody } =
        await forwardRequestToOperationService<ApiResponse>(
          request,
          '/drawings'
        );
      return NextResponse.json(opBody, { status: opStatus });
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

    if (!canAccessSymbol(symbol, tier)) {
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
    if (error instanceof OperationServiceError) {
      return NextResponse.json(error.body as ApiResponse, {
        status: error.status,
      });
    }
    console.error('POST /api/drawings error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create drawing' },
      { status: 500 }
    );
  }
}
