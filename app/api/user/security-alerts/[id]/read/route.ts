/**
 * Security Alert Mark-as-Read API
 *
 * POST - Mark a specific security alert as read.
 *
 * @module app/api/user/security-alerts/[id]/read/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { shouldUseOperationServiceForUserSessions } from '@/lib/operation-service/flags';
import {
  forwardRequestToOperationService,
  OperationServiceError,
} from '@/lib/operation-service/write-routes';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/user/security-alerts/[id]/read
 *
 * Marks a specific security alert as read. Ownership-scoped: a
 * non-existent id and someone else's alert both 404 -- no id-enumeration
 * surface, matching operation-service's
 * `UsersService.markSecurityAlertRead` convention.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: 'Alert ID is required' },
        { status: 400 }
      );
    }

    if (shouldUseOperationServiceForUserSessions()) {
      const { status: opStatus, body } = await forwardRequestToOperationService(
        request,
        `/user/security-alerts/${id}/read`
      );
      return NextResponse.json(body, { status: opStatus });
    }

    const result = await prisma.securityAlert.updateMany({
      where: { id, userId: session.user.id, read: false },
      data: { read: true, readAt: new Date() },
    });

    if (result.count === 0) {
      const existing = await prisma.securityAlert.findFirst({
        where: { id, userId: session.user.id },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: 'Security alert not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        alreadyRead: true,
        message: 'Security alert was already marked as read',
      });
    }

    return NextResponse.json({
      success: true,
      alreadyRead: false,
      message: 'Security alert marked as read',
    });
  } catch (error) {
    if (error instanceof OperationServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    console.error('[Security Alerts API] Error marking alert read:', error);
    return NextResponse.json(
      { error: 'Failed to mark security alert as read' },
      { status: 500 }
    );
  }
}
