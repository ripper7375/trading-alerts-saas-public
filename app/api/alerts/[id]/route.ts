/**
 * Alert Detail API Route
 *
 * GET: Get a single alert by ID
 * PATCH: Update an alert (status, target value)
 * DELETE: Delete an alert (soft delete)
 *
 * @module app/api/alerts/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

/**
 * Zod schema for updating an alert
 */
const updateAlertSchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().max(100).optional(),
  targetValue: z.number().positive().optional(),
});

/**
 * Route params type
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/alerts/[id]
 *
 * Get a single alert by ID with ownership validation
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const alert = await prisma.alert.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        name: true,
        symbol: true,
        timeframe: true,
        condition: true,
        alertType: true,
        isActive: true,
        lastTriggered: true,
        triggerCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!alert) {
      return NextResponse.json(
        { error: 'Alert not found', code: 'ALERT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (alert.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Remove userId from response
    const { userId: _userId, ...alertWithoutUserId } = alert;

    return NextResponse.json({ alert: alertWithoutUserId });
  } catch (error) {
    console.error('GET /api/alerts/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alert', code: 'FETCH_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/alerts/[id]
 *
 * Update an alert (status, name, or target value)
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check if alert exists and belongs to user
    const existingAlert = await prisma.alert.findUnique({
      where: { id },
      select: { userId: true, condition: true },
    });

    if (!existingAlert) {
      return NextResponse.json(
        { error: 'Alert not found', code: 'ALERT_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (existingAlert.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'INVALID_JSON' },
        { status: 400 }
      );
    }

    // Validate input
    const validation = updateAlertSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          code: 'VALIDATION_ERROR',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { isActive, name, targetValue } = validation.data;

    // Build update data
    interface UpdateData {
      isActive?: boolean;
      name?: string;
      condition?: string;
    }

    const updateData: UpdateData = {};

    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive;
    }

    if (name !== undefined) {
      updateData.name = name;
    }

    if (targetValue !== undefined) {
      // Update condition with new target value
      try {
        const existingCondition = JSON.parse(existingAlert.condition);
        updateData.condition = JSON.stringify({
          ...existingCondition,
          targetValue,
        });
      } catch {
        updateData.condition = JSON.stringify({
          type: 'price_above',
          targetValue,
        });
      }
    }

    // Update alert
    const updatedAlert = await prisma.alert.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        symbol: true,
        timeframe: true,
        condition: true,
        alertType: true,
        isActive: true,
        lastTriggered: true,
        triggerCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      alert: updatedAlert,
      message: 'Alert updated successfully',
    });
  } catch (error) {
    console.error('PATCH /api/alerts/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to update alert', code: 'UPDATE_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/alerts/[id]
 *
 * Delete an alert (set isActive to false)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check if alert exists and belongs to user
    const existingAlert = await prisma.alert.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existingAlert) {
      return NextResponse.json(
        { error: 'Alert not found', code: 'ALERT_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (existingAlert.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Soft delete by marking as inactive
    // Or hard delete - uncomment the prisma.alert.delete if preferred
    await prisma.alert.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Alert deleted successfully',
    });
  } catch (error) {
    console.error('DELETE /api/alerts/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete alert', code: 'DELETE_ERROR' },
      { status: 500 }
    );
  }
}
