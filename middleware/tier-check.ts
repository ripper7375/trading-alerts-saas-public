import { NextRequest, NextResponse } from 'next/server';

import type { Tier } from '../lib/tier-validation';
import {
  canAccessSymbol,
  validateTimeframeAccess,
  validateChartAccess,
} from '../lib/tier-validation';

/**
 * Middleware for tier-based access control
 */

export interface TierCheckResult {
  allowed: boolean;
  tier: Tier;
  reason?: string;
}

/**
 * Extract tier from session or headers
 */
export function extractTierFromRequest(req: NextRequest): Tier {
  // Try to get tier from session cookie first
  const sessionCookie =
    req.cookies.get('next-auth.session-token') ||
    req.cookies.get('__Secure-next-auth.session-token');

  if (sessionCookie) {
    // In a real implementation, you'd decode the JWT token here
    // For now, we'll assume the tier is in a separate cookie
    const tierCookie = req.cookies.get('user-tier')?.value as Tier;
    if (tierCookie && (tierCookie === 'FREE' || tierCookie === 'PRO')) {
      return tierCookie;
    }
  }

  // Fallback to header (for development/testing)
  const tierHeader = req.headers.get('x-user-tier') as Tier;
  if (tierHeader && (tierHeader === 'FREE' || tierHeader === 'PRO')) {
    return tierHeader;
  }

  // Default to FREE if no tier found
  return 'FREE';
}

/**
 * Check tier access for a specific resource
 */
export function checkTierAccess(
  req: NextRequest,
  requiredTier: Tier,
  resource: string
): TierCheckResult {
  const userTier = extractTierFromRequest(req);

  // Check if user's tier meets the requirement
  if (userTier === 'PRO' || (userTier === 'FREE' && requiredTier === 'FREE')) {
    return {
      allowed: true,
      tier: userTier,
    };
  }

  return {
    allowed: false,
    tier: userTier,
    reason: `${resource} requires ${requiredTier} tier.`,
  };
}

/**
 * Check symbol access
 */
export function checkSymbolAccess(
  req: NextRequest,
  symbol: string
): TierCheckResult {
  const userTier = extractTierFromRequest(req);

  if (canAccessSymbol(userTier, symbol)) {
    return {
      allowed: true,
      tier: userTier,
    };
  }

  return {
    allowed: false,
    tier: userTier,
    reason: `Symbol ${symbol} is not available in your ${userTier} tier.`,
  };
}

/**
 * Check timeframe access
 */
export function checkTimeframeAccess(
  req: NextRequest,
  timeframe: string
): TierCheckResult {
  const userTier = extractTierFromRequest(req);

  const result = validateTimeframeAccess(userTier, timeframe);
  if (result.allowed) {
    return {
      allowed: true,
      tier: userTier,
    };
  }

  return {
    allowed: false,
    tier: userTier,
    reason:
      result.reason ||
      `Timeframe ${timeframe} is not available in your ${userTier} tier.`,
  };
}

/**
 * Check chart access (symbol + timeframe)
 */
export function checkChartAccess(
  req: NextRequest,
  symbol: string,
  timeframe: string
): TierCheckResult {
  const userTier = extractTierFromRequest(req);

  const result = validateChartAccess(userTier, symbol, timeframe);
  if (result.allowed) {
    return {
      allowed: true,
      tier: userTier,
    };
  }

  return {
    allowed: false,
    tier: userTier,
    reason:
      result.reason ||
      `Chart ${symbol}/${timeframe} is not available in your ${userTier} tier.`,
  };
}

/**
 * Create a Next.js middleware function for tier protection
 */
export function createTierMiddleware(
  paths: Array<{ pattern: string; requiredTier: Tier; resource: string }>
): (req: NextRequest) => Promise<NextResponse> {
  return async function middleware(req: NextRequest): Promise<NextResponse> {
    const pathname = req.nextUrl.pathname;

    // Check if current path matches any protected patterns
    for (const { pattern, requiredTier, resource } of paths) {
      // Simple pattern matching (you might want to use a more sophisticated matcher)
      if (pathname.startsWith(pattern)) {
        const accessCheck = checkTierAccess(req, requiredTier, resource);

        if (!accessCheck.allowed) {
          // Redirect to upgrade page or return error
          if (pathname.startsWith('/api/')) {
            // For API routes, return JSON error
            return NextResponse.json(
              {
                error: 'Tier restriction',
                message: accessCheck.reason,
                currentTier: accessCheck.tier,
                requiredTier,
              },
              { status: 403 }
            );
          } else {
            // For pages, redirect to pricing/upgrade
            const upgradeUrl = new URL('/pricing', req.url);
            upgradeUrl.searchParams.set('reason', accessCheck.reason || '');
            return NextResponse.redirect(upgradeUrl);
          }
        }

        // Access allowed, continue to next middleware
        break;
      }
    }

    return NextResponse.next();
  };
}

/**
 * Helper to determine if user is PRO
 */
export function isProUser(req: NextRequest): boolean {
  const userTier = extractTierFromRequest(req);
  return userTier === 'PRO';
}

/**
 * Helper to determine if user is FREE
 */
export function isFreeUser(req: NextRequest): boolean {
  const userTier = extractTierFromRequest(req);
  return userTier === 'FREE';
}
