import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth/auth-options';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION SCHEMAS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const querySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface EndpointStats {
  endpoint: string;
  method: string;
  callsFree: number;
  callsPro: number;
  avgResponseTime: number;
  errorRate: number;
  lastCalled: string | null;
}

interface ApiUsageResponse {
  endpoints: EndpointStats[];
  summary: {
    totalCalls: number;
    totalCallsFree: number;
    totalCallsPro: number;
    avgResponseTime: number;
    overallErrorRate: number;
  };
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MOCK DATA (until API usage tracking is implemented)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function generateMockApiUsage(
  startDate: string,
  endDate: string
): ApiUsageResponse {
  const endpoints: EndpointStats[] = [
    {
      endpoint: '/api/alerts',
      method: 'GET',
      callsFree: 1250,
      callsPro: 3420,
      avgResponseTime: 45,
      errorRate: 0.5,
      lastCalled: new Date().toISOString(),
    },
    {
      endpoint: '/api/alerts',
      method: 'POST',
      callsFree: 320,
      callsPro: 890,
      avgResponseTime: 120,
      errorRate: 1.2,
      lastCalled: new Date().toISOString(),
    },
    {
      endpoint: '/api/watchlist',
      method: 'GET',
      callsFree: 980,
      callsPro: 2150,
      avgResponseTime: 38,
      errorRate: 0.3,
      lastCalled: new Date().toISOString(),
    },
    {
      endpoint: '/api/charts/[symbol]/[timeframe]',
      method: 'GET',
      callsFree: 4520,
      callsPro: 12800,
      avgResponseTime: 250,
      errorRate: 2.1,
      lastCalled: new Date().toISOString(),
    },
    {
      endpoint: '/api/indicators',
      method: 'GET',
      callsFree: 1800,
      callsPro: 5600,
      avgResponseTime: 180,
      errorRate: 1.8,
      lastCalled: new Date().toISOString(),
    },
    {
      endpoint: '/api/billing/checkout',
      method: 'POST',
      callsFree: 0,
      callsPro: 145,
      avgResponseTime: 850,
      errorRate: 5.2,
      lastCalled: new Date().toISOString(),
    },
    {
      endpoint: '/api/billing/webhook',
      method: 'POST',
      callsFree: 0,
      callsPro: 98,
      avgResponseTime: 120,
      errorRate: 0.8,
      lastCalled: new Date().toISOString(),
    },
    {
      endpoint: '/api/auth/session',
      method: 'GET',
      callsFree: 8900,
      callsPro: 15200,
      avgResponseTime: 25,
      errorRate: 0.1,
      lastCalled: new Date().toISOString(),
    },
  ];

  const totalCallsFree = endpoints.reduce((sum, e) => sum + e.callsFree, 0);
  const totalCallsPro = endpoints.reduce((sum, e) => sum + e.callsPro, 0);
  const totalCalls = totalCallsFree + totalCallsPro;

  const avgResponseTime =
    endpoints.reduce(
      (sum, e) => sum + e.avgResponseTime * (e.callsFree + e.callsPro),
      0
    ) / totalCalls;

  const overallErrorRate =
    endpoints.reduce(
      (sum, e) => sum + e.errorRate * (e.callsFree + e.callsPro),
      0
    ) / totalCalls;

  return {
    endpoints,
    summary: {
      totalCalls,
      totalCallsFree,
      totalCallsPro,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      overallErrorRate: Math.round(overallErrorRate * 100) / 100,
    },
    dateRange: {
      startDate,
      endDate,
    },
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET HANDLER - Fetch API usage stats (admin only)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/admin/api-usage - Fetch API usage statistics
 *
 * Query params:
 * - startDate: Start date for filtering (ISO date string)
 * - endDate: End date for filtering (ISO date string)
 *
 * Returns:
 * - Endpoint stats (calls by tier, response time, error rate)
 * - Summary totals
 *
 * Note: Currently returns mock data. In production, this would
 * query an API usage tracking table.
 *
 * @returns 200: API usage data
 * @returns 401: Unauthorized (not logged in)
 * @returns 403: Forbidden (not admin)
 * @returns 500: Internal server error
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiUsageResponse | { error: string }>> {
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

    // Parse query params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const validation = querySchema.safeParse(searchParams);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const { startDate, endDate } = validation.data;

    // Default date range: last 7 days
    const end = endDate ?? new Date().toISOString().split('T')[0] ?? '';
    const start =
      startDate ??
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0] ??
      '';

    // Generate mock data (replace with real data query in production)
    const data = generateMockApiUsage(start, end);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Admin API usage error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API usage data' },
      { status: 500 }
    );
  }
}
