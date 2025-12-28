/**
 * User Sessions API
 *
 * GET - List all active sessions for the authenticated user
 * DELETE - Revoke all sessions except current
 *
 * @module app/api/user/sessions/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import {
  getUserSessions,
  revokeAllSessions,
  trackSession,
} from '@/lib/auth/session-tracker';

/**
 * GET /api/user/sessions
 *
 * Returns all active sessions for the authenticated user.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get session token from cookies
    const sessionToken =
      req.cookies.get('next-auth.session-token')?.value ||
      req.cookies.get('__Secure-next-auth.session-token')?.value;

    // Track current session if not already tracked
    if (sessionToken) {
      const userAgent = req.headers.get('user-agent') || '';
      const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0] ||
        req.headers.get('x-real-ip') ||
        'Unknown';

      await trackSession({
        userId: session.user.id,
        sessionToken,
        userAgent,
        ipAddress: ip,
      });
    }

    // Get all sessions
    const sessions = await getUserSessions(session.user.id, sessionToken);

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('[Sessions API] Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/sessions
 *
 * Revokes all sessions except the current one.
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current session token to preserve
    const sessionToken =
      req.cookies.get('next-auth.session-token')?.value ||
      req.cookies.get('__Secure-next-auth.session-token')?.value;

    const count = await revokeAllSessions(session.user.id, sessionToken);

    return NextResponse.json({
      success: true,
      message: `Revoked ${count} session${count === 1 ? '' : 's'}`,
      revokedCount: count,
    });
  } catch (error) {
    console.error('[Sessions API] Error revoking sessions:', error);
    return NextResponse.json(
      { error: 'Failed to revoke sessions' },
      { status: 500 }
    );
  }
}
