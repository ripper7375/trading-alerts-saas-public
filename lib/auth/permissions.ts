import type { Session } from 'next-auth';

import { prisma } from '@/lib/db/prisma';
import type { UserTier } from '@/types';

import { AuthError } from './errors';
import { getSession } from './session';

/**
 * Permission System
 *
 * Provides comprehensive permission checking for SaaS users, affiliates, and admins.
 * Supports unified authentication where a single session can have multiple roles
 * (USER/ADMIN) and affiliate status.
 */

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. PERMISSION CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * SaaS Tier-Based Permissions
 * Defines what features each tier can access
 */
export const TIER_PERMISSIONS = {
  // V8: watchlists removed; alerts are a PRO-only feature
  FREE: ['view_dashboard', 'view_symbols', 'view_timeframes'],
  PRO: [
    'view_dashboard',
    'view_symbols',
    'view_timeframes',
    'create_alerts',
    'create_advanced_alerts',
    'multi_timeframe_visualization',
    'drawing_line_alerts',
    'export_data',
    'priority_support',
    'currency_index_pro',
  ],
} as const;

/**
 * Affiliate-Specific Permissions
 * Only available to users with isAffiliate = true
 */
export const AFFILIATE_PERMISSIONS = [
  'affiliate_dashboard',
  'affiliate_codes',
  'affiliate_commission_reports',
  'affiliate_profile',
  'affiliate_code_generation',
  'affiliate_earnings',
] as const;

/**
 * Admin-Only Permissions
 * Only available to users with role = 'ADMIN'
 */
export const ADMIN_PERMISSIONS = [
  'admin_dashboard',
  'admin_users',
  'admin_affiliates',
  'admin_settings',
  'admin_reports',
  'admin_system_config',
  'admin_tier_management',
  'admin_billing',
  'admin_logs',
] as const;

/**
 * All Available Permissions
 * Union type of all permissions
 */
export type Permission =
  | (typeof TIER_PERMISSIONS.FREE)[number]
  | (typeof TIER_PERMISSIONS.PRO)[number]
  | (typeof AFFILIATE_PERMISSIONS)[number]
  | (typeof ADMIN_PERMISSIONS)[number];

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. CORE PERMISSION FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if user has a specific permission
 *
 * @param user - User object with tier, role, and isAffiliate properties
 * @param permission - Permission to check
 * @returns true if user has permission, false otherwise
 */
export function hasPermission(
  user: {
    tier?: UserTier;
    role?: string;
    isAffiliate?: boolean;
  },
  permission: Permission
): boolean {
  try {
    // Admin has all permissions
    if (user.role === 'ADMIN') {
      return true;
    }

    // Check tier-based permissions
    const userTier = user.tier || 'FREE';
    const tierPermissions = TIER_PERMISSIONS[userTier];

    if (tierPermissions.some((p) => p === permission)) {
      return true;
    }

    // Check affiliate permissions
    if (AFFILIATE_PERMISSIONS.some((p) => p === permission)) {
      return Boolean(user.isAffiliate);
    }

    // Check admin permissions
    if (ADMIN_PERMISSIONS.some((p) => p === permission)) {
      return user.role === 'ADMIN';
    }

    return false;
  } catch (error) {
    console.error('Permission check failed:', error);
    return false;
  }
}

/**
 * Validate feature access based on user's current session
 *
 * @param permission - Permission to validate
 * @returns Promise resolving to true if access granted, throws AuthError if denied
 * @throws {AuthError} If user doesn't have permission
 */
