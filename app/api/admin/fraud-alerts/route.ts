import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth/auth-options';
import {
  getFraudAlerts,
  getFraudAlertStats,
  FraudAlertFilters,
} from '@/lib/fraud/fraud-detection.service';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION SCHEMAS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(10).max(100).default(20),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  status: z.enum(['PENDING', 'REVIEWED', 'DISMISSED', 'BLOCKED']).optional(),
  pattern: z.string().optional(),
  userId: z.string().optional(),
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET HANDLER - List fraud alerts (admin only)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/admin/fraud-alerts - Fetch fraud alerts with pagination and filters
 *
 * Query params:
 * - page: Page number (default: 1)
 * - pageSize: Alerts per page (default: 20, max: 100)
 * - severity: Filter by severity (LOW/MEDIUM/HIGH/CRITICAL)
 * - status: Filter by status (PENDING/REVIEWED/DISMISSED/BLOCKED)
 * - pattern: Filter by fraud pattern
 * - userId: Filter by specific user
 *
 * @returns 200: Paginated fraud alerts list with stats
 * @returns 401: Unauthorized (not logged in)
 * @returns 403: Forbidden (not admin)
 * @returns 400: Invalid query parameters
 * @returns 500: Server error
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin authorization check
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(req.url);
    const queryParams = {
      page: searchParams.get('page') || '1',
      pageSize: searchParams.get('pageSize') || '20',
      severity: searchParams.get('severity') || undefined,
      status: searchParams.get('status') || undefined,
      pattern: searchParams.get('pattern') || undefined,
      userId: searchParams.get('userId') || undefined,
    };

    const validatedParams = querySchema.safeParse(queryParams);
    if (!validatedParams.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validatedParams.error.errors },
        { status: 400 }
      );
    }

    const { page, pageSize, severity, status, pattern, userId } = validatedParams.data;

    // Build filters
    const filters: FraudAlertFilters = {};
    if (severity) filters.severity = severity;
    if (status) filters.status = status;
    if (pattern) filters.pattern = pattern as FraudAlertFilters['pattern'];
    if (userId) filters.userId = userId;

    // Fetch alerts and stats in parallel
    const [alertsResult, stats] = await Promise.all([
      getFraudAlerts(filters, page, pageSize),
      getFraudAlertStats(),
    ]);

    // Define the expected shape after prisma generate
    interface AlertWithFields {
      id: string;
      userId: string;
      severity: string;
      pattern: string;
      description: string;
      country?: string | null;
      paymentMethod?: string | null;
      amount?: { toString(): string } | null;
      currency?: string | null;
      status: string;
      ipAddress?: string | null;
      resolution?: string | null;
      notes?: string | null;
      reviewedBy?: string | null;
      reviewedAt?: Date | null;
      createdAt: Date;
      user?: { email: string; name: string | null };
    }

    // Transform alerts for frontend
    const alerts = alertsResult.alerts.map((alertRaw) => {
      const alert = alertRaw as unknown as AlertWithFields;
      return {
        id: alert.id,
        severity: alert.severity,
        pattern: alert.pattern,
        description: alert.description,
        userId: alert.userId,
        userEmail: alert.user?.email || '',
        userName: alert.user?.name || null,
        country: alert.country || null,
        paymentMethod: alert.paymentMethod || null,
        amount: alert.amount?.toString() || null,
        currency: alert.currency || null,
        status: alert.status,
        ipAddress: alert.ipAddress || null,
        resolution: alert.resolution || null,
        notes: alert.notes || null,
        reviewedBy: alert.reviewedBy || null,
        reviewedAt: alert.reviewedAt?.toISOString() || null,
        createdAt: alert.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      alerts,
      stats,
      pagination: alertsResult.pagination,
    });
  } catch (error) {
    console.error('Failed to fetch fraud alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fraud alerts' },
      { status: 500 }
    );
  }
}
