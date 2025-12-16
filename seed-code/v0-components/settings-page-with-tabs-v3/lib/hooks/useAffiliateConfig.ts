'use client';

import { useState, useEffect } from 'react';

interface SystemConfig {
  affiliateDiscountPercent: number;
  affiliateCommissionPercent: number;
  baseMonthlyPrice: number;
}

interface UseAffiliateConfigReturn {
  discountPercent: number;
  commissionPercent: number;
  calculateDiscountedPrice: (basePrice: number) => number;
  config: SystemConfig;
  isLoading: boolean;
}

/**
 * Hook to manage affiliate configuration and discount calculations
 * Provides dynamic discount percentages and price calculations from SystemConfig
 */
export function useAffiliateConfig(): UseAffiliateConfigReturn {
  const [config, setConfig] = useState<SystemConfig>({
    affiliateDiscountPercent: 20, // Default 20% affiliate discount
    affiliateCommissionPercent: 20, // Default 20% affiliate commission
    baseMonthlyPrice: 29.0,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // In a real app, fetch config from API or context
    // For now, we'll use the default values
    const fetchConfig = async () => {
      setIsLoading(true);
      try {
        // Simulate API call
        // const response = await fetch('/api/system-config')
        // const data = await response.json()
        // setConfig(data)

        // For demo purposes, using default config
        setConfig({
          affiliateDiscountPercent: 20,
          affiliateCommissionPercent: 20,
          baseMonthlyPrice: 29.0,
        });
      } catch (error) {
        console.error('Failed to fetch system config:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, []);

  /**
   * Calculate discounted price based on affiliate discount percentage
   * @param basePrice - The original price before discount
   * @returns The discounted price
   */
  const calculateDiscountedPrice = (basePrice: number): number => {
    const discount = basePrice * (config.affiliateDiscountPercent / 100);
    return basePrice - discount;
  };

  return {
    discountPercent: config.affiliateDiscountPercent,
    commissionPercent: config.affiliateCommissionPercent,
    calculateDiscountedPrice,
    config,
    isLoading,
  };
}
