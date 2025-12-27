import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

/**
 * Bulk Actions API for Fraud Alerts
 *
 * Handles bulk operations on fraud alerts:
 * - review: Mark alerts as REVIEWED
 * - dismiss: Mark alerts as DISMISSED
 * - delete: Remove alerts from database
 *
 * @module app/api/admin/fraud-alerts/bulk
 */

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const bulkActionSchema = z.object({
  action: z.enum(['review', 'dismiss', 'delete']),
  alertIds: z.array(z.string().uuid()).min(1, 'At least one alert ID is required'),
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HANDLERS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * POST /api/admin/fraud-alerts/bulk
 *
 * Perform bulk actions on fraud alerts.
 * Requires admin role.
 *
 * @param request - Request with action and alertIds in body
 * @returns Updated count of affected alerts
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parseResult = bulkActionSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { action, alertIds } = parseResult.data;

    // Perform the bulk action
    let result: { count: number };

    switch (action) {
      case 'review':
        result = await prisma.fraudAlert.updateMany({
          where: { id: { in: alertIds } },
          data: { status: 'REVIEWED' },
        });
        break;

      case 'dismiss':
        result = await prisma.fraudAlert.updateMany({
          where: { id: { in: alertIds } },
          data: { status: 'DISMISSED' },
        });
        break;

      case 'delete':
        result = await prisma.fraudAlert.deleteMany({
          where: { id: { in: alertIds } },
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      updated: result.count,
      action,
    });
  } catch (error) {
    console.error('Bulk fraud alert action failed:', error);
    return NextResponse.json(
      { error: 'Failed to perform bulk action' },
      { status: 500 }
    );
  }
}
