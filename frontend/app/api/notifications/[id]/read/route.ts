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
// POST HANDLER - Mark notification as read
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * POST /api/notifications/[id]/read - Mark notification as read
 *
 * Updates the notification's read status to true and sets readAt timestamp.
 *
 * @param request - Next.js request object
 * @param context - Route context containing params
 * @returns Updated notification object
 */
export async function POST(
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
          message: 'You must be logged in to update notifications',
        },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { id } = await context.params;

    // Fetch notification to verify ownership
    const notification = await prisma.notification.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        read: true,
      },
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
          message: 'You do not have permission to update this notification',
        },
        { status: 403 }
      );
    }

    // If already read, just return the notification
    if (notification.read) {
      const existing = await prisma.notification.findUnique({
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

      return NextResponse.json({
        notification: existing,
        alreadyRead: true,
        message: 'Notification was already marked as read',
      });
    }

    // Mark notification as read
    const updated = await prisma.notification.update({
      where: { id },
      data: {
        read: true,
        readAt: new Date(),
      },
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

    return NextResponse.json({
      notification: updated,
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    console.error('POST /api/notifications/[id]/read error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        error: 'Failed to mark as read',
        message: 'An error occurred while updating the notification',
      },
      { status: 500 }
    );
  }
}
