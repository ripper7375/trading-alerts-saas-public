PART 18 - PROMPT 4: Price Display Component (Multi-Currency)

=======================================================
Create a price display component with real-time currency conversion using **Next.js 15 App Router, TypeScript, Tailwind CSS, and shadcn/ui components**.

**CRITICAL: Use SystemConfig for Dynamic Percentages**
- MUST use `useAffiliateConfig()` hook for discount calculations
- All discount percentages should be dynamic

---

## REQUIREMENTS:

### 1. COMPONENT STRUCTURE:
- Card container (shadcn/ui Card)
- Title: "Plan Pricing" (text-xl, font-bold, mb-4)
- Compact layout, max-width 400px

### 2. MAIN PRICE DISPLAY (Large):
- Local currency price (e.g., "₹2,407")
- Font: text-5xl, font-bold
- Gradient text: from blue-600 to purple-600
- Currency name below: "Indian Rupee" (text-sm, text-gray-500)

### 3. USD EQUIVALENT (Small):
- Text: "≈ $29.00 USD" (text-lg, text-gray-600)
- Below main price
- Approximately symbol (≈)

### 4. EXCHANGE RATE INFO:
- Small badge: "Exchange rate: 1 USD = 83 INR"
- Font: text-xs, text-gray-500
- Background: bg-gray-100, rounded-full, px-3, py-1
- Timestamp: "Updated 2 minutes ago" (text-xs, text-gray-400, italic)
- Refresh icon button (lucide-react RefreshCw, clickable)

### 5. DISCOUNT BREAKDOWN (if discount applied):
- Show only if affiliate code is active
- Original price: "₹2,407" (text-2xl, line-through, text-gray-400)
- Discount badge: "-₹200 (AFFILIATE10)" (bg-green-100, text-green-700, rounded, px-3, py-1)
  * Calculate discount using: regularPrice - calculateDiscountedPrice(regularPrice)
  * Show discount code name
- Final price: "₹2,207" (text-4xl, font-bold, text-green-600)
- Savings text: "You save {discountPercent}%" (text-sm, text-green-600, font-semibold)
  * Use dynamic discountPercent from useAffiliateConfig()

### 6. PRICE BREAKDOWN TABLE:
- Container: bg-gray-50, rounded-lg, padding 16px, mb-4
- Table rows (key-value pairs):
  * Base Price: ₹2,407 ($29.00)
  * Discount: -₹200 (-${discountUSD}) (green text)
  * Total: ₹2,207 ($26.58) (bold, large)
- Horizontal lines between rows

### 7. PLAN COMPARISON (Toggle buttons):
- Toggle between "3-Day Plan" and "Monthly Plan"
- Active button highlighted (bg-blue-600, text-white)
- Inactive button (bg-gray-100, text-gray-700)

**3-Day Plan Card:**
- Price: "₹165 ($1.99)"
- Badge: "Save 94% vs Monthly" (bg-purple-100, text-purple-700)

**Monthly Plan Card:**
- Price: "₹2,407 ($29.00)" (or discounted if code applied)
- Badge: "Best Value" (bg-blue-100, text-blue-700)

### 8. CURRENCY SELECTOR (Dropdown):
- Label: "Display in:" (text-sm, text-gray-600)
- Select component with country flags
- Options:
  * 🇮🇳 INR (₹) - India
  * 🇳🇬 NGN (₦) - Nigeria
  * 🇵🇰 PKR (Rs) - Pakistan
  * 🇻🇳 VND (₫) - Vietnam
  * 🇮🇩 IDR (Rp) - Indonesia
  * 🇹🇭 THB (฿) - Thailand
  * 🇿🇦 ZAR (R) - South Africa
  * 🇹🇷 TRY (₺) - Turkey
  * 🇺🇸 USD ($) - United States
- onChange updates entire component

### 9. LOADING STATE:
- Show spinner when fetching exchange rate
- Skeleton animation for price text
- Duration: ~500ms

### 10. ERROR STATE:
- If currency API fails
- Show fallback: "Unable to load exchange rate"
- Retry button

### 11. RESPONSIVE DESIGN:
- Full width on mobile
- Fixed width on desktop (max-w-md)
- Font sizes adjust on mobile

### 12. TECHNICAL REQUIREMENTS:
- Client component ('use client')
- TypeScript with proper types
- Props:
  * planType: '3day' | 'monthly'
  * hasDiscount: boolean
  * discountCode?: string
- Use shadcn/ui Card, Select, Button, Badge components
- Use lucide-react RefreshCw icon
- MUST use useAffiliateConfig() hook
- Currency conversion API call (mock for now)
- Format numbers with proper thousands separator

---

## SYSTEMCONFIG INTEGRATION:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw } from 'lucide-react'

interface PriceDisplayProps {
  planType: '3day' | 'monthly'
  hasDiscount: boolean
  discountCode?: string
}

