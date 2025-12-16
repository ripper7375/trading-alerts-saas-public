'use client';

import { useState, useEffect } from 'react';

// SystemConfig interface
interface SystemConfig {
  discountPercent: number;
  commissionPercent: number;
}

// Hook return type
interface UseAffiliateConfigReturn {
  discountPercent: number;
  commissionPercent: number;
  calculateDiscountedPrice: (originalPrice: number) => number;
  config: SystemConfig | null;
  isLoading: boolean;
}

/**
 * Hook to fetch and manage affiliate configuration from SystemConfig
 * Provides dynamic discount and commission percentages
 */
export function useAffiliateConfig(): UseAffiliateConfigReturn {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching config from backend/database
    // In production, this would be an API call to fetch SystemConfig
    const fetchConfig = async () => {
      try {
        // TODO: Replace with actual API call to fetch SystemConfig
        // const response = await fetch('/api/system-config')
        // const data = await response.json()

        // Mock data for now - replace with real API call
        const mockConfig: SystemConfig = {
          discountPercent: 20, // 20% discount for affiliates
          commissionPercent: 20, // 20% commission for affiliates
        };

        setConfig(mockConfig);
      } catch (error) {
        console.error('Failed to fetch affiliate config:', error);
        // Fallback to default values if fetch fails
        setConfig({
          discountPercent: 20,
          commissionPercent: 20,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, []);

  /**
   * Calculate discounted price based on current discount percentage
   * @param originalPrice - The original price before discount
   * @returns The discounted price rounded to 2 decimal places
   */
  const calculateDiscountedPrice = (originalPrice: number): number => {
    if (!config) return originalPrice;
    const discount = (originalPrice * config.discountPercent) / 100;
    return Number((originalPrice - discount).toFixed(2));
  };

  return {
    discountPercent: config?.discountPercent ?? 0,
    commissionPercent: config?.commissionPercent ?? 0,
    calculateDiscountedPrice,
    config,
    isLoading,
  };
}
