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
  const [config, setConfig] = useState({
    discountPercent: 20,
    commissionPercent: 20,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // In production, this would fetch from your SystemConfig API
    // For now, using default values
    const fetchConfig = async () => {
      try {
        setIsLoading(true)
        // Simulated API call
        // const response = await fetch('/api/system-config')
        // const data = await response.json()
        // setConfig(data)
        setIsLoading(false)
      } catch (err) {
        setError(err as Error)
        setIsLoading(false)
      }
    }

    fetchConfig()
  }, [])

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
