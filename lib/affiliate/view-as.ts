/**
 * Admin "view as affiliate" — read-only.
 *
 * An admin picks an affiliate at /admin/affiliates/view-as; the start route
 * (app/api/admin/affiliates/view-as) sets a short-lived httpOnly cookie
 * naming that affiliate's profile. The affiliate dashboard layout and its
 * GET API routes then read `getAdminViewAs()` and, when it returns a target,
 * serve THAT affiliate's data instead of the signed-in user's.
 *
 * Read-only by construction, not by UI alone:
 * - Only GET handlers consult this module. Every write handler (profile
 *   PUT/PATCH, swipe-copy tracking, asset download counters, payout settings)
 *   still calls `requireAffiliate()`, which an admin fails (they are not an
 *   affiliate), so a write is refused with 403 whatever the UI shows.
 * - The admin never receives a token that acts as the affiliate. The
 *   money-service read proxy authenticates with the caller's own token, so in
 *   view-as mode the routes use their monolith Prisma path instead, reading
 *   the same database by the target's profile id.
 * - `paymentDetails` (bank / wallet data) is removed from the returned profile.
 *
 * The cookie is honoured only for a session whose role is ADMIN AND whose
 * user id matches the one written into the cookie, so a leftover cookie does
 * nothing for any other account. Any failure resolves to `null` (no view-as),
 * which falls back to the normal affiliate checks: fail closed.
 *
 * @module lib/affiliate/view-as
 */

import { cookies } from 'next/headers';

import type { AffiliateProfile } from '@/lib/affiliate/types';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

const isProduction = process.env.NODE_ENV === 'production';

export const VIEW_AS_COOKIE_NAME = isProduction
  ? '__Secure-davintrade-admin-view-as'
  : 'davintrade-admin-view-as';

/** A view-as session lasts two hours, then the admin picks again. */
export const VIEW_AS_MAX_AGE_SECONDS = 2 * 60 * 60;

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export interface AffiliateViewAsTarget {
  profileId: string;
  userId: string;
  fullName: string;
  email: string | null;
  status: string;
}

export interface AdminViewAs {
  adminUserId: string;
  target: AffiliateViewAsTarget;
  /** The target's profile, same shape as getAffiliateProfile(), bank data removed. */
  profile: AffiliateProfile;
}

export function viewAsCookieOptions(maxAge: number): {
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

export function encodeViewAsCookie(
  adminUserId: string,
  profileId: string
): string {
  return `${adminUserId}:${profileId}`;
}

export function decodeViewAsCookie(
  value: string | undefined | null
): { adminUserId: string; profileId: string } | null {
  if (!value) return null;
  const parts = value.split(':');
  if (parts.length !== 2) return null;
  const [adminUserId, profileId] = parts as [string, string];
  if (!ID_PATTERN.test(adminUserId) || !ID_PATTERN.test(profileId)) {
    return null;
  }
  return { adminUserId, profileId };
}

/**
 * Load an affiliate for viewing. Never creates anything: unlike
 * getAffiliateProfile(), a missing profile is simply `null`.
 */
export async function loadViewAsTarget(profileId: string): Promise<{
  target: AffiliateViewAsTarget;
  profile: AffiliateProfile;
} | null> {
  if (!ID_PATTERN.test(profileId)) return null;

  const row = await prisma.affiliateProfile.findUnique({
    where: { id: profileId },
  });
  if (!row) return null;

  const user = await prisma.user.findUnique({
    where: { id: row.userId },
    select: { email: true },
  });

  const profile = {
    ...row,
    paymentDetails: {},
    totalEarnings: Number(row.totalEarnings ?? 0),
    pendingCommissions: Number(row.pendingCommissions ?? 0),
    paidCommissions: Number(row.paidCommissions ?? 0),
  } as unknown as AffiliateProfile;

  return {
    target: {
      profileId: row.id,
      userId: row.userId,
      fullName: row.fullName,
      email: user?.email ?? null,
      status: String(row.status),
    },
    profile,
  };
}

/**
 * The affiliate the signed-in admin is currently viewing, or `null` when the
 * caller is not an admin, has no valid view-as cookie, or anything fails.
 */
export async function getAdminViewAs(): Promise<AdminViewAs | null> {
  try {
    const session = await getSession();
    if (session?.user?.role !== 'ADMIN' || !session.user.id) return null;

    const cookieStore = await cookies();
    const decoded = decodeViewAsCookie(
      cookieStore.get(VIEW_AS_COOKIE_NAME)?.value
    );
    if (!decoded || decoded.adminUserId !== session.user.id) return null;

    const loaded = await loadViewAsTarget(decoded.profileId);
    if (!loaded) return null;

    return { adminUserId: session.user.id, ...loaded };
  } catch {
    return null;
  }
}
