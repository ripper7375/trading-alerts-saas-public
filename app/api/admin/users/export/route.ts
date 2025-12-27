import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION SCHEMAS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const querySchema = z.object({
  search: z.string().optional(),
  tier: z.enum(['ALL', 'FREE', 'PRO']).default('ALL'),
  sortBy: z.enum(['createdAt', 'name', 'tier']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SESSION_DURATION_DAYS = 30;
const MAX_EXPORT_ROWS = 10000;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Escape a value for CSV format
 * - Wrap in quotes if contains comma, quote, or newline
 * - Double up any internal quotes
 */
function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // Check if value needs escaping
  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Format date for CSV export
 */
function formatDateCSV(date: Date | null): string {
  if (!date) return '';
  return date.toISOString();
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET HANDLER - Export users to CSV
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/admin/users/export - Export users to CSV
 *
 * Query params:
 * - search: Search by name or email
 * - tier: Filter by tier (ALL/FREE/PRO)
 * - sortBy: Sort field (createdAt/name/tier)
 * - sortOrder: Sort order (asc/desc)
 *
 * @returns 200: CSV file download
 * @returns 401: Unauthorized (not logged in)
 * @returns 403: Forbidden (not admin)
 * @returns 400: Invalid query parameters
 * @returns 500: Internal server error
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<Blob | { error: string }>> {
  try {
    // Auth check
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin role check
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Parse and validate query params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const validation = querySchema.safeParse(searchParams);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const { search, tier, sortBy, sortOrder } = validation.data;

    // Build where clause
    type WhereClause = {
      OR?: Array<{
        name?: { contains: string; mode: 'insensitive' };
        email?: { contains: string; mode: 'insensitive' };
      }>;
      tier?: 'FREE' | 'PRO';
    };

    const where: WhereClause = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tier !== 'ALL') {
      where.tier = tier;
    }

    // Get users without pagination (up to MAX_EXPORT_ROWS)
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        tier: true,
        role: true,
        isActive: true,
        createdAt: true,
        sessions: {
          select: {
            expires: true,
          },
          orderBy: {
            expires: 'desc',
          },
          take: 1,
        },
        _count: {
          select: {
            alerts: true,
            watchlists: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      take: MAX_EXPORT_ROWS,
    });

    // CSV Headers
    const headers = [
      'ID',
      'Name',
      'Email',
      'Tier',
      'Role',
      'Status',
      'Created At',
      'Last Login At',
      'Alert Count',
      'Watchlist Count',
    ];

    // Build CSV rows
    const rows = users.map((user) => {
      // Estimate last login from most recent session
      let lastLoginAt: Date | null = null;
      const sessions = user.sessions ?? [];
      if (sessions.length > 0 && sessions[0]) {
        const sessionExpiry = new Date(sessions[0].expires);
        lastLoginAt = new Date(
          sessionExpiry.getTime() - SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
        );
      }

      return [
        escapeCSV(user.id),
        escapeCSV(user.name),
        escapeCSV(user.email),
        escapeCSV(user.tier),
        escapeCSV(user.role),
        escapeCSV(user.isActive ? 'active' : 'suspended'),
        escapeCSV(formatDateCSV(user.createdAt)),
        escapeCSV(formatDateCSV(lastLoginAt)),
        escapeCSV(user._count?.alerts ?? 0),
        escapeCSV(user._count?.watchlists ?? 0),
      ].join(',');
    });

    // Combine headers and rows
    const csvContent = [headers.join(','), ...rows].join('\n');

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="users-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Admin users export error:', error);
    return NextResponse.json(
      { error: 'Failed to export users' },
      { status: 500 }
    );
  }
}
