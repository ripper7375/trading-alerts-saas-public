import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { shouldUseOperationServiceForUserSessions } from '@/lib/operation-service/flags';
import {
  forwardRequestToOperationService,
  OperationServiceError,
} from '@/lib/operation-service/write-routes';

/**
 * Security Alerts API Route
 *
 * GET: Fetch the authenticated user's security alerts (paginated).
 *
 * A1-9/A2-12 (post-6-12 gap-matrix correction): `SecurityAlert` has had real
 * writers since Session 3-4 (password change, 2FA enable/disable, new-device
 * login) with no UI-reachable reader anywhere until this route.
 */

interface SecurityAlertItem {
  id: string;
  type: string;
  title: string;
  message: string;
  ipAddress: string | null;
  deviceInfo: string | null;
  location: string | null;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
}

/**
 * GET /api/user/security-alerts
 * Fetch the authenticated user's security alerts.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (shouldUseOperationServiceForUserSessions()) {
      const { status: opStatus, body: opBody } =
        await forwardRequestToOperationService(
          request,
          `/user/security-alerts${new URL(request.url).search}`
        );
      return NextResponse.json(opBody, { status: opStatus });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const alerts: SecurityAlertItem[] = await prisma.securityAlert.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        ipAddress: true,
        deviceInfo: true,
        location: true,
        read: true,
        readAt: true,
        createdAt: true,
      },
    });

    const totalCount = await prisma.securityAlert.count({
      where: { userId: session.user.id },
    });

    return NextResponse.json({
      alerts,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    if (error instanceof OperationServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    console.error('[GET /api/user/security-alerts] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch security alerts' },
      { status: 500 }
    );
  }
}
