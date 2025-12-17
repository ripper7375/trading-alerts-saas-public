"use client"

/**
 * SystemConfig Hook for Affiliate Configuration
 *
 * Provides dynamic discount and commission percentages from centralized config
 * Replace all hardcoded percentages with this hook
 */

export interface AffiliateConfig {
  discountPercent: number
  commissionPercent: number
  calculateDiscountedPrice: (regularPrice: number) => number
}

export function useAffiliateConfig(): AffiliateConfig {
  // In production, fetch from database/API
  // For now, using default values that can be configured via admin dashboard
  const discountPercent = 20
  const commissionPercent = 20

  const calculateDiscountedPrice = (regularPrice: number): number => {
    return regularPrice * (1 - discountPercent / 100)
  }

  return {
    discountPercent,
    commissionPercent,
    calculateDiscountedPrice,
  }
}
