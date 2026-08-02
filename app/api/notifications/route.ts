import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { shouldUseOperationServiceForNotifications } from '@/lib/operation-service/flags';
import {
  forwardRequestToOperationService,
  OperationServiceError,
} from '@/lib/operation-service/write-routes';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INPUT VALIDATION SCHEMAS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const querySchema = z.object({
  status: z.enum(['all', 'unread', 'read']).default('all'),
  type: z.enum(['ALERT', 'SUBSCRIPTION', 'PAYMENT', 'SYSTEM']).optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(10).max(50).default(20),
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET HANDLER - List user notifications with pagination and filters
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/notifications - List user notifications
 *
 * Query params:
 * - status: 'all' | 'unread' | 'read' (default: 'all')
 * - type: 'ALERT' | 'SUBSCRIPTION' | 'PAYMENT' | 'SYSTEM' (optional)
 * - page: number (default: 1)
 * - pageSize: number (default: 20, max: 50)
 *
 * @returns Paginated notification list with unread count
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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

    // Session 4B-9: when the flag is on, operation-service's
    // NotificationsController (Session 4B-9 PORT) already re-implements the
    // list/filter logic below against the same schema — forward instead.
    if (shouldUseOperationServiceForNotifications()) {
      const { status: opStatus, body } = await forwardRequestToOperationService(
        request,
        `/notifications${new URL(request.url).search}`
      );
      return NextResponse.json(body, { status: opStatus });
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const validation = querySchema.safeParse(searchParams);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          message: 'Please check your query parameters',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { status, type, page, pageSize } = validation.data;

    // Build where clause
    const where: {
      userId: string;
      read?: boolean;
      type?: 'ALERT' | 'SUBSCRIPTION' | 'PAYMENT' | 'SYSTEM';
    } = {
      userId,
    };

    if (status === 'unread') {
      where.read = false;
    } else if (status === 'read') {
      where.read = true;
    }

    if (type) {
      where.type = type;
    }

    // Get total count for pagination
    const total = await prisma.notification.count({ where });

    // Get notifications with pagination
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
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
      },
    });

    // Get unread count
    const unreadCount = await prisma.notification.count({
      where: { userId, read: false },
    });

    return NextResponse.json({
      notifications,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      unreadCount,
    });
  } catch (error) {
    if (error instanceof OperationServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    console.error('GET /api/notifications error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        error: 'Failed to fetch notifications',
        message: 'An error occurred while fetching notifications',
      },
      { status: 500 }
    );
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST HANDLER - Mark all notifications as read
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * POST /api/notifications - Mark all notifications as read
 *
 * @param request - Next.js request object (added Session 4B-9; needed for
 * forwarding to operation-service — the SOURCE handler this was ported from
 * took no parameter at all, since it never read the request)
 * @returns Success status with count of updated notifications
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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

    // Session 4B-9: when the flag is on, operation-service's
    // NotificationsController (Session 4B-9 PORT) already re-implements the
    // mark-all-read logic below against the same schema — forward instead.
    if (shouldUseOperationServiceForNotifications()) {
      const { status: opStatus, body } = await forwardRequestToOperationService(
        request,
        '/notifications'
      );
      return NextResponse.json(body, { status: opStatus });
    }

    // Mark all unread notifications as read
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
      message: `${result.count} notification(s) marked as read`,
    });
  } catch (error) {
    if (error instanceof OperationServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    console.error('POST /api/notifications error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        error: 'Failed to mark all as read',
        message: 'An error occurred while updating notifications',
      },
      { status: 500 }
    );
  }
}