export async function checkFeatureAccess(
  permission: Permission
): Promise<void> {
  try {
    const session = await getSession();

    if (!session?.user) {
      throw new AuthError(
        'You must be logged in to access this feature',
        'UNAUTHORIZED',
        401
      );
    }

    const hasAccess = hasPermission(session.user, permission);

    if (!hasAccess) {
      // Generate user-friendly error message
      let errorMessage = 'You do not have permission to access this feature';

      if (permission.startsWith('admin_')) {
        errorMessage = 'Administrator access required';
      } else if (permission.startsWith('affiliate_')) {
        errorMessage = 'Affiliate access required';
      } else if (
        // V8: PRO-exclusive = in PRO list but not in FREE list
        (TIER_PERMISSIONS.PRO as readonly string[]).includes(permission) &&
        !(TIER_PERMISSIONS.FREE as readonly string[]).includes(permission)
      ) {
        errorMessage = 'PRO subscription required for this feature';
      }

      throw new AuthError(errorMessage, 'INSUFFICIENT_PERMISSIONS', 403);
    }
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    console.error('Feature access validation failed:', error);
    throw new AuthError(
      'Unable to validate feature access',
      'PERMISSION_ERROR',
      500
    );
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. TIER-SPECIFIC MIDDLEWARE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Require PRO tier access
 * Throws AuthError if user doesn't have PRO tier
 *
 * @returns Promise resolving to user session
 * @throws {AuthError} If user is not on PRO tier
 */
export async function requirePro(): Promise<Session> {
  try {
    const session = await getSession();

    if (!session?.user) {
      throw new AuthError(
        'You must be logged in to access this feature',
        'UNAUTHORIZED',
        401
      );
    }

    if (session.user.tier !== 'PRO') {
      throw new AuthError(
        'This feature requires a PRO subscription',
        'PRO_REQUIRED',
        403
      );
    }

    return session;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    console.error('PRO tier verification failed:', error);
    throw new AuthError(
      'Unable to verify subscription tier',
      'TIER_ERROR',
      500
    );
  }
}

/**
 * Require access to the rendered multi-timeframe chart download.
 *
 * Same entitlement as `requireMultiTimeframe`, but it does not stop at the JWT.
 * `checkFeatureAccess` reads `session.user` from the token only, so a user who
 * has *just* upgraded to PRO still carries a stale `tier: 'FREE'` claim and
 * would be refused a feature they have paid for -- which reads as a billing
 * bug, not an auth subtlety.
 *
 * `requireAffiliate` already solves this for affiliate status by re-querying the
 * database when the claim is missing; this mirrors that precedent, deliberately
 * scoped to this one gate rather than changing `checkFeatureAccess` for every
 * PRO feature at once.
 *
 * The extra query only runs when the token says the user is NOT entitled, so the
 * common path (a PRO user with a fresh token) still costs nothing.
 *
 * Returns the session so callers have the user id without a second lookup --
 * the download route needs it to read the stored overlay preference. Mirrors
 * `requirePro()`, which also returns its session.
 *
 * @throws {AuthError} 401 when unauthenticated, 403 when not on PRO
 */
export async function requireChartDownload(): Promise<Session> {
  try {
    const session = await getSession();

    if (!session?.user) {
      throw new AuthError(
        'You must be logged in to download chart renders',
        'UNAUTHORIZED',
        401
      );
    }

    if (hasPermission(session.user, 'multi_timeframe_visualization')) {
      return session;
    }

    // Token says no. Ask the database before refusing -- it may simply be stale.
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tier: true },
    });

    if (dbUser?.tier === 'PRO') {
      return session;
    }

    throw new AuthError(
      'PRO subscription required to download chart renders',
      'PRO_REQUIRED',
      403
    );
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    console.error('Chart download access validation failed:', error);
    throw new AuthError(
      'Unable to validate chart download access',
      'PERMISSION_ERROR',
      500
    );
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. PERMISSION HELPER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get all permissions available to a user
 *
 * @param user - User object with tier, role, and isAffiliate properties
 * @returns Array of permissions available to the user
 */
export function getUserPermissions(user: {
  tier?: UserTier;
  role?: string;
  isAffiliate?: boolean;
}): Permission[] {
  try {
    const permissions: Permission[] = [];

    // Add tier-based permissions
    const userTier = user.tier || 'FREE';
    permissions.push(...TIER_PERMISSIONS[userTier]);

    // Add affiliate permissions if user is affiliate
    if (user.isAffiliate) {
      permissions.push(...AFFILIATE_PERMISSIONS);
    }

    // Add admin permissions if user is admin
    if (user.role === 'ADMIN') {
      permissions.push(...ADMIN_PERMISSIONS);
    }

    return permissions;
  } catch (error) {
    console.error('Failed to get user permissions:', error);
    return [];
  }
}

/**
 * Check if user has multiple permissions (all must be true)
 *
 * @param user - User object with tier, role, and isAffiliate properties
 * @param permissions - Array of permissions to check
 * @returns true if user has all permissions, false otherwise
 */
export function hasAllPermissions(
  user: {
    tier?: UserTier;
    role?: string;
    isAffiliate?: boolean;
  },
  permissions: Permission[]
): boolean {
  try {
    return permissions.every((permission) => hasPermission(user, permission));
  } catch (error) {
    console.error('Failed to check multiple permissions:', error);
    return false;
  }
}

/**
 * Check if user has any of the specified permissions (at least one must be true)
 *
 * @param user - User object with tier, role, and isAffiliate properties
 * @param permissions - Array of permissions to check
 * @returns true if user has any permission, false otherwise
 */
export function hasAnyPermission(
  user: {
    tier?: UserTier;
    role?: string;
    isAffiliate?: boolean;
  },
  permissions: Permission[]
): boolean {
  try {
    return permissions.some((permission) => hasPermission(user, permission));
  } catch (error) {
    console.error('Failed to check multiple permissions:', error);
    return false;
  }
}

/**
 * Validate multiple permissions (all must be granted)
 *
 * @param permissions - Array of permissions to validate
 * @returns Promise that resolves if all permissions granted, throws AuthError if any denied
 * @throws {AuthError} If user doesn't have any of the permissions
 */
export async function validateMultiplePermissions(
  permissions: Permission[]
): Promise<void> {
  try {
    const session = await getSession();

    if (!session?.user) {
      throw new AuthError(
        'You must be logged in to access these features',
        'UNAUTHORIZED',
        401
      );
    }

    const missingPermissions = permissions.filter(
      (permission) => !hasPermission(session.user, permission)
    );

    if (missingPermissions.length > 0) {
      throw new AuthError(
        `You don't have access to: ${missingPermissions.join(', ')}`,
        'INSUFFICIENT_PERMISSIONS',
        403
      );
    }
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    console.error('Multiple permission validation failed:', error);
    throw new AuthError(
      'Unable to validate permissions',
      'PERMISSION_ERROR',
      500
    );
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. PERMISSION MIDDLEWARE FACTORIES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create a permission middleware for a specific permission
 *
 * @param permission - Permission required
 * @returns Middleware function that validates permission
 */
export function createPermissionMiddleware(permission: Permission) {
  return async (): Promise<void> => {
    await checkFeatureAccess(permission);
  };
}

/**
 * Create a middleware that requires multiple permissions (all must be granted)
 *
 * @param permissions - Array of permissions required
 * @returns Middleware function that validates all permissions
 */
export function createMultiplePermissionMiddleware(permissions: Permission[]) {
  return async (): Promise<void> => {
    await validateMultiplePermissions(permissions);
  };
}

/**
 * Create a middleware that requires any of the specified permissions
 *
 * @param permissions - Array of permissions (user needs at least one)
 * @returns Middleware function that validates any permission
 */
export function createAnyPermissionMiddleware(permissions: Permission[]) {
  return async (): Promise<void> => {
    const session = await getSession();

    if (!session?.user) {
      throw new AuthError(
        'You must be logged in to access this feature',
        'UNAUTHORIZED',
        401
      );
    }

    const hasAny = hasAnyPermission(session.user, permissions);

    if (!hasAny) {
      throw new AuthError(
        `You need one of the following permissions: ${permissions.join(', ')}`,
        'INSUFFICIENT_PERMISSIONS',
        403
      );
    }
  };
}

// Pre-built middleware for common permission checks
export const requireAdmin = createPermissionMiddleware('admin_dashboard');
export const requireAffiliateDashboard = createPermissionMiddleware(
  'affiliate_dashboard'
);
export const requireProTier = requirePro;
// V8: PRO-exclusive feature middlewares
export const requireCreateAlerts = createPermissionMiddleware('create_alerts');
export const requireDrawingLineAlerts = createPermissionMiddleware(
  'drawing_line_alerts'
);
export const requireMultiTimeframe = createPermissionMiddleware(
  'multi_timeframe_visualization'
);
export const requireExportData = createPermissionMiddleware('export_data');
export const requireCurrencyIndexPro =
  createPermissionMiddleware('currency_index_pro');
