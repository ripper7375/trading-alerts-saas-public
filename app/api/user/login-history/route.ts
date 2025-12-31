import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

/**
 * Login History API Route
 *
 * GET: Fetch user's login history
 *
 * Returns recent login attempts with device and location information.
 */

interface LoginHistoryItem {
  id: string;
  status: string;
  provider: string;
  device: string;
  browser: string;
  os: string;
  location: string;
  ipAddress: string;
  isNewDevice: boolean;
  createdAt: string;
}

/**
 * GET /api/user/login-history
 * Fetch the authenticated user's login history
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query params for pagination
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Fetch login history
    const loginHistory = await prisma.loginHistory.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        status: true,
        provider: true,
        deviceType: true,
        browser: true,
        browserVersion: true,
        os: true,
        osVersion: true,
        ipAddress: true,
        country: true,
        city: true,
        region: true,
        isNewDevice: true,
        createdAt: true,
      },
    });

    // Get total count for pagination
    const totalCount = await prisma.loginHistory.count({
      where: { userId: session.user.id },
    });

    // Format the response
    const formattedHistory: LoginHistoryItem[] = loginHistory.map((entry) => {
      // Format location
      const locationParts = [entry.city, entry.region, entry.country].filter(
        (p) => p && p !== 'Unknown'
      );
      const location = locationParts.length > 0 ? locationParts.join(', ') : 'Unknown';

      // Format device description
      const deviceType = entry.deviceType || 'Unknown';
      const device = deviceType.charAt(0).toUpperCase() + deviceType.slice(1);

      // Format browser with version
      const browser = entry.browser
        ? entry.browser + (entry.browserVersion ? ` ${entry.browserVersion}` : '')
        : 'Unknown';

      // Format OS with version
      const os = entry.os
        ? entry.os + (entry.osVersion ? ` ${entry.osVersion}` : '')
        : 'Unknown';

      return {
        id: entry.id,
        status: entry.status,
        provider: entry.provider,
        device,
        browser,
        os,
        location,
        ipAddress: entry.ipAddress || 'Unknown',
        isNewDevice: entry.isNewDevice,
        createdAt: entry.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      history: formattedHistory,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    console.error('[GET /api/user/login-history] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch login history' },
      { status: 500 }
    );
  }
}
