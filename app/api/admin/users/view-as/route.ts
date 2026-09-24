/**
 * Admin "view as user" API (read-only customer-support view)
 *
 * POST   — start viewing a user: body `{ userId }`, sets the view-as cookie
 *          and returns where to go (`/settings/billing`)
 * DELETE — stop viewing: clears the cookie
 *
 * Picking a user reuses the existing searchable list at /admin/users
 * (GET /api/admin/users), so there is no search endpoint here.
 *
 * The cookie only changes what the Billing, Security and Security Activity
 * settings pages READ, and only for requests that opt in with
 * `?view_as=user`; see lib/admin/user-view-as.ts for the full rules.
 *
 * @module app/api/admin/users/view-as/route
 */

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  USER_VIEW_AS_COOKIE_NAME,
  USER_VIEW_AS_MAX_AGE_SECONDS,
  encodeUserViewAsCookie,
  loadUserViewAsTarget,
  userViewAsCookieOptions,
} from '@/lib/admin/user-view-as';
import { AuthError } from '@/lib/auth/errors';
import { requireAdmin } from '@/lib/auth/session';
import { csrfErrorResponse, validateOrigin } from '@/lib/csrf';

const startSchema = z.object({
  userId: z.string().min(1).max(64),
});

function authErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }
  return null;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST — start viewing a user
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await validateOrigin())) {
    return csrfErrorResponse() as NextResponse;
  }

  try {
    const session = await requireAdmin();

    const body = await request.json().catch(() => null);
    const validation = startSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    if (validation.data.userId === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot view your own account as a user' },
        { status: 400 }
      );
    }

    // Unknown users and admin accounts get the same answer, so the route
    // can't be used to tell which ids are administrators.
    const target = await loadUserViewAsTarget(validation.data.userId);
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const cookieStore = await cookies();
    cookieStore.set(
      USER_VIEW_AS_COOKIE_NAME,
      encodeUserViewAsCookie(session.user.id, target.id),
      userViewAsCookieOptions(USER_VIEW_AS_MAX_AGE_SECONDS)
    );

    // No general admin audit table exists; this line is the record.
    console.info(
      `[admin-view-as-user] start admin=${session.user.id} user=${target.id}`
    );

    return NextResponse.json({ target, redirectTo: '/settings/billing' });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('[admin-view-as-user] start failed:', error);
    return NextResponse.json(
      { error: 'Failed to start viewing user' },
      { status: 500 }
    );
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DELETE — stop viewing
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function DELETE(): Promise<NextResponse> {
  if (!(await validateOrigin())) {
    return csrfErrorResponse() as NextResponse;
  }

  try {
    const session = await requireAdmin();

    // Set, not delete: a __Secure- cookie is only cleared by a Set-Cookie
    // that also carries Secure (same reason as token-logout/route.ts).
    const cookieStore = await cookies();
    cookieStore.set(USER_VIEW_AS_COOKIE_NAME, '', userViewAsCookieOptions(0));

    console.info(`[admin-view-as-user] stop admin=${session.user.id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('[admin-view-as-user] stop failed:', error);
    return NextResponse.json(
      { error: 'Failed to stop viewing user' },
      { status: 500 }
    );
  }
}
