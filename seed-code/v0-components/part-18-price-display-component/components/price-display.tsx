"use client"

import { useState } from "react"
import { useAffiliateConfig } from "@/lib/hooks/useAffiliateConfig"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Loader2 } from "lucide-react"

interface PriceDisplayProps {
  planType: "3day" | "monthly"
  hasDiscount: boolean
  discountCode?: string
}

interface Currency {
  code: string
  symbol: string
  flag: string
  name: string
  rate: number
}

const currencies: Record<string, Currency> = {
  INR: { code: "INR", symbol: "₹", flag: "🇮🇳", name: "Indian Rupee", rate: 83.0 },
  NGN: { code: "NGN", symbol: "₦", flag: "🇳🇬", name: "Nigerian Naira", rate: 780.0 },
  PKR: { code: "PKR", symbol: "Rs", flag: "🇵🇰", name: "Pakistani Rupee", rate: 278.0 },
  VND: { code: "VND", symbol: "₫", flag: "🇻🇳", name: "Vietnamese Dong", rate: 24500.0 },
  IDR: { code: "IDR", symbol: "Rp", flag: "🇮🇩", name: "Indonesian Rupiah", rate: 15600.0 },
  THB: { code: "THB", symbol: "฿", flag: "🇹🇭", name: "Thai Baht", rate: 35.0 },
  ZAR: { code: "ZAR", symbol: "R", flag: "🇿🇦", name: "South African Rand", rate: 18.5 },
  TRY: { code: "TRY", symbol: "₺", flag: "🇹🇷", name: "Turkish Lira", rate: 32.0 },
  USD: { code: "USD", symbol: "$", flag: "🇺🇸", name: "United States Dollar", rate: 1.0 },
}

export default function PriceDisplay({ planType, hasDiscount, discountCode }: PriceDisplayProps) {
  // ✅ CRITICAL: Use SystemConfig hook for dynamic percentages
  const {
    discountPercent,
    calculateDiscountedPrice,
    isLoading: configLoading,
    error: configError,
  } = useAffiliateConfig()

  const [selectedCurrency, setSelectedCurrency] = useState<string>("INR")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [showPlanToggle, setShowPlanToggle] = useState(false)

  const currency = currencies[selectedCurrency]

  // Price logic - base prices in USD
  const regularPriceUSD = planType === "3day" ? 1.99 : 29.0
  const discountedPriceUSD = hasDiscount ? calculateDiscountedPrice(regularPriceUSD) : regularPriceUSD
  const savingsUSD = regularPriceUSD - discountedPriceUSD

  // Alternative plan (for comparison)
  const altPlanType = planType === "3day" ? "monthly" : "3day"
  const altPriceUSD = altPlanType === "3day" ? 1.99 : 29.0
  const altDiscountedUSD = hasDiscount ? calculateDiscountedPrice(altPriceUSD) : altPriceUSD

  // Convert to local currency
  const regularPriceLocal = regularPriceUSD * currency.rate
  const discountedPriceLocal = discountedPriceUSD * currency.rate
  const savingsLocal = savingsUSD * currency.rate

  // Alternative plan prices
  const altPriceLocal = altPriceUSD * currency.rate
  const altDiscountedLocal = altDiscountedUSD * currency.rate

  // Calculate savings vs monthly (for 3-day plan)
  const monthlySavingsPercent = planType === "3day" ? Math.round((1 - regularPriceUSD / 29.0) * 100) : 0

  const formatPrice = (amount: number, decimals = 0): string => {
    return amount.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  }

  const getTimeSinceUpdate = (): string => {
    const minutes = Math.floor((Date.now() - lastUpdated.getTime()) / 60000)
    if (minutes < 1) return "just now"
    if (minutes === 1) return "1 minute ago"
    if (minutes < 60) return `${minutes} minutes ago`
    const hours = Math.floor(minutes / 60)
    if (hours === 1) return "1 hour ago"
    return `${hours} hours ago`
  }

  const refreshRate = async () => {
    setIsRefreshing(true)
    // Simulate API call for exchange rate
    await new Promise((resolve) => setTimeout(resolve, 500))
    setLastUpdated(new Date())
    setIsRefreshing(false)
  }

  if (configLoading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (configError) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="py-8">
          <p className="text-sm text-destructive text-center mb-4">{configError}</p>
          <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Plan Pricing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Price Display */}
        <div className="text-center">
          {hasDiscount && (
            <p className="text-2xl line-through text-muted-foreground mb-1">
              {currency.symbol}
              {formatPrice(regularPriceLocal)}
            </p>
          )}
          <p className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {currency.symbol}
            {formatPrice(discountedPriceLocal)}
          </p>
          <p className="text-sm text-muted-foreground mt-2">{currency.name}</p>
          {selectedCurrency !== "USD" && (
            <p className="text-lg text-muted-foreground mt-2">≈ ${formatPrice(discountedPriceUSD, 2)} USD</p>
          )}
        </div>

        {/* Exchange Rate Info */}
        {selectedCurrency !== "USD" && (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Badge variant="secondary" className="text-xs font-normal px-3 py-1">
                Exchange rate: 1 USD = {formatPrice(currency.rate, 2)} {currency.code}
              </Badge>
              <Button variant="ghost" size="sm" onClick={refreshRate} disabled={isRefreshing} className="h-8 w-8 p-0">
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center italic">Updated {getTimeSinceUpdate()}</p>
          </div>
        )}

        {/* Discount Breakdown */}
        {hasDiscount && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 px-3 py-1">
                -{currency.symbol}
                {formatPrice(savingsLocal)} ({discountCode})
              </Badge>
            </div>
            <p className="text-sm text-green-600 font-semibold text-center">You save {discountPercent}%!</p>
          </div>
        )}

        {/* Price Breakdown Table */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Base Price:</span>
            <span className="font-medium">
              {currency.symbol}
              {formatPrice(regularPriceLocal)} (${formatPrice(regularPriceUSD, 2)})
            </span>
          </div>
          {hasDiscount && (
            <>
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount:</span>
                <span className="font-medium">
                  -{currency.symbol}
                  {formatPrice(savingsLocal)} (-${formatPrice(savingsUSD, 2)})
                </span>
              </div>
              <hr className="border-border" />
            </>
          )}
          <div className="flex justify-between text-lg font-bold pt-1">
            <span>Total:</span>
            <span>
              {currency.symbol}
              {formatPrice(discountedPriceLocal)} (${formatPrice(discountedPriceUSD, 2)})
            </span>
          </div>
        </div>

        {/* Plan Comparison Toggle */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              variant={planType === "3day" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setShowPlanToggle(!showPlanToggle)}
            >
              3-Day Plan
            </Button>
            <Button
              variant={planType === "monthly" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setShowPlanToggle(!showPlanToggle)}
            >
              Monthly Plan
            </Button>
          </div>

          {/* Alternative Plan Card */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{altPlanType === "3day" ? "3-Day Plan" : "Monthly Plan"}</span>
              {altPlanType === "3day" ? (
                <Badge variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-100">
                  Save 94% vs Monthly
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                  Best Value
                </Badge>
              )}
            </div>
            <p className="text-lg font-bold">
              {currency.symbol}
              {formatPrice(altDiscountedLocal)} (${formatPrice(altDiscountedUSD, 2)})
            </p>
          </div>
        </div>

        {/* Currency Selector */}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground block">Display in:</label>
          <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(currencies).map((curr) => (
                <SelectItem key={curr.code} value={curr.code}>
                  {curr.flag} {curr.code} ({curr.symbol}) - {curr.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
