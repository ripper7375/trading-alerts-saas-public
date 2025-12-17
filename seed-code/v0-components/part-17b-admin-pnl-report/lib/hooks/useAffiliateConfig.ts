"use client"

import { useState } from "react"

interface AffiliateConfig {
  discountPercent: number
  commissionPercent: number
  calculateDiscountedPrice: (price: number) => number
  isLoading: boolean
  error: Error | null
}

/**
 * Hook to get dynamic affiliate configuration
 * In production, this would fetch from your SystemConfig API/database
 */
export function useAffiliateConfig(): AffiliateConfig {
  const [config, setConfig] = useState({
    discountPercent: 20,
    commissionPercent: 20,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // In production, fetch from API:
  // useEffect(() => {
  //   fetch('/api/system-config/affiliate')
  //     .then(res => res.json())
  //     .then(data => setConfig(data))
  // }, [])

  const calculateDiscountedPrice = (price: number): number => {
    return price * (1 - config.discountPercent / 100)
  }

  return {
    discountPercent: config.discountPercent,
    commissionPercent: config.commissionPercent,
    calculateDiscountedPrice,
    isLoading,
    error,
  }
}
