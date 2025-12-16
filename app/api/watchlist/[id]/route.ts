/**
 * Watchlist Item Detail API Route
 *
 * GET /api/watchlist/[id] - Get single watchlist item
 * PATCH /api/watchlist/[id] - Update watchlist item (order)
 * DELETE /api/watchlist/[id] - Delete watchlist item
 *
 * @module app/api/watchlist/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES & SCHEMAS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const updateItemSchema = z.object({
  order: z.number().int().min(0).optional(),
});

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

interface ItemResponse {
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

interface DeleteResponse {
  success: boolean;
  message?: string;
  error?: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET HANDLER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/watchlist/[id]
 *
 * Returns a single watchlist item by ID.
 * Validates ownership before returning.
 *
 * @returns 200: Item data
 * @returns 401: Unauthorized
 * @returns 403: Forbidden (not owner)
 * @returns 404: Item not found
 * @returns 500: Internal server error
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ItemResponse>> {
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
          message: 'You must be logged in to view watchlist items',
        },
        { status: 401 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 2: Get Item ID
    //───────────────────────────────────────────────────────
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request',
          message: 'Item ID is required',
        },
        { status: 400 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 3: Fetch Item
    //───────────────────────────────────────────────────────
    const item = await prisma.watchlistItem.findUnique({
      where: { id },
    });

    if (!item) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not found',
          message: 'Watchlist item not found',
        },
        { status: 404 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 4: Ownership Check
    //───────────────────────────────────────────────────────
    if (item.userId !== session.user.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden',
          message: 'You do not have permission to view this item',
        },
        { status: 403 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 5: Return Item
    //───────────────────────────────────────────────────────
    return NextResponse.json(
      {
        success: true,
        item: {
          id: item.id,
          symbol: item.symbol,
          timeframe: item.timeframe,
          order: item.order,
          createdAt: item.createdAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/watchlist/[id] error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch watchlist item',
        message: 'An error occurred. Please try again.',
      },
      { status: 500 }
    );
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PATCH HANDLER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * PATCH /api/watchlist/[id]
 *
 * Updates a watchlist item (currently only order field).
 * Validates ownership before updating.
 *
 * @param request - Request with { order?: number }
 * @returns 200: Updated item
 * @returns 400: Invalid input
 * @returns 401: Unauthorized
 * @returns 403: Forbidden (not owner)
 * @returns 404: Item not found
 * @returns 500: Internal server error
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ItemResponse>> {
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
          message: 'You must be logged in to update watchlist items',
        },
        { status: 401 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 2: Get Item ID
    //───────────────────────────────────────────────────────
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request',
          message: 'Item ID is required',
        },
        { status: 400 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 3: Parse and Validate Input
    //───────────────────────────────────────────────────────
    const body = await request.json();
    const validation = updateItemSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid input',
          message: validation.error.errors[0]?.message || 'Invalid request data',
        },
        { status: 400 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 4: Fetch Existing Item
    //───────────────────────────────────────────────────────
    const existingItem = await prisma.watchlistItem.findUnique({
      where: { id },
    });

    if (!existingItem) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not found',
          message: 'Watchlist item not found',
        },
        { status: 404 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 5: Ownership Check
    //───────────────────────────────────────────────────────
    if (existingItem.userId !== session.user.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden',
          message: 'You do not have permission to update this item',
        },
        { status: 403 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 6: Update Item
    //───────────────────────────────────────────────────────
    const updatedItem = await prisma.watchlistItem.update({
      where: { id },
      data: {
        order: validation.data.order ?? existingItem.order,
      },
    });

    //───────────────────────────────────────────────────────
    // STEP 7: Return Updated Item
    //───────────────────────────────────────────────────────
    return NextResponse.json(
      {
        success: true,
        item: {
          id: updatedItem.id,
          symbol: updatedItem.symbol,
          timeframe: updatedItem.timeframe,
          order: updatedItem.order,
          createdAt: updatedItem.createdAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('PATCH /api/watchlist/[id] error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update watchlist item',
        message: 'An error occurred. Please try again.',
      },
      { status: 500 }
    );
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DELETE HANDLER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * DELETE /api/watchlist/[id]
 *
 * Deletes a watchlist item.
 * Validates ownership before deleting.
 *
 * @returns 200: Success message
 * @returns 401: Unauthorized
 * @returns 403: Forbidden (not owner)
 * @returns 404: Item not found
 * @returns 500: Internal server error
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<DeleteResponse>> {
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
          message: 'You must be logged in to delete watchlist items',
        },
        { status: 401 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 2: Get Item ID
    //───────────────────────────────────────────────────────
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request',
          message: 'Item ID is required',
        },
        { status: 400 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 3: Fetch Existing Item
    //───────────────────────────────────────────────────────
    const existingItem = await prisma.watchlistItem.findUnique({
      where: { id },
    });

    if (!existingItem) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not found',
          message: 'Watchlist item not found',
        },
        { status: 404 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 4: Ownership Check
    //───────────────────────────────────────────────────────
    if (existingItem.userId !== session.user.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden',
          message: 'You do not have permission to delete this item',
        },
        { status: 403 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 5: Delete Item
    //───────────────────────────────────────────────────────
    await prisma.watchlistItem.delete({
      where: { id },
    });

    //───────────────────────────────────────────────────────
    // STEP 6: Return Success Response
    //───────────────────────────────────────────────────────
    return NextResponse.json(
      {
        success: true,
        message: 'Watchlist item deleted successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('DELETE /api/watchlist/[id] error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete watchlist item',
        message: 'An error occurred. Please try again.',
      },
      { status: 500 }
    );
  }
}