export default function PriceDisplayComponent({
  planType,
  hasDiscount,
  discountCode
}: PriceDisplayProps) {
  // ✅ CRITICAL: Use SystemConfig hook
  const {
    discountPercent,
    calculateDiscountedPrice
  } = useAffiliateConfig()

  const [currency, setCurrency] = useState<'INR' | 'NGN' | 'PKR' | 'VND' | 'IDR' | 'THB' | 'ZAR' | 'TRY' | 'USD'>('INR')
  const [exchangeRate, setExchangeRate] = useState(83)
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  // Price logic
  const regularPriceUSD = planType === '3day' ? 1.99 : 29.00
  const discountedPriceUSD = hasDiscount
    ? calculateDiscountedPrice(regularPriceUSD)
    : regularPriceUSD
  const savingsUSD = regularPriceUSD - discountedPriceUSD

  // Currency conversion
  const regularPriceLocal = regularPriceUSD * exchangeRate
  const discountedPriceLocal = discountedPriceUSD * exchangeRate
  const savingsLocal = savingsUSD * exchangeRate

  // Currency symbols
  const currencySymbols = {
    INR: '₹', NGN: '₦', PKR: 'Rs', VND: '₫',
    IDR: 'Rp', THB: '฿', ZAR: 'R', TRY: '₺', USD: '$'
  }
  const symbol = currencySymbols[currency]

  const refreshRate = () => {
    setIsLoading(true)
    // Simulate API call
    setTimeout(() => {
      setLastUpdated(new Date())
      setIsLoading(false)
    }, 500)
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Plan Pricing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Price */}
        <div className="text-center">
          {hasDiscount && (
            <p className="text-2xl line-through text-gray-400">
              {symbol}{regularPriceLocal.toLocaleString()}
            </p>
          )}
          <p className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {symbol}{discountedPriceLocal.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-1">{currency === 'INR' ? 'Indian Rupee' : currency}</p>
          <p className="text-lg text-gray-600 mt-2">
            ≈ ${discountedPriceUSD.toFixed(2)} USD
          </p>
        </div>

        {/* Exchange Rate Info */}
        <div className="flex items-center justify-center gap-2">
          <Badge variant="secondary" className="text-xs">
            1 USD = {exchangeRate} {currency}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshRate}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <p className="text-xs text-gray-400 text-center italic">
          Updated {Math.floor((Date.now() - lastUpdated.getTime()) / 60000)} minutes ago
        </p>

        {/* Discount Breakdown */}
        {hasDiscount && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <Badge className="bg-green-100 text-green-700 mb-2">
              -{symbol}{savingsLocal.toFixed(0)} ({discountCode})
            </Badge>
            <p className="text-sm text-green-600 font-semibold">
              You save {discountPercent}%!
            </p>
          </div>
        )}

        {/* Price Breakdown */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Base Price:</span>
            <span>{symbol}{regularPriceLocal.toFixed(0)} (${regularPriceUSD.toFixed(2)})</span>
          </div>
          {hasDiscount && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount:</span>
              <span>-{symbol}{savingsLocal.toFixed(0)} (-${savingsUSD.toFixed(2)})</span>
            </div>
          )}
          <hr />
          <div className="flex justify-between font-bold text-lg">
            <span>Total:</span>
            <span>{symbol}{discountedPriceLocal.toFixed(0)} (${discountedPriceUSD.toFixed(2)})</span>
          </div>
        </div>

        {/* Currency Selector */}
        <div>
          <label className="text-sm text-gray-600 mb-2 block">Display in:</label>
          <Select value={currency} onValueChange={(val: any) => setCurrency(val)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INR">🇮🇳 INR (₹)</SelectItem>
              <SelectItem value="NGN">🇳🇬 NGN (₦)</SelectItem>
              <SelectItem value="PKR">🇵🇰 PKR (Rs)</SelectItem>
              <SelectItem value="VND">🇻🇳 VND (₫)</SelectItem>
              <SelectItem value="IDR">🇮🇩 IDR (Rp)</SelectItem>
              <SelectItem value="THB">🇹🇭 THB (฿)</SelectItem>
              <SelectItem value="ZAR">🇿🇦 ZAR (R)</SelectItem>
              <SelectItem value="TRY">🇹🇷 TRY (₺)</SelectItem>
              <SelectItem value="USD">🇺🇸 USD ($)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## CHECKLIST:
- ✅ Uses useAffiliateConfig hook
- ✅ Calculates discount dynamically
- ✅ Uses {discountPercent}% for display
- ✅ Multi-currency support (9 currencies)
- ✅ Real-time exchange rate display
- ✅ Refresh rate button
- ✅ Price breakdown table
- ✅ Discount badge when applicable
- ✅ Loading and error states
- ✅ Responsive design

Generate complete, production-ready code that I can copy and run immediately.
