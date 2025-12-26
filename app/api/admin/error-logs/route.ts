import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth/auth-options';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION SCHEMAS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(10).max(100).default(50),
  type: z
    .enum([
      'ALL',
      'API_ERROR',
      'DATABASE_ERROR',
      'AUTH_ERROR',
      'PAYMENT_ERROR',
      'MT5_ERROR',
    ])
    .default('ALL'),
  tier: z.enum(['ALL', 'FREE', 'PRO']).default('ALL'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ErrorLog {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  userId: string | null;
  userTier: 'FREE' | 'PRO' | null;
  endpoint: string | null;
  stackTrace: string | null;
  metadata: Record<string, unknown> | null;
}

interface ErrorLogsResponse {
  logs: ErrorLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MOCK DATA GENERATOR
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// ⚠️ DEVELOPMENT MODE: This endpoint returns mock/sample data.
//
// This is intentional for development and demo purposes.
// The mock data simulates realistic error log patterns.
//
// PRODUCTION TODO: To implement real error logging:
// 1. Create an ErrorLog table in Prisma schema:
//    model ErrorLog {
//      id          String   @id @default(cuid())
//      type        String   // API_ERROR, DATABASE_ERROR, etc.
//      message     String
//      stackTrace  String?
//      userId      String?
//      userTier    String?
//      endpoint    String?
//      metadata    Json?
//      createdAt   DateTime @default(now())
//      @@index([type])
//      @@index([userId])
//      @@index([createdAt])
//    }
//
// 2. Create a centralized error logging utility (lib/logging/error-logger.ts)
// 3. Integrate error logging in API catch blocks and middleware
// 4. Update this endpoint to query ErrorLog instead of mock data
//
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function generateMockErrorLogs(
  page: number,
  pageSize: number,
  type: string,
  tier: string
): ErrorLogsResponse {
  const sampleErrors: Array<{
    type: string;
    message: string;
    endpoint: string;
    stackTrace: string;
  }> = [
    {
      type: 'API_ERROR',
      message: 'Request timeout while fetching chart data',
      endpoint: '/api/charts/BTCUSD/H1',
      stackTrace:
        'Error: Request timeout\n    at fetchChartData (app/api/charts/route.ts:45)\n    at processRequest (app/api/charts/route.ts:12)',
    },
    {
      type: 'DATABASE_ERROR',
      message: 'Prisma connection pool exhausted',
      endpoint: '/api/alerts',
      stackTrace:
        'PrismaClientKnownRequestError: Connection pool exhausted\n    at getAlerts (lib/db/alerts.ts:23)\n    at GET (app/api/alerts/route.ts:18)',
    },
    {
      type: 'AUTH_ERROR',
      message: 'Invalid session token',
      endpoint: '/api/user/profile',
      stackTrace:
        'AuthError: Invalid session token\n    at validateSession (lib/auth/session.ts:12)\n    at getProfile (app/api/user/profile/route.ts:8)',
    },
    {
      type: 'PAYMENT_ERROR',
      message: 'Stripe webhook signature verification failed',
      endpoint: '/api/billing/webhook',
      stackTrace:
        'StripeError: Webhook signature verification failed\n    at constructEvent (lib/stripe/webhook.ts:15)\n    at POST (app/api/billing/webhook/route.ts:22)',
    },
    {
      type: 'MT5_ERROR',
      message: 'Connection to MT5 server lost',
      endpoint: '/api/indicators',
      stackTrace:
        'MT5Error: Connection lost\n    at fetchIndicators (lib/mt5/connector.ts:89)\n    at GET (app/api/indicators/route.ts:35)',
    },
    {
      type: 'API_ERROR',
      message: 'Rate limit exceeded for user',
      endpoint: '/api/alerts',
      stackTrace:
        'RateLimitError: Rate limit exceeded\n    at checkRateLimit (middleware/rate-limit.ts:24)\n    at POST (app/api/alerts/route.ts:10)',
    },
    {
      type: 'DATABASE_ERROR',
      message: 'Unique constraint violation on email',
      endpoint: '/api/auth/register',
      stackTrace:
        'PrismaClientKnownRequestError: Unique constraint violation\n    at createUser (lib/db/users.ts:15)\n    at POST (app/api/auth/register/route.ts:28)',
    },
  ];

  // Generate multiple logs based on samples
  const allLogs: ErrorLog[] = [];
  const now = Date.now();

  for (let i = 0; i < 100; i++) {
    const sampleIndex = i % sampleErrors.length;
    const sample = sampleErrors[sampleIndex];
    if (!sample) continue;

    const timestamp = new Date(now - i * 3600000).toISOString(); // 1 hour apart
    const userTier = Math.random() > 0.5 ? 'PRO' : 'FREE';

    allLogs.push({
      id: `err-${i + 1}`,
      timestamp,
      type: sample.type,
      message: sample.message,
      userId:
        Math.random() > 0.3 ? `user-${Math.floor(Math.random() * 1000)}` : null,
      userTier: Math.random() > 0.2 ? userTier : null,
      endpoint: sample.endpoint,
      stackTrace: sample.stackTrace,
      metadata:
        Math.random() > 0.5
          ? { requestId: `req-${Math.random().toString(36).slice(2, 10)}` }
          : null,
    });
  }

  // Apply filters
  let filteredLogs = allLogs;

  if (type !== 'ALL') {
    filteredLogs = filteredLogs.filter((log) => log.type === type);
  }

  if (tier !== 'ALL') {
    filteredLogs = filteredLogs.filter((log) => log.userTier === tier);
  }

  const total = filteredLogs.length;
  const totalPages = Math.ceil(total / pageSize);
  const paginatedLogs = filteredLogs.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  return {
    logs: paginatedLogs,
    total,
    page,
    pageSize,
    totalPages,
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET HANDLER - Fetch error logs (admin only)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/admin/error-logs - Fetch paginated error logs
 *
 * Query params:
 * - page: Page number (default: 1)
 * - pageSize: Logs per page (default: 50, max: 100)
 * - type: Filter by error type (ALL/API_ERROR/DATABASE_ERROR/etc.)
 * - tier: Filter by user tier (ALL/FREE/PRO)
 * - startDate: Start date for filtering
 * - endDate: End date for filtering
 *
 * Note: Currently returns mock data. In production, this would
 * query an error logging table.
 *
 * @returns 200: Paginated error logs
 * @returns 401: Unauthorized (not logged in)
 * @returns 403: Forbidden (not admin)
 * @returns 400: Invalid query parameters
 * @returns 500: Internal server error
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<ErrorLogsResponse | { error: string }>> {
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

    const { page, pageSize, type, tier } = validation.data;

    // Generate mock data (see MOCK DATA GENERATOR section for production TODO)
    const data = generateMockErrorLogs(page, pageSize, type, tier);

    // Add header to indicate mock data in development
    return NextResponse.json(data, {
      headers: {
        'X-Data-Source': 'mock',
      },
    });
  } catch (error) {
    console.error('Admin error logs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch error logs' },
      { status: 500 }
    );
  }
}
