/**
 * Alerts API Route
 *
 * GET: List user's alerts with optional filters
 * POST: Create a new alert with tier validation
 *
 * @module app/api/alerts/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import {
  PRO_TIER_CONFIG,
  SYMBOLS,
  TIMEFRAMES,
  type Tier,
} from '@/lib/tier-config';

/**
 * Zod schema for creating an alert.
 * V8: symbol locked to XAUUSD, timeframe locked to M5/M15.
 */
const createAlertSchema = z.object({
  symbol: z.enum(SYMBOLS, {
    errorMap: () => ({ message: 'Only XAUUSD is supported' }),
  }),
  timeframe: z.enum(TIMEFRAMES, {
    errorMap: () => ({ message: 'Only M5 and M15 timeframes are supported' }),
  }),
  conditionType: z.enum(['price_above', 'price_below', 'price_equals'], {
    errorMap: () => ({ message: 'Invalid condition type' }),
  }),
  targetValue: z.number().positive('Target value must be positive'),
  name: z.string().max(100).optional(),
});

type CreateAlertInput = z.infer<typeof createAlertSchema>;

/**
 * GET /api/alerts
 *
 * List user's alerts with optional status filter
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const symbol = searchParams.get('symbol');

    // Build query filters
    interface WhereClause {
      userId: string;
      isActive?: boolean;
      symbol?: string;
      lastTriggered?: { not: null };
    }

    const where: WhereClause = { userId: session.user.id };

    // Filter by status
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'paused') {
      where.isActive = false;
      where.lastTriggered = { not: null };
    } else if (status === 'triggered') {
      where.lastTriggered = { not: null };
    }

    // Filter by symbol
    if (symbol) {
      where.symbol = symbol;
    }

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        symbol: true,
        timeframe: true,
        condition: true,
        alertType: true,
        isActive: true,
        lastTriggered: true,
        triggerCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('GET /api/alerts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts', code: 'FETCH_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/alerts
 *
 * Create a new alert.
 * V8: Alerts are a PRO-exclusive feature — FREE users are blocked with 403.
 * PRO users may hold up to 100 alerts on XAUUSD M5/M15.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const tier = (session.user.tier as Tier) || 'FREE';

    // V8: strict block — alerts are a PRO feature
    if (tier === 'FREE') {
      return NextResponse.json(
        {
          error: 'Alerts are a PRO feature',
          message: `Price alerts are exclusive to the PRO tier. Upgrade to create up to ${PRO_TIER_CONFIG.maxAlerts} alerts on XAUUSD M5/M15, plus drawing-engine line alerts and multi-timeframe visualization.`,
          code: 'PRO_FEATURE',
          upgradeUrl: '/pricing',
        },
        { status: 403 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'INVALID_JSON' },
        { status: 400 }
      );
    }

    // Validate input (symbol/timeframe enums enforce XAUUSD + M5/M15)
    const validation = createAlertSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          code: 'VALIDATION_ERROR',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { symbol, timeframe, conditionType, targetValue, name } =
      validation.data as CreateAlertInput;

    // Check alert limit (PRO: 100)
    const limit = PRO_TIER_CONFIG.maxAlerts;

    const currentAlertCount = await prisma.alert.count({
      where: {
        userId: session.user.id,
        isActive: true,
      },
    });

    if (currentAlertCount >= limit) {
      return NextResponse.json(
        {
          error: 'Alert limit exceeded',
          message: `You have reached your PRO tier limit of ${limit} alerts`,
          code: 'ALERT_LIMIT_EXCEEDED',
          currentCount: currentAlertCount,
          limit,
        },
        { status: 403 }
      );
    }

    // Create alert condition JSON
    const condition = JSON.stringify({
      type: conditionType,
      targetValue,
    });

    // Create alert
    const alert = await prisma.alert.create({
      data: {
        userId: session.user.id,
        symbol,
        timeframe,
        condition,
        alertType: 'PRICE_ALERT',
        name: name || `${symbol} ${timeframe} Alert`,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        symbol: true,
        timeframe: true,
        condition: true,
        alertType: true,
        isActive: true,
        lastTriggered: true,
        triggerCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        alert,
        message: 'Alert created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/alerts error:', error);
    return NextResponse.json(
      { error: 'Failed to create alert', code: 'CREATE_ERROR' },
      { status: 500 }
    );
  }
}
