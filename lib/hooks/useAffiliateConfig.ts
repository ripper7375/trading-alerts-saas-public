/**
 * useAffiliateConfig Hook
 *
 * Fetches dynamic affiliate configuration from SystemConfig.
 * Admin can change discount and commission percentages from dashboard,
 * and all pages using this hook will automatically update within 5 minutes.
 *
 * @module lib/hooks/useAffiliateConfig
 */

'use client';

import useSWR from 'swr';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Affiliate configuration from SystemConfig
 */
export interface AffiliateConfig {
  /** Customer discount percentage (e.g., 20 for 20%) */
  discountPercent: number;
  /** Affiliate commission percentage (e.g., 20 for 20%) */
  commissionPercent: number;
  /** Number of codes distributed per affiliate per month */
  codesPerMonth: number;
  /** Base subscription price in USD */
  regularPrice: number;
  /** ISO timestamp of when config was last updated */
  lastUpdated: string;
}

/**
 * Return type for useAffiliateConfig hook
 */
export interface UseAffiliateConfigReturn {
  /** Full configuration object (undefined while loading) */
  config: AffiliateConfig | undefined;
  /** Current discount percentage (default: 20) */
  discountPercent: number;
  /** Current commission percentage (default: 20) */
  commissionPercent: number;
  /** Number of codes distributed per month (default: 15) */
  codesPerMonth: number;
  /** Base subscription price (default: 29.00) */
  regularPrice: number;
  /** Helper function to calculate discounted price */
  calculateDiscountedPrice: (price: number) => number;
  /** Helper function to calculate commission amount */
  calculateCommissionAmount: (price: number) => number;
  /** Helper function to calculate discount amount */
  calculateDiscountAmount: (price: number) => number;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | undefined;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DEFAULT VALUES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Default values used when config is loading or unavailable */
const DEFAULTS = {
  discountPercent: 20,
  commissionPercent: 20,
  codesPerMonth: 15,
  regularPrice: 29.0,
} as const;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FETCHER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Fetch affiliate config from API
 */
async function fetcher(url: string): Promise<AffiliateConfig> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch affiliate config');
  }
  return response.json();
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HOOK
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Hook to fetch dynamic affiliate configuration from SystemConfig.
 *
 * Configuration is cached with SWR and auto-refreshes every 5 minutes.
 * Revalidates on window focus for near real-time updates.
 *
 * @returns Affiliate configuration with helper functions
 *
 * @example
 * ```tsx
 * 'use client';
 *
 * import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';
 *
 * export default function PricingComponent() {
 *   const {
 *     discountPercent,
 *     commissionPercent,
 *     calculateDiscountedPrice,
 *     isLoading
 *   } = useAffiliateConfig();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   const regularPrice = 29.00;
 *   const discountedPrice = calculateDiscountedPrice(regularPrice);
 *
 *   return (
 *     <div>
 *       <p>Regular price: ${regularPrice.toFixed(2)}</p>
 *       <p>With affiliate code: ${discountedPrice.toFixed(2)}</p>
 *       <p>You save: {discountPercent}%</p>
 *       <p>Earn {commissionPercent}% commission per sale!</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAffiliateConfig(): UseAffiliateConfigReturn {
  const { data, error, isLoading } = useSWR<AffiliateConfig>(
    '/api/config/affiliate',
    fetcher,
    {
      // Refresh every 5 minutes
      refreshInterval: 300000,
      // Deduplicate requests within 1 minute
      dedupingInterval: 60000,
      // Revalidate when user focuses window
      revalidateOnFocus: true,
      // Don't revalidate on reconnect (data is relatively static)
      revalidateOnReconnect: false,
      // Keep previous data while revalidating
      keepPreviousData: true,
      // Fallback data for SSR
      fallbackData: undefined,
    }
  );

  // Get current values with fallback to defaults
  const discountPercent = data?.discountPercent ?? DEFAULTS.discountPercent;
  const commissionPercent = data?.commissionPercent ?? DEFAULTS.commissionPercent;
  const codesPerMonth = data?.codesPerMonth ?? DEFAULTS.codesPerMonth;
  const regularPrice = data?.regularPrice ?? DEFAULTS.regularPrice;

  /**
   * Calculate price after applying affiliate discount
   * @param price - Original price
   * @returns Price after discount
   */
  const calculateDiscountedPrice = (price: number): number => {
    return price * (1 - discountPercent / 100);
  };

  /**
   * Calculate commission amount from discounted price
   * @param price - Original price (will apply discount first)
   * @returns Commission amount affiliate earns
   */
  const calculateCommissionAmount = (price: number): number => {
    const discountedPrice = calculateDiscountedPrice(price);
    return discountedPrice * (commissionPercent / 100);
  };

  /**
   * Calculate discount amount
   * @param price - Original price
   * @returns Amount saved with affiliate discount
   */
  const calculateDiscountAmount = (price: number): number => {
    return price * (discountPercent / 100);
  };

  return {
    config: data,
    discountPercent,
    commissionPercent,
    codesPerMonth,
    regularPrice,
    calculateDiscountedPrice,
    calculateCommissionAmount,
    calculateDiscountAmount,
    isLoading,
    error,
  };
}

export default useAffiliateConfig;
