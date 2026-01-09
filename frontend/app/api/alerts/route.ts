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
  FREE_TIER_CONFIG,
  PRO_TIER_CONFIG,
  FREE_SYMBOLS,
  PRO_SYMBOLS,
  FREE_TIMEFRAMES,
  PRO_TIMEFRAMES,
  type Tier,
} from '@/lib/tier-config';

/**
 * Zod schema for creating an alert
 */
const createAlertSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required'),
  timeframe: z.string().min(1, 'Timeframe is required'),
  conditionType: z.enum(['price_above', 'price_below', 'price_equals'], {
    errorMap: () => ({ message: 'Invalid condition type' }),
  }),
  targetValue: z.number().positive('Target value must be positive'),
  name: z.string().max(100).optional(),
});

type CreateAlertInput = z.infer<typeof createAlertSchema>;

/**
 * Check if symbol is allowed for tier
 */
function canAccessSymbol(tier: Tier, symbol: string): boolean {
  const allowedSymbols = tier === 'PRO' ? PRO_SYMBOLS : FREE_SYMBOLS;
  return (allowedSymbols as readonly string[]).includes(symbol);
}

/**
 * Check if timeframe is allowed for tier
 */
function canAccessTimeframe(tier: Tier, timeframe: string): boolean {
  const allowedTimeframes = tier === 'PRO' ? PRO_TIMEFRAMES : FREE_TIMEFRAMES;
  return (allowedTimeframes as readonly string[]).includes(timeframe);
}

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
 * Create a new alert with tier validation
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

    // Validate input
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
    const tier = (session.user.tier as Tier) || 'FREE';

    // Validate symbol access
    if (!canAccessSymbol(tier, symbol)) {
      return NextResponse.json(
        {
          error: 'Symbol not allowed',
          message: `${symbol} is not available on the ${tier} tier`,
          code: 'SYMBOL_NOT_ALLOWED',
          upgradeUrl: '/pricing',
        },
        { status: 403 }
      );
    }

    // Validate timeframe access
    if (!canAccessTimeframe(tier, timeframe)) {
      return NextResponse.json(
        {
          error: 'Timeframe not allowed',
          message: `${timeframe} is not available on the ${tier} tier`,
          code: 'TIMEFRAME_NOT_ALLOWED',
          upgradeUrl: '/pricing',
        },
        { status: 403 }
      );
    }

    // Check alert limit
    const limit =
      tier === 'PRO' ? PRO_TIER_CONFIG.maxAlerts : FREE_TIER_CONFIG.maxAlerts;

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
          message: `You have reached your ${tier} tier limit of ${limit} alerts`,
          code: 'ALERT_LIMIT_EXCEEDED',
          currentCount: currentAlertCount,
          limit,
          upgradeUrl: '/pricing',
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
