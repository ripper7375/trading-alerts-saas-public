"use client"

import { useState, useEffect } from "react"

interface AffiliateConfig {
  discountPercent: number
  commissionPercent: number
  calculateDiscountedPrice: (price: number) => number
}

/**
 * Hook to get dynamic affiliate configuration values
 * Returns discount percentage, commission percentage, and a helper function
 * to calculate discounted prices based on the current discount percentage
 */
export function useAffiliateConfig(): AffiliateConfig {
  // Default values - these would typically come from an API or context
  const [discountPercent, setDiscountPercent] = useState(20)
  const [commissionPercent, setCommissionPercent] = useState(20)

  // In a real implementation, you would fetch these from your backend/API
  useEffect(() => {
    // Example: fetch('/api/system-config/affiliate')
    //   .then(res => res.json())
    //   .then(data => {
    //     setDiscountPercent(data.discountPercent);
    //     setCommissionPercent(data.commissionPercent);
    //   });
  }, [])

  const calculateDiscountedPrice = (price: number): number => {
    return price * (1 - discountPercent / 100)
  }

  return {
    discountPercent,
    commissionPercent,
    calculateDiscountedPrice,
  }
}
