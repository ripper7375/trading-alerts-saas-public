/**
 * Watchlist Reorder API Route
 *
 * POST /api/watchlist/reorder - Reorder watchlist items
 *
 * @module app/api/watchlist/reorder/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES & SCHEMAS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const reorderSchema = z.object({
  itemIds: z.array(z.string()).min(1, 'At least one item ID is required'),
});

interface ReorderResponse {
  success: boolean;
  message?: string;
  error?: string;
  updatedCount?: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST HANDLER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * POST /api/watchlist/reorder
 *
 * Reorders watchlist items based on the provided array of item IDs.
 * The order in the array determines the new order (index = order value).
 * Validates ownership of all items before updating.
 *
 * @param request - Request with { itemIds: string[] }
 * @returns 200: Success with updated count
 * @returns 400: Invalid input
 * @returns 401: Unauthorized
 * @returns 403: Forbidden (items not owned by user)
 * @returns 500: Internal server error
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ReorderResponse>> {
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
          message: 'You must be logged in to reorder watchlist items',
        },
        { status: 401 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 2: Parse and Validate Input
    //───────────────────────────────────────────────────────
    const body = await request.json();
    const validation = reorderSchema.safeParse(body);

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

    const { itemIds } = validation.data;

    //───────────────────────────────────────────────────────
    // STEP 3: Fetch All Items to Validate Ownership
    //───────────────────────────────────────────────────────
    const items = await prisma.watchlistItem.findMany({
      where: {
        id: { in: itemIds },
      },
      select: {
        id: true,
        userId: true,
      },
    });

    // Check if all items exist
    if (items.length !== itemIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid items',
          message: 'One or more watchlist items were not found',
        },
        { status: 400 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 4: Ownership Validation
    //───────────────────────────────────────────────────────
    const unauthorizedItems = items.filter(
      (item: { id: string; userId: string }) => item.userId !== session.user.id
    );

    if (unauthorizedItems.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden',
          message: 'You do not have permission to reorder some of these items',
        },
        { status: 403 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 5: Update Order for Each Item
    //───────────────────────────────────────────────────────
    const updatePromises = itemIds.map((id, index) =>
      prisma.watchlistItem.update({
        where: { id },
        data: { order: index },
      })
    );

    await Promise.all(updatePromises);

    //───────────────────────────────────────────────────────
    // STEP 6: Return Success Response
    //───────────────────────────────────────────────────────
    return NextResponse.json(
      {
        success: true,
        message: 'Watchlist items reordered successfully',
        updatedCount: itemIds.length,
      },
      { status: 200 }
    );
  } catch (error) {
    //───────────────────────────────────────────────────────
    // Error Handling
    //───────────────────────────────────────────────────────
    console.error('POST /api/watchlist/reorder error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to reorder watchlist items',
        message: 'An error occurred while reordering. Please try again.',
      },
      { status: 500 }
    );
  }
}
