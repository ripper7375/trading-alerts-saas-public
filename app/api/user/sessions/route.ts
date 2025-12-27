import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

/**
 * Session information returned by the API
 */
interface SessionInfo {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

/**
 * GET /api/user/sessions
 *
 * Fetches all active sessions for the current user.
 * Returns session info including device, location, and last active time.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current session token from cookie
    const cookieStore = await cookies();
    const sessionToken =
      cookieStore.get('next-auth.session-token')?.value ||
      cookieStore.get('__Secure-next-auth.session-token')?.value;

    // Fetch all active sessions for user
    const sessions = await prisma.session.findMany({
      where: {
        userId: session.user.id,
        expires: {
          gt: new Date(),
        },
      },
      orderBy: {
        expires: 'desc',
      },
    });

    // Transform sessions to response format
    const sessionInfos: SessionInfo[] = sessions.map((s) => {
      const isCurrent = s.sessionToken === sessionToken;

      // Calculate last active (using expiry - default session duration)
      // NextAuth typically uses 30-day sessions, so estimate based on expiry
      const sessionDuration = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
      const createdAt = new Date(s.expires.getTime() - sessionDuration);
      const lastActive = formatLastActive(createdAt);

      return {
        id: s.id,
        device: 'Web Browser', // Would need User-Agent parsing for actual device
        location: 'Unknown location', // Would need IP geolocation service
        lastActive: isCurrent ? 'Current session' : lastActive,
        isCurrent,
      };
    });

    return NextResponse.json({ sessions: sessionInfos });
  } catch (error) {
    console.error('Failed to fetch sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/sessions
 *
 * Revokes a specific session or all sessions except current.
 *
 * Query params:
 * - id: Specific session ID to revoke
 * - all: Set to 'true' to revoke all sessions except current
 */
export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id');
    const revokeAll = searchParams.get('all') === 'true';

    // Get current session token
    const cookieStore = await cookies();
    const currentSessionToken =
      cookieStore.get('next-auth.session-token')?.value ||
      cookieStore.get('__Secure-next-auth.session-token')?.value;

    if (revokeAll) {
      // Delete all sessions except current
      await prisma.session.deleteMany({
        where: {
          userId: session.user.id,
          sessionToken: {
            not: currentSessionToken || '',
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: 'All other sessions revoked',
      });
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Verify session belongs to user and is not current
    const targetSession = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: session.user.id,
      },
    });

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (targetSession.sessionToken === currentSessionToken) {
      return NextResponse.json(
        { error: 'Cannot revoke current session' },
        { status: 400 }
      );
    }

    // Delete the session
    await prisma.session.delete({
      where: { id: sessionId },
    });

    return NextResponse.json({
      success: true,
      message: 'Session revoked',
    });
  } catch (error) {
    console.error('Failed to revoke session:', error);
    return NextResponse.json(
      { error: 'Failed to revoke session' },
      { status: 500 }
    );
  }
}

/**
 * Format last active time as human-readable string
 */
function formatLastActive(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } else {
    return date.toLocaleDateString();
  }
}
