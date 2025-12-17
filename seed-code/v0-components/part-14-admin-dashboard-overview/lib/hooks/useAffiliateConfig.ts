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
 * Hook to get dynamic affiliate configuration from SystemConfig
 * Returns current discount and commission percentages
 */
export function useAffiliateConfig(): AffiliateConfig {
  const [discountPercent, setDiscountPercent] = useState<number>(20)
  const [commissionPercent, setCommissionPercent] = useState<number>(20)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Simulate fetching config from API
    // In production, this would call: fetch('/api/admin/system-config')
    const fetchConfig = async () => {
      try {
        setIsLoading(true)
        // Mock API call - replace with actual API endpoint
        await new Promise((resolve) => setTimeout(resolve, 100))

        // These values would come from your SystemConfig database
        setDiscountPercent(20)
        setCommissionPercent(20)
        setError(null)
      } catch (err) {
        setError("Failed to load affiliate configuration")
        console.error("Error fetching affiliate config:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchConfig()
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
