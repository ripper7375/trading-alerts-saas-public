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
 * Revokes a specific session by ID.
 * Users can only revoke their own sessions.
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
      return NextResponse.json(body, { status: opStatus });
    }

    // Revoke the session
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
