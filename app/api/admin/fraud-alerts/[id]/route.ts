import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth/auth-options';
import {
  updateFraudAlertStatus,
  blockUserFromFraudAlert,
} from '@/lib/fraud/fraud-detection.service';
import { prisma } from '@/lib/db/prisma';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION SCHEMAS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const updateSchema = z.object({
  status: z.enum(['PENDING', 'REVIEWED', 'DISMISSED', 'BLOCKED']),
  resolution: z.string().optional(),
  notes: z.string().optional(),
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET HANDLER - Get single fraud alert
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/admin/fraud-alerts/[id] - Get single fraud alert by ID
 *
 * @returns 200: Fraud alert details
 * @returns 401: Unauthorized
 * @returns 403: Forbidden
 * @returns 404: Alert not found
 * @returns 500: Server error
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const alert = await prisma.fraudAlert.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            tier: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    // Cast to access fields that will exist after prisma generate
    const alertData = alert as typeof alert & {
      amount?: { toString(): string } | null;
      createdAt: Date;
      updatedAt: Date;
      reviewedAt?: Date | null;
    };

    return NextResponse.json({
      alert: {
        ...alert,
        amount: alertData.amount?.toString() || null,
        createdAt: alertData.createdAt.toISOString(),
        updatedAt: alertData.updatedAt.toISOString(),
        reviewedAt: alertData.reviewedAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('Failed to fetch fraud alert:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fraud alert' },
      { status: 500 }
    );
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PATCH HANDLER - Update fraud alert status
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * PATCH /api/admin/fraud-alerts/[id] - Update fraud alert status
 *
 * Body:
 * - status: New status (PENDING/REVIEWED/DISMISSED/BLOCKED)
 * - resolution: Resolution type (optional)
 * - notes: Admin notes (optional)
 *
 * @returns 200: Updated fraud alert
 * @returns 400: Invalid request body
 * @returns 401: Unauthorized
 * @returns 403: Forbidden
 * @returns 404: Alert not found
 * @returns 500: Server error
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const validatedBody = updateSchema.safeParse(body);
    if (!validatedBody.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validatedBody.error.errors },
        { status: 400 }
      );
    }

    const { status, resolution, notes } = validatedBody.data;

    // Check if alert exists
    const existingAlert = await prisma.fraudAlert.findUnique({
      where: { id },
    });

    if (!existingAlert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    // If blocking user, use special function
    if (status === 'BLOCKED') {
      await blockUserFromFraudAlert(id, session.user.id, notes);
    } else {
      await updateFraudAlertStatus(
        id,
        status,
        session.user.id,
        resolution,
        notes
      );
    }

    // Fetch updated alert
    const updatedAlert = await prisma.fraudAlert.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    // Cast to access fields that will exist after prisma generate
    const alertData = updatedAlert as typeof updatedAlert & {
      amount?: { toString(): string } | null;
      createdAt: Date;
      updatedAt: Date;
      reviewedAt?: Date | null;
    } | null;

    return NextResponse.json({
      alert: {
        ...updatedAlert,
        amount: alertData?.amount?.toString() || null,
        createdAt: alertData?.createdAt.toISOString(),
        updatedAt: alertData?.updatedAt.toISOString(),
        reviewedAt: alertData?.reviewedAt?.toISOString() || null,
      },
      message: `Alert ${status.toLowerCase()} successfully`,
    });
  } catch (error) {
    console.error('Failed to update fraud alert:', error);
    return NextResponse.json(
      { error: 'Failed to update fraud alert' },
      { status: 500 }
    );
  }
}
