"use client"

import { useState, useEffect } from "react"

interface AffiliateConfig {
  discountPercent: number
  commissionPercent: number
  calculateDiscountedPrice: (price: number) => number
  isLoading: boolean
  error: string | null
}

/**
 * Hook to get dynamic affiliate discount and commission percentages
 * In production, this would fetch from your SystemConfig API
 */
export function useAffiliateConfig(): AffiliateConfig {
  const [discountPercent, setDiscountPercent] = useState(20)
  const [commissionPercent, setCommissionPercent] = useState(20)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // In production, fetch from your SystemConfig API
    // For now, using default values
    setIsLoading(false)
    setError(null)
  }, [])

  const calculateDiscountedPrice = (price: number): number => {
    return price * (1 - discountPercent / 100)
  }

  return {
    discountPercent,
    commissionPercent,
    calculateDiscountedPrice,
    isLoading,
    error,
  }
}
