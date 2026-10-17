import 'server-only';

import { redirect } from 'next/navigation';
import { getServerSession as getServerSessionNext } from 'next-auth';
import type { Session } from 'next-auth';
import { cache } from 'react';

import type { AffiliateProfile } from '@/lib/affiliate/types';
import type { UserTier, UserRole } from '@/types';
import { prisma } from '@/lib/db/prisma';

import { authOptions } from './auth-options';
import { AuthError } from './errors';

/**
 * Session Helper Functions
 *
 * Provides unified authentication utilities for SaaS users, affiliates, and admins.
 * All functions support the unified authentication system where a single session
 * can have multiple roles (USER/ADMIN) and affiliate status.
 */

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. CORE SESSION WRAPPERS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get server session with NextAuth options
 * Wrapper around getServerSession to ensure consistent configuration
 *
 * Wrapped in React.cache(): during one Server Component render the root
 * layout, the segment layout, the page and every helper below share a single
 * JWE decryption. Outside a render (route handlers, server actions) cache()
 * is a pass-through, so API routes still read the session fresh on each call.
 * The returned object is shared within the render: the helpers that promote a
 * stale JWT claim after a database check (requireAdmin, requireAdminPage,
 * requireAffiliate) set the claim on it, and later readers in the same render
 * see the promoted value.
 *
 * @returns Promise resolving to NextAuth session or null
 */
export const getSession = cache(async (): Promise<Session | null> => {
  try {
    return await getServerSessionNext(authOptions);
  } catch (error) {
    console.error('Failed to get server session:', error);
    return null;
  }
});

/**
 * Get user session or throw AuthError if not authenticated
 *
 * @returns Promise resolving to authenticated session
 * @throws {AuthError} If user is not authenticated
 */
export async function requireAuth(): Promise<Session> {
  try {
    const session = await getSession();

    if (!session || !session.user?.id) {
      throw new AuthError(
        'You must be logged in to access this resource',
        'UNAUTHORIZED',
        401
      );
    }

    return session;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    console.error('Auth verification failed:', error);
    throw new AuthError('Unable to verify authentication', 'AUTH_ERROR', 401);
  }
}

/**
 * Get user session or return null (non-throwing)
 *
 * @returns Promise resolving to session or null
 */
export async function getUserSession(): Promise<Session | null> {
  try {
    return await getSession();
  } catch (error) {
    console.error('Failed to get user session:', error);
    return null;
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. USER PROPERTIES HELPERS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get user tier from session
 *
 * @returns Promise resolving to user tier or 'FREE' if not authenticated
 */
export async function getUserTier(): Promise<UserTier> {
  try {
    const session = await getSession();
    return (session?.user?.tier as UserTier) || 'FREE';
  } catch (error) {
    console.error('Failed to get user tier:', error);
    return 'FREE';
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. AFFILIATE HELPERS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if user is an affiliate
 *
 * @returns Promise resolving to true if user is affiliate, false otherwise
 */
export async function isAffiliate(): Promise<boolean> {
  try {
    const session = await getSession();
    return Boolean(session?.user?.isAffiliate);
  } catch (error) {
    console.error('Failed to check affiliate status:', error);
    return false;
  }
}

/**
 * Require affiliate access or throw AuthError
 *
 * @returns Promise resolving to authenticated session
 * @throws {AuthError} If user is not an affiliate
 */
export async function requireAffiliate(): Promise<Session> {
  try {
    const session = await requireAuth();

    if (!session.user?.isAffiliate) {
      // Check database directly to eliminate JWT stale session race condition
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, isAffiliate: true, role: true, tier: true },
      });

      if (!dbUser?.isAffiliate) {
        throw new AuthError(
          'You must be an affiliate to access this resource',
          'AFFILIATE_REQUIRED',
          403
        );
      }

      // Update session user in-memory
      session.user.isAffiliate = true;
    }

    return session;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    console.error('Affiliate verification failed:', error);
    throw new AuthError(
      'Unable to verify affiliate status',
      'AFFILIATE_ERROR',
      403
    );
  }
}

/**
 * Get affiliate profile for authenticated affiliate user
 *
 * Wrapped in React.cache(): the affiliate layout and its page share one
 * lookup (and at most one auto-create) per render. Outside a render it is a
 * pass-through.
 *
 * @returns Promise resolving to affiliate profile or null
 */
export const getAffiliateProfile = cache(
  async (): Promise<AffiliateProfile | null> => {
    try {
      const session = await getSession();

      if (!session?.user?.id) {
        return null;
      }

      let isAff = Boolean(session.user.isAffiliate);

      // Verify against DB to resolve any JWT token latency / race condition
      let dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, isAffiliate: true, name: true, email: true },
      });

      if (!dbUser && session.user.email) {
        dbUser = await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { id: true, isAffiliate: true, name: true, email: true },
        });
      }

      if (dbUser?.isAffiliate) {
        isAff = true;
      }

      if (!isAff) {
        return null;
      }

      const userId = dbUser?.id || session.user.id;

      // Fetch affiliate profile from database
      let affiliateProfile = await prisma.affiliateProfile.findUnique({
        where: { userId },
      });

      if (!affiliateProfile) {
        try {
          const baseCode = (
            dbUser?.name ||
            session.user.name ||
            dbUser?.email?.split('@')[0] ||
            session.user.email?.split('@')[0] ||
            'AFF'
          )
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 6);
          const code = `${baseCode}${Math.floor(100 + Math.random() * 900)}`;

          affiliateProfile = await prisma.affiliateProfile.upsert({
            where: { userId },
            update: {
              status: 'ACTIVE',
            },
            create: {
              userId,
              fullName:
                dbUser?.name || session.user.name || 'Affiliate Partner',
              country: 'US',
              paymentMethod: 'PAYPAL',
              paymentDetails: {},
              status: 'ACTIVE',
              verifiedAt: new Date(),
              affiliateCodes: {
                create: {
                  code,
                  discountPercent: 10,
                  commissionPercent: 15,
                  status: 'ACTIVE',
                  expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                },
              },
            },
          });
        } catch (createErr) {
          console.warn(
            '[Session] Auto-creating affiliate profile fallback:',
            createErr
          );
        }
      }

      if (!affiliateProfile) {
        return null;
      }

      return {
        ...affiliateProfile,
        totalEarnings: Number(affiliateProfile.totalEarnings ?? 0),
        pendingCommissions: Number(affiliateProfile.pendingCommissions ?? 0),
        paidCommissions: Number(affiliateProfile.paidCommissions ?? 0),
      } as unknown as AffiliateProfile;
    } catch (error) {
      console.error('Failed to fetch affiliate profile:', error);
      return null;
    }
  }
);

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. ADMIN HELPERS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if user has ADMIN role
 *
 * @returns Promise resolving to true if user is admin, false otherwise
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const session = await getSession();
    return session?.user?.role === 'ADMIN';
  } catch (error) {
    console.error('Failed to check admin status:', error);
    return false;
  }
}

