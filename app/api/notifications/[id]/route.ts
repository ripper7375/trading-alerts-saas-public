import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROUTE PARAMS TYPE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface RouteContext {
  params: Promise<{ id: string }>;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET HANDLER - Get single notification
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/notifications/[id] - Get notification details
 *
 * @param request - Next.js request object
 * @param context - Route context containing params
 * @returns Single notification object
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'You must be logged in to view notifications',
        },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { id } = await context.params;

    // Fetch notification
    const notification = await prisma.notification.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        type: true,
        title: true,
        body: true,
        priority: true,
        read: true,
        readAt: true,
        link: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!notification) {
      return NextResponse.json(
        { error: 'Not found', message: 'Notification not found' },
        { status: 404 }
      );
    }

    // Ownership check - users can only access their own notifications
    if (notification.userId !== userId) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'You do not have permission to access this notification',
        },
        { status: 403 }
      );
    }

    return NextResponse.json(notification);
  } catch (error) {
    console.error('GET /api/notifications/[id] error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        error: 'Failed to fetch notification',
        message: 'An error occurred while fetching the notification',
      },
      { status: 500 }
    );
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DELETE HANDLER - Delete notification
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * DELETE /api/notifications/[id] - Delete notification
 *
 * @param request - Next.js request object
 * @param context - Route context containing params
 * @returns Success status
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'You must be logged in to delete notifications',
        },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { id } = await context.params;

    // Fetch notification to verify ownership
    const notification = await prisma.notification.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!notification) {
      return NextResponse.json(
        { error: 'Not found', message: 'Notification not found' },
        { status: 404 }
      );
    }

    // Ownership check
    if (notification.userId !== userId) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'You do not have permission to delete this notification',
        },
        { status: 403 }
      );
    }

    // Delete notification
    await prisma.notification.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    console.error('DELETE /api/notifications/[id] error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        error: 'Failed to delete notification',
        message: 'An error occurred while deleting the notification',
      },
      { status: 500 }
    );
  }
}
