import { getServerSession as getServerSessionNext } from 'next-auth';
import type { Session } from 'next-auth';

import type { UserTier, UserRole } from '@/types';

import { authOptions } from './auth-options';
import { AuthError } from './errors';
// import { prisma } from '@/lib/db/prisma'; // TODO: Uncomment when affiliateProfile is implemented

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
 * @returns Promise resolving to NextAuth session or null
 */
export async function getSession(): Promise<Session | null> {
  try {
    return await getServerSessionNext(authOptions);
  } catch (error) {
    console.error('Failed to get server session:', error);
    return null;
  }
}

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
      throw new AuthError(
        'You must be an affiliate to access this resource',
        'AFFILIATE_REQUIRED',
        403
      );
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
 * @returns Promise resolving to affiliate profile or null
 */
export async function getAffiliateProfile(): Promise<null> {
  try {
    const session = await getSession();

    if (!session?.user?.id || !session.user?.isAffiliate) {
      return null;
    }

    // TODO: Uncomment when AffiliateProfile model is added to Prisma schema
    // Fetch affiliate profile from database
    // const affiliateProfile = await prisma.affiliateProfile.findUnique({
    //   where: { userId: session.user.id },
    // });

    // return affiliateProfile;
    return null; // Temporary: return null until schema is updated
  } catch (error) {
    console.error('Failed to fetch affiliate profile:', error);
    return null;
  }
}

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
      throw new AuthError(
        'You must be an administrator to access this resource',
        'ADMIN_REQUIRED',
        403
      );
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
