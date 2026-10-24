/**
 * Single Session API
 *
 * DELETE - Revoke a specific session by ID
 *
 * @module app/api/user/sessions/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { revokeSession } from '@/lib/auth/session-tracker';
import { forgetDeviceSession } from '@/lib/auth/user-active';
import { shouldUseOperationServiceForUserSessions } from '@/lib/operation-service/flags';
import {
  forwardRequestToOperationService,
  OperationServiceError,
} from '@/lib/operation-service/write-routes';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/user/sessions/[id]
 *
 * Revokes a specific session by ID ("log out this device", CODE-02C): the device's NextAuth
 * token carries the row's id as `sid`, and the `jwt` callback refuses a token whose row is
 * revoked. Users can only revoke their own sessions.
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: sessionId } = await context.params;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    if (shouldUseOperationServiceForUserSessions()) {
      const { status: opStatus, body } = await forwardRequestToOperationService(
        request,
        `/user/sessions/${sessionId}`
      );
      // operation-service ended the device in the database; this instance's 30 s answer for it
      // (`getDeviceSessionState`) must not outlive that. Other instances follow within 30 s.
      if (opStatus >= 200 && opStatus < 300) forgetDeviceSession(sessionId);
      return NextResponse.json(body, { status: opStatus });
    }

    // Revoke the session (and forget this instance's cached answer for it)
    const success = await revokeSession(sessionId, session.user.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Session not found or already revoked' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Session revoked successfully',
    });
  } catch (error) {
    if (error instanceof OperationServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    console.error('[Sessions API] Error revoking session:', error);
    return NextResponse.json(
      { error: 'Failed to revoke session' },
      { status: 500 }
    );
  }
}
