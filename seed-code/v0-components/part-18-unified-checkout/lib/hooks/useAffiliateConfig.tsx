"use client"

import { useState, useEffect } from "react"

interface AffiliateConfig {
  discountPercent: number
  commissionPercent: number
  calculateDiscountedPrice: (price: number) => number
  isLoading: boolean
  error: Error | null
}

export function useAffiliateConfig(): AffiliateConfig {
  const [discountPercent, setDiscountPercent] = useState(20)
  const [commissionPercent, setCommissionPercent] = useState(20)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // In production, this would fetch from your SystemConfig API
    // For now, using default values
    setDiscountPercent(20)
    setCommissionPercent(20)
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