/**
 * Require admin access or throw AuthError
 *
 * @returns Promise resolving to authenticated session
 * @throws {AuthError} If user is not an admin
 */
export async function requireAdmin(): Promise<Session> {
  try {
    const session = await requireAuth();

    if (session.user?.role !== 'ADMIN') {
      // Check database directly to eliminate JWT stale session race condition
      // (same pattern as requireAffiliate() above, Session 9-8a / DECISION-LOG.md F79 precedent)
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, role: true },
      });

      if (dbUser?.role !== 'ADMIN') {
        throw new AuthError(
          'You must be an administrator to access this resource',
          'ADMIN_REQUIRED',
          403
        );
      }

      // Update session user in-memory
      session.user.role = 'ADMIN';
    }

    return session;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    console.error('Admin verification failed:', error);
    throw new AuthError(
      'Unable to verify administrator status',
      'ADMIN_ERROR',
      403
    );
  }
}

/**
 * Page-level admin guard for Server Component pages under app/admin/**.
 *
 * `app/admin/layout.tsx` and `middleware.ts` already check the role, but in
 * the App Router a layout and its page render in parallel and a client
 * navigation can fetch the page's RSC payload on its own, so a page that
 * reads data must not rely on the layout alone. Call
 * `await requireAdminPage()` first in every such page.
 *
 * Unlike `requireAdmin()` (route handlers, throws AuthError) this redirects:
 * a signed-out visitor goes to /login, a signed-in non-admin to /dashboard.
 * It has the same database fallback as `requireAdmin()` and the layout, so a
 * freshly promoted admin with a stale JWT role claim is not bounced by the
 * page while the layout lets them through. A database error is not caught:
 * the page fails (an error, never admin content), as the layout does.
 *
 * Wrapped in React.cache(), so the layout, the page and any component that
 * calls it in one request share a single session read and one role lookup.
 *
 * @returns Promise resolving to the admin session
 */
export const requireAdminPage = cache(async (): Promise<Session> => {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect('/login');
  }

  if (session.user.role !== 'ADMIN') {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (dbUser?.role !== 'ADMIN') {
      redirect('/dashboard?error=forbidden');
    }

    session.user.role = 'ADMIN';
  }

  return session;
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. COMPOSED PERMISSION HELPERS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if user has any of the specified roles
 *
 * @param roles - Array of roles to check
 * @returns Promise resolving to true if user has any role, false otherwise
 */
export async function hasAnyRole(roles: UserRole[]): Promise<boolean> {
  try {
    const session = await getSession();
    const userRole = session?.user?.role as UserRole;
    return roles.includes(userRole);
  } catch (error) {
    console.error('Failed to check user roles:', error);
    return false;
  }
}

/**
 * Check if user has all of the specified roles
 *
 * @param roles - Array of roles to check
 * @returns Promise resolving to true if user has all roles, false otherwise
 */
export async function hasAllRoles(roles: UserRole[]): Promise<boolean> {
  try {
    const session = await getSession();
    const userRole = session?.user?.role as UserRole;
    return roles.every((role) => role === userRole);
  } catch (error) {
    console.error('Failed to check user roles:', error);
    return false;
  }
}

/**
 * Require any of the specified roles or throw AuthError
 *
 * @param roles - Array of roles to check
 * @returns Promise resolving to authenticated session
 * @throws {AuthError} If user doesn't have any of the specified roles
 */
export async function requireAnyRole(roles: UserRole[]): Promise<Session> {
  try {
    const session = await requireAuth();
    const userRole = session.user?.role as UserRole;

    if (!roles.includes(userRole)) {
      throw new AuthError(
        `You must have one of the following roles: ${roles.join(', ')}`,
        'INSUFFICIENT_ROLE',
        403
      );
    }

    return session;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    console.error('Role verification failed:', error);
    throw new AuthError('Unable to verify user roles', 'ROLE_ERROR', 403);
  }
}
