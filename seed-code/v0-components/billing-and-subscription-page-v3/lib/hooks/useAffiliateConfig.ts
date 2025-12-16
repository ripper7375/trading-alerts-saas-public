'use client';

import { useState, useEffect } from 'react';

interface SystemConfig {
  discountPercent: number;
  commissionPercent: number;
  createdAt: string;
  updatedAt: string;
}

interface UseAffiliateConfigReturn {
  discountPercent: number;
  commissionPercent: number;
  calculateDiscountedPrice: (price: number) => number;
  config: SystemConfig | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to access SystemConfig for dynamic affiliate discount and commission percentages
 * Ensures all discount calculations are based on centralized configuration
 */
export function useAffiliateConfig(): UseAffiliateConfigReturn {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchConfig() {
      try {
        setIsLoading(true);

        // In production, this would fetch from your API endpoint
        // const response = await fetch('/api/system/config')
        // const data = await response.json()

        // Mock data for demonstration - replace with actual API call
        const mockConfig: SystemConfig = {
          discountPercent: 20,
          commissionPercent: 20,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setConfig(mockConfig);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error('Failed to fetch config')
        );
        console.error('Error fetching SystemConfig:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchConfig();
  }, []);

  /**
   * Calculate discounted price based on SystemConfig percentage
   * @param price - Original price
   * @returns Discounted price rounded to 2 decimal places
   */
  const calculateDiscountedPrice = (price: number): number => {
    if (!config) return price;
    const discountAmount = price * (config.discountPercent / 100);
    return Number((price - discountAmount).toFixed(2));
  };

  return {
    discountPercent: config?.discountPercent ?? 0,
    commissionPercent: config?.commissionPercent ?? 0,
    calculateDiscountedPrice,
    config,
    isLoading,
    error,
  };
}
