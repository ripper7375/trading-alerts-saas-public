/**
 * Admin "view as user" — read-only customer-support view.
 *
 * An admin starts a view from /admin/users (POST /api/admin/users/view-as),
 * which sets a short-lived httpOnly cookie naming the user. While it is set,
 * /settings shows that user's Billing, Security (login history) and Security
 * Activity pages instead of the admin's own, so support can see exactly what
 * the customer sees.
 *
 * Two things must BOTH be true before a read route serves another user:
 *
 * 1. The cookie: the signed-in session is ADMIN, the cookie decodes cleanly,
 *    the admin id written into it equals the session's id, and the target
 *    still exists and is not an admin.
 * 2. The opt-in: the request carries `?view_as=user`. Only the three settings
 *    pages add it. Every other request (the alerts page, the header, pricing,
 *    the admin's own anything) ignores the cookie completely, so a view left
 *    open cannot leak into unrelated pages.
 *
 * Read-only by construction, not by UI alone:
 * - Only GET handlers consult this module. Write handlers (cancel plan, 2FA,
 *   preferences, mark-read) keep using the session user. The admin never
 *   holds a token for the viewed user, so no write can reach that user's
 *   account; the settings pages also hide those controls in view mode so the
 *   admin cannot change their OWN account by mistake.
 * - Routes that normally forward to operation-service skip the proxy in view
 *   mode: the proxy authenticates as the caller, i.e. the admin. They use the
 *   monolith Prisma path each route keeps as its rollback instead.
 *
 * When the opt-in is present but the view is not valid (expired cookie, not
 * an admin, target gone), routes answer 403 rather than falling back to the
 * admin's own data, which would be shown under the viewed user's banner.
 *
 * @module lib/admin/user-view-as
 */

import { cookies } from 'next/headers';

import { prisma } from '@/lib/db/prisma';

export {
  USER_VIEW_AS_PATHS,
  USER_VIEW_AS_QUERY,
  withViewAsQuery,
} from './user-view-as-paths';

const isProduction = process.env.NODE_ENV === 'production';

export const USER_VIEW_AS_COOKIE_NAME = isProduction
  ? '__Secure-davintrade-admin-view-user'
  : 'davintrade-admin-view-user';

/** A view lasts two hours, then the admin starts it again. */
export const USER_VIEW_AS_MAX_AGE_SECONDS = 2 * 60 * 60;

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export interface UserViewAsTarget {
  id: string;
  name: string | null;
  email: string;
  tier: string;
  role: string;
}

interface SessionUserLike {
  id?: string | null;
  role?: string | null;
}

export type ViewAsSubject =
  | { kind: 'self'; userId: string }
  | { kind: 'view-as'; userId: string; target: UserViewAsTarget }
  | { kind: 'denied' };

export function userViewAsCookieOptions(maxAge: number): {
  httpOnly: true;
  sameSite: 'lax';
  path: '/';
  secure: boolean;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: isProduction,
    maxAge,
  };
}

export function encodeUserViewAsCookie(
  adminUserId: string,
  userId: string
): string {
  return `${adminUserId}:${userId}`;
}

export function decodeUserViewAsCookie(
  value: string | undefined | null
): { adminUserId: string; userId: string } | null {
  if (!value) return null;
  const parts = value.split(':');
  if (parts.length !== 2) return null;
  const [adminUserId, userId] = parts as [string, string];
  if (!ID_PATTERN.test(adminUserId) || !ID_PATTERN.test(userId)) {
    return null;
  }
  return { adminUserId, userId };
}

/** The parts of a request this module reads (Request or NextRequest). */
interface RequestLike {
  url?: string;
  nextUrl?: URL;
}

/** Whether a request opted into view mode with `?view_as=user`. */
export function isViewAsRequest(request: RequestLike): boolean {
  try {
    const params =
      request.nextUrl?.searchParams ?? new URL(request.url ?? '').searchParams;
    return params.get('view_as') === 'user';
  } catch {
    return false;
  }
}

/**
 * Load a user for viewing, or `null` if they don't exist or are an admin.
 * Admin accounts are never viewable: this tool is for customer support.
 */
export async function loadUserViewAsTarget(
  userId: string
): Promise<UserViewAsTarget | null> {
  if (!ID_PATTERN.test(userId)) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, tier: true, role: true },
  });
  if (!user || user.role === 'ADMIN') return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    tier: String(user.tier),
    role: String(user.role),
  };
}

/**
 * The user the signed-in admin is viewing, or `null` when the caller is not
 * an admin, has no valid cookie, or anything fails (fail closed).
 */
export async function getAdminUserViewAs(
  sessionUser: SessionUserLike | null | undefined
): Promise<UserViewAsTarget | null> {
  try {
    if (sessionUser?.role !== 'ADMIN' || !sessionUser.id) return null;

    const cookieStore = await cookies();
    const decoded = decodeUserViewAsCookie(
      cookieStore.get(USER_VIEW_AS_COOKIE_NAME)?.value
    );
    if (!decoded || decoded.adminUserId !== sessionUser.id) return null;
    if (decoded.userId === sessionUser.id) return null;

    return await loadUserViewAsTarget(decoded.userId);
  } catch {
    return null;
  }
}

/**
 * Whose data a GET route should read. Without `?view_as=user` this is always
 * the session user and nothing else is consulted, so ordinary requests keep
 * their exact previous behaviour.
 */
export async function resolveViewAsSubject(
  request: RequestLike,
  sessionUser: SessionUserLike & { id: string }
): Promise<ViewAsSubject> {
  if (!isViewAsRequest(request)) {
    return { kind: 'self', userId: sessionUser.id };
  }

  const target = await getAdminUserViewAs(sessionUser);
  if (!target) return { kind: 'denied' };

  return { kind: 'view-as', userId: target.id, target };
}

/** Body + status for a view-as request that is not allowed. */
export const VIEW_AS_DENIED_BODY = {
  error: 'Admin view is not active. Start it again from Admin > Users.',
  code: 'VIEW_AS_DENIED',
} as const;
