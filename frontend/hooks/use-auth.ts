'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useCallback } from 'react';

import type { Tier } from '@/lib/tier-config';
import {
  FREE_SYMBOLS,
  FREE_TIMEFRAMES,
  PRO_SYMBOLS,
  PRO_TIMEFRAMES,
} from '@/lib/tier-config';

/**
 * User role type
 */
type UserRole = 'USER' | 'ADMIN';

/**
 * Auth status type
 */
type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * useAuth hook return type
 */
interface UseAuthResult {
  /** NextAuth session object */
  session: ReturnType<typeof useSession>['data'];
  /** Current auth status: 'loading', 'authenticated', or 'unauthenticated' */
  status: AuthStatus;
  /** Whether auth is currently loading */
  isLoading: boolean;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** User's subscription tier */
  tier: Tier;
  /** User's ID */
  userId: string | null;
  /** User's email */
  userEmail: string | null;
  /** User's display name */
  userName: string | null;
  /** User's profile image URL */
  userImage: string | null;
  /** User's role */
  userRole: UserRole;
  /** Whether user is an affiliate */
  isAffiliate: boolean;
  /** Sign out function */
  logout: () => Promise<void>;
  /** Get symbols available for user's tier */
  getAvailableSymbols: () => readonly string[];
  /** Get timeframes available for user's tier */
  getAvailableTimeframes: () => readonly string[];
  /** Check if user can access a specific symbol */
  canAccessSymbol: (symbol: string) => boolean;
  /** Check if user can access a specific timeframe */
  canAccessTimeframe: (timeframe: string) => boolean;
  /** Check if user can access a symbol/timeframe combination */
  canAccessChart: (symbol: string, timeframe: string) => boolean;
}

/**
 * useAuth Hook
 *
 * React hook for accessing authentication session and user tier.
 * Provides tier-based helper functions for access control.
 *
 * Features:
 * - Access to session data (user ID, email, tier, role)
 * - Loading and authentication status
 * - Tier-based symbol/timeframe access helpers
 * - Sign out functionality
 *
 * @returns Auth data and helper functions
 *
 * @example
 * const { isAuthenticated, tier, canAccessSymbol } = useAuth();
 *
 * if (!isAuthenticated) {
 *   return <LoginPrompt />;
 * }
 *
 * if (!canAccessSymbol('AUDJPY')) {
 *   return <UpgradePrompt />;
 * }
 */
export function useAuth(): UseAuthResult {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Derive values from session
  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated';
  const tier = (session?.user?.tier as Tier) || 'FREE';
  const userId = session?.user?.id || null;
  const userEmail = session?.user?.email || null;
  const userName = session?.user?.name || null;
  const userImage = session?.user?.image || null;
  const userRole = (session?.user?.role as UserRole) || 'USER';
  const isAffiliate = session?.user?.isAffiliate || false;

  /**
   * Sign out and redirect to login
   */
  const logout = useCallback(async (): Promise<void> => {
    await signOut({ redirect: false });
    router.push('/login');
  }, [router]);

  /**
   * Get symbols available for current tier
   */
  const getAvailableSymbols = useCallback((): readonly string[] => {
    return tier === 'PRO' ? PRO_SYMBOLS : FREE_SYMBOLS;
  }, [tier]);

  /**
   * Get timeframes available for current tier
   */
  const getAvailableTimeframes = useCallback((): readonly string[] => {
    return tier === 'PRO' ? PRO_TIMEFRAMES : FREE_TIMEFRAMES;
  }, [tier]);

  /**
   * Check if user can access a specific symbol
   */
  const canAccessSymbol = useCallback(
    (symbol: string): boolean => {
      const symbols = getAvailableSymbols();
      return symbols.includes(symbol as (typeof symbols)[number]);
    },
    [getAvailableSymbols]
  );

  /**
   * Check if user can access a specific timeframe
   */
  const canAccessTimeframe = useCallback(
    (timeframe: string): boolean => {
      const timeframes = getAvailableTimeframes();
      return timeframes.includes(timeframe as (typeof timeframes)[number]);
    },
    [getAvailableTimeframes]
  );

  /**
   * Check if user can access a symbol/timeframe combination
   */
  const canAccessChart = useCallback(
    (symbol: string, timeframe: string): boolean => {
      return canAccessSymbol(symbol) && canAccessTimeframe(timeframe);
    },
    [canAccessSymbol, canAccessTimeframe]
  );

  return {
    session,
    status,
    isLoading,
    isAuthenticated,
    tier,
    userId,
    userEmail,
    userName,
    userImage,
    userRole,
    isAffiliate,
    logout,
    getAvailableSymbols,
    getAvailableTimeframes,
    canAccessSymbol,
    canAccessTimeframe,
    canAccessChart,
  };
}

/**
 * useRequireAuth Hook
 *
 * Hook that redirects to login if user is not authenticated.
 * Use in protected client components.
 *
 * @param redirectUrl - URL to redirect to if not authenticated (default: '/login')
 * @returns Loading and authentication status
 *
 * @example
 * function ProtectedPage() {
 *   const { isLoading, isAuthenticated } = useRequireAuth();
 *
 *   if (isLoading) return <Loading />;
 *   if (!isAuthenticated) return null; // Redirect happens automatically
 *
 *   return <ProtectedContent />;
 * }
 */
export function useRequireAuth(redirectUrl = '/login'): {
  isLoading: boolean;
  isAuthenticated: boolean;
} {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(redirectUrl);
    }
  }, [isLoading, isAuthenticated, router, redirectUrl]);

  return { isLoading, isAuthenticated };
}

/**
 * useRequireTier Hook
 *
 * Hook that checks if user has required tier.
 * Does not redirect - caller should handle access denial.
 *
 * @param requiredTier - Minimum required tier
 * @returns Whether user has required tier
 *
 * @example
 * function ProFeature() {
 *   const { hasTier } = useRequireTier('PRO');
 *
 *   if (!hasTier) return <UpgradePrompt />;
 *
 *   return <ProContent />;
 * }
 */
export function useRequireTier(requiredTier: Tier): {
  hasTier: boolean;
  currentTier: Tier;
} {
  const { tier } = useAuth();

  // PRO tier has access to everything
  // FREE tier only has access to FREE tier features
  const hasTier = requiredTier === 'FREE' || tier === 'PRO';

  return { hasTier, currentTier: tier };
}
