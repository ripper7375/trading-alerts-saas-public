'use client';

import { useState, useEffect } from 'react';

interface AffiliateConfig {
  discountPercent: number;
  calculateDiscountedPrice: (basePrice: number) => number;
  isLoading: boolean;
}

/**
 * Hook to fetch and manage affiliate configuration for dynamic discount percentages
 * This ensures all discount-related UI uses consistent, system-configured values
 */
export function useAffiliateConfig(): AffiliateConfig {
  const [discountPercent, setDiscountPercent] = useState<number>(20);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Simulate fetching system config from API
    // In production, this would fetch from: GET /api/system/config
    const fetchConfig = async () => {
      try {
        setIsLoading(true);

        // Mock API call - replace with actual endpoint
        // const response = await fetch('/api/system/config')
        // const config = await response.json()
        // setDiscountPercent(config.defaultDiscountPercent)

        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 300));

        // For demo purposes, using 20% as default
        // This can be dynamically changed based on system configuration
        setDiscountPercent(20);
      } catch (error) {
        console.error('Failed to fetch affiliate config:', error);
        // Fallback to default 20%
        setDiscountPercent(20);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const calculateDiscountedPrice = (basePrice: number): number => {
    return basePrice * (1 - discountPercent / 100);
  };

  return {
    discountPercent,
    calculateDiscountedPrice,
    isLoading,
  };
}
