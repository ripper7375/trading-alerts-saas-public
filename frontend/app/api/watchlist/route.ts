/**
 * Watchlist API Route
 *
 * GET /api/watchlist - List user's watchlist items
 * POST /api/watchlist - Create new watchlist item
 *
 * Tier-based limits: FREE: 5 items, PRO: 50 items
 *
 * @module app/api/watchlist/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import {
  FREE_TIER_CONFIG,
  PRO_TIER_CONFIG,
  type Tier,
} from '@/lib/tier-config';
import {
  canAccessSymbol,
  validateTimeframeAccess,
} from '@/lib/tier-validation';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES & SCHEMAS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const createItemSchema = z.object({
  watchlistId: z.string().optional(),
  symbol: z.string().min(1, 'Symbol is required'),
  timeframe: z.string().min(1, 'Timeframe is required'),
});

interface WatchlistResponse {
  success: boolean;
  watchlist?: {
    id: string;
    name: string;
    items: Array<{
      id: string;
      symbol: string;
      timeframe: string;
      order: number;
      createdAt: Date;
    }>;
  };
  items?: Array<{
    id: string;
    symbol: string;
    timeframe: string;
    order: number;
    createdAt: Date;
  }>;
  error?: string;
  message?: string;
}

interface CreateItemResponse {
  success: boolean;
  item?: {
    id: string;
    symbol: string;
    timeframe: string;
    order: number;
    createdAt: Date;
  };
  error?: string;
  message?: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET HANDLER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/watchlist
 *
 * Returns the user's watchlist with all items.
 *
 * @returns 200: Watchlist data
 * @returns 401: Unauthorized
 * @returns 500: Internal server error
 */
export async function GET(): Promise<NextResponse<WatchlistResponse>> {
  try {
    //───────────────────────────────────────────────────────
    // STEP 1: Authentication Check
    //───────────────────────────────────────────────────────
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'You must be logged in to view your watchlist',
        },
        { status: 401 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 2: Fetch Watchlist
    //───────────────────────────────────────────────────────
    const watchlist = await prisma.watchlist.findFirst({
      where: { userId: session.user.id },
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
      },
    });

    //───────────────────────────────────────────────────────
    // STEP 3: Return Response
    //───────────────────────────────────────────────────────
    return NextResponse.json(
      {
        success: true,
        watchlist: watchlist
          ? {
              id: watchlist.id,
              name: watchlist.name,
              items: watchlist.items ?? [],
            }
          : undefined,
        items: watchlist?.items ?? [],
      },
      { status: 200 }
    );
  } catch (error) {
    //───────────────────────────────────────────────────────
    // Error Handling
    //───────────────────────────────────────────────────────
    console.error('GET /api/watchlist error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch watchlist',
        message:
          'An error occurred while fetching your watchlist. Please try again.',
      },
      { status: 500 }
    );
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST HANDLER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * POST /api/watchlist
 *
 * Creates a new watchlist item with symbol+timeframe combination.
 * Validates tier limits and access permissions.
 *
 * @param request - Request with { symbol, timeframe, watchlistId? }
 * @returns 201: Created item
 * @returns 400: Invalid input
 * @returns 401: Unauthorized
 * @returns 403: Tier limit reached or access denied
 * @returns 409: Duplicate combination
 * @returns 500: Internal server error
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<CreateItemResponse>> {
  try {
    //───────────────────────────────────────────────────────
    // STEP 1: Authentication Check
    //───────────────────────────────────────────────────────
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'You must be logged in to add watchlist items',
        },
        { status: 401 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 2: Parse and Validate Input
    //───────────────────────────────────────────────────────
    const body = await request.json();
    const validation = createItemSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid input',
          message:
            validation.error.errors[0]?.message || 'Invalid request data',
        },
        { status: 400 }
      );
    }

    const { symbol, timeframe } = validation.data;
    const tier = (session.user.tier as Tier) || 'FREE';

    //───────────────────────────────────────────────────────
    // STEP 3: Validate Symbol Access
    //───────────────────────────────────────────────────────
    if (!canAccessSymbol(tier, symbol)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Symbol access denied',
          message: `Symbol ${symbol} is not available in your ${tier} tier. Upgrade to PRO for access to all 15 symbols.`,
        },
        { status: 403 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 4: Validate Timeframe Access
    //───────────────────────────────────────────────────────
    const timeframeResult = validateTimeframeAccess(tier, timeframe);
    if (!timeframeResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Timeframe access denied',
          message:
            timeframeResult.reason ||
            `Timeframe ${timeframe} requires PRO tier.`,
        },
        { status: 403 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 5: Get or Create Default Watchlist
    //───────────────────────────────────────────────────────
    let watchlist = await prisma.watchlist.findFirst({
      where: { userId: session.user.id },
      include: { items: true },
    });

    if (!watchlist) {
      watchlist = await prisma.watchlist.create({
        data: {
          userId: session.user.id,
          name: 'My Watchlist',
        },
        include: { items: true },
      });
    }

    //───────────────────────────────────────────────────────
    // STEP 6: Check Tier Limit
    //───────────────────────────────────────────────────────
    const currentCount = watchlist.items?.length ?? 0;
    const limit =
      tier === 'PRO'
        ? PRO_TIER_CONFIG.maxWatchlistItems
        : FREE_TIER_CONFIG.maxWatchlistItems;

    if (currentCount >= limit) {
      return NextResponse.json(
        {
          success: false,
          error: 'Watchlist limit reached',
          message: `${tier} tier allows maximum ${limit} watchlist items. ${
            tier === 'FREE'
              ? 'Upgrade to PRO for 50 items.'
              : 'Please remove an item to add more.'
          }`,
        },
        { status: 403 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 7: Check for Duplicate Combination
    //───────────────────────────────────────────────────────
    const existingItem = (watchlist.items ?? []).find(
      (item: { symbol: string; timeframe: string }) =>
        item.symbol === symbol && item.timeframe === timeframe
    );

    if (existingItem) {
      return NextResponse.json(
        {
          success: false,
          error: 'Duplicate combination',
          message:
            'This symbol+timeframe combination already exists in your watchlist.',
        },
        { status: 409 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 8: Create Watchlist Item
    //───────────────────────────────────────────────────────
    const newItem = await prisma.watchlistItem.create({
      data: {
        watchlistId: watchlist.id,
        userId: session.user.id,
        symbol,
        timeframe,
        order: currentCount,
      },
    });

    //───────────────────────────────────────────────────────
    // STEP 9: Return Success Response
    //───────────────────────────────────────────────────────
    return NextResponse.json(
      {
        success: true,
        item: {
          id: newItem.id,
          symbol: newItem.symbol,
          timeframe: newItem.timeframe,
          order: newItem.order,
          createdAt: newItem.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    //───────────────────────────────────────────────────────
    // Error Handling
    //───────────────────────────────────────────────────────
    console.error('POST /api/watchlist error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create watchlist item',
        message: 'An error occurred while adding the item. Please try again.',
      },
      { status: 500 }
    );
  }
}
