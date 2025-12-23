import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION SCHEMAS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(10).max(100).default(50),
  search: z.string().optional(),
  tier: z.enum(['ALL', 'FREE', 'PRO']).default('ALL'),
  sortBy: z.enum(['createdAt', 'name', 'tier']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  tier: 'FREE' | 'PRO';
  role: string;
  status: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  alertCount: number;
  watchlistCount: number;
}

interface AdminUserListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface PrismaUserWithCounts {
  id: string;
  name: string | null;
  email: string;
  tier: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  _count: {
    alerts: number;
    watchlists: number;
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET HANDLER - List all users (admin only)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/admin/users - Fetch paginated user list
 *
 * Query params:
 * - page: Page number (default: 1)
 * - pageSize: Users per page (default: 50, max: 100)
 * - search: Search by name or email
 * - tier: Filter by tier (ALL/FREE/PRO)
 * - sortBy: Sort field (createdAt/name/tier)
 * - sortOrder: Sort order (asc/desc)
 *
 * @returns 200: Paginated user list
 * @returns 401: Unauthorized (not logged in)
 * @returns 403: Forbidden (not admin)
 * @returns 400: Invalid query parameters
 * @returns 500: Internal server error
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<AdminUserListResponse | { error: string }>> {
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

    const { page, pageSize, search, tier, sortBy, sortOrder } = validation.data;

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

    // Get total count
    const total = await prisma.user.count({ where });

    // Get users with pagination
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
        _count: {
          select: {
            alerts: true,
            watchlists: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Transform response
    const transformedUsers: AdminUser[] = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      tier: user.tier as 'FREE' | 'PRO',
      role: user.role,
      status: user.isActive ? 'active' : 'suspended',
      createdAt: user.createdAt,
      lastLoginAt: null, // TODO: Track last login time
      alertCount: user._count?.alerts ?? 0,
      watchlistCount: user._count?.watchlists ?? 0,
    }));

    return NextResponse.json({
      users: transformedUsers,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Admin users error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
