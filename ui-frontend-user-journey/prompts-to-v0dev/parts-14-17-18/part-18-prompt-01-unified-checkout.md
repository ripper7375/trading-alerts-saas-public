PART 18 - PROMPT 1: Unified Checkout Page (Stripe + dLocal)

=======================================================
Create a unified checkout page supporting both Stripe and dLocal payments for a SaaS platform using **Next.js 15 App Router, TypeScript, Tailwind CSS, and shadcn/ui components**.

**CRITICAL: Use SystemConfig for Dynamic Percentages**
- MUST use `useAffiliateConfig()` hook for discount calculations
- All affiliate discount percentages should be dynamic

---

## REQUIREMENTS:

### 1. PAGE LAYOUT:
- Two-column layout: Checkout form (left, 60%) + Order summary (right, 40%)
- Centered container, max-width 1200px
- Background: gradient from gray-50 to blue-50

### 2. LEFT COLUMN - CHECKOUT FORM:

**STEP 1: COUNTRY SELECTION**
- Heading: "Select Your Country" (text-xl, font-bold, mb-4)
- Auto-detected badge: "🌍 Detected: India 🇮🇳" (bg-blue-100, text-blue-700, mb-2)
- Change button: "Change Country" (variant="ghost", text-sm)
- Country selector (shadcn/ui Select):
  * Options with flag emojis:
    - 🇮🇳 India
    - 🇳🇬 Nigeria
    - 🇵🇰 Pakistan
    - 🇻🇳 Vietnam
    - 🇮🇩 Indonesia
    - 🇹🇭 Thailand
    - 🇿🇦 South Africa
    - 🇹🇷 Turkey
    - 🌍 Other (Stripe only)
- Supported payment methods shown below as icon badges

**STEP 2: PLAN SELECTION**
- Heading: "Choose Your Plan" (text-xl, font-bold, mb-4)
- Two plan cards (side by side, responsive):

**Plan 1: 3-Day Trial**
- Badge: "dLocal Only" (bg-yellow-500, text-white)
- Price display:
  * USD: "$1.99" (text-2xl, font-bold)
  * Local currency: "≈ ₹165" (text-lg, text-gray-600)
  * Note: "(at current exchange rate)"
- Duration: "3 days" (text-sm, text-gray-600)
- Features (bullet list):
  * Try PRO features for 3 days
  * No auto-renewal
  * No discount codes accepted
- Badge: "NO DISCOUNT CODES" (bg-red-100, text-red-700)
- Select button (variant="outline")

**Plan 2: Monthly PRO**
- Badge: "Most Popular" (bg-blue-600, text-white)
- Badge: "Stripe + dLocal" (bg-green-500, text-white)
- Price display (conditional based on discount code):
  * Without discount:
    - USD: "$29.00" (text-2xl, font-bold)
    - Local currency: "≈ ₹2,407" (text-lg, text-gray-600)
  * With discount (if affiliate code applied):
    - Original: "$29.00" (line-through, text-gray-400)
    - Discounted: "${calculateDiscountedPrice(29)}" (text-2xl, font-bold, text-green-600)
    - Local: "≈ ₹{localDiscountedPrice}" (text-lg, text-gray-600)
    - Savings badge: "Save {discountPercent}%!" (bg-green-100, text-green-700)
- Duration: "30 days" (text-sm, text-gray-600)
- Features (bullet list):
  * Full PRO access for 30 days
  * Auto-renewal (Stripe only)
  * Discount codes accepted
- Select button (variant="default", gradient)

**STEP 3: DISCOUNT CODE (only for Monthly plan)**
- Conditional: Show only if Monthly plan selected
- Heading: "Have a Discount Code?" (text-lg, font-semibold, mb-2)
- Input field + Apply button (flex layout)
- Success message (if valid):
  * "✅ Code AFFILIATE10 applied! Save {discountPercent}%"
  * Savings amount: "-${savedAmount}"
  * Use dynamic discountPercent from useAffiliateConfig()
- Error message (if invalid):
  * "❌ Invalid or expired code"

**STEP 4: PAYMENT METHOD**
- Heading: "Select Payment Method" (text-xl, font-bold, mb-4)
- Payment method grid (4 columns desktop, 2 tablet, 1 mobile)
- Each method as a card (hover effect, click to select):

**For India (example):**
1. UPI (icon, "Instant" badge)
2. Paytm (icon, "Instant" badge)
3. PhonePe (icon, "Instant" badge)
4. Net Banking (icon, "1-2 hours" badge)
5. Credit/Debit Card (Stripe, icon, "Instant" badge, sub-label: "International cards")

**For other countries:** Show country-specific methods
- Selected method: gradient border + checkmark icon

**STEP 5: PAYMENT BUTTON**
- Large button: "Pay {localCurrencySymbol}{amount} (${usdAmount})"
  * Example: "Pay ₹165 ($1.99)" or "Pay ₹2,407 ($29.00)"
  * If discount applied: "Pay ₹2,166 ($26.10)"
- Gradient background (blue-600 to purple-600)
- Secure badge below: "🔒 Secured by dLocal" or "🔒 Secured by Stripe"
- Terms: "By clicking Pay, you agree to our Terms of Service"

### 3. RIGHT COLUMN - ORDER SUMMARY:

**Header:**
- Title: "Order Summary" (text-xl, font-bold, mb-4)

**Plan Details:**
- Plan name: "3-Day PRO Trial" or "Monthly PRO"
- Duration: "3 days" or "30 days"
- Features list (checkmarks):
  * 15 symbols (vs 5 FREE)
  * 9 timeframes (vs 3 FREE)
  * 20 alerts (vs 5 FREE)

**Price Breakdown:**
- Subtotal: $29.00
- Discount (if applied): -${discountAmount} (green text)
  * Label: "Affiliate Discount ({discountPercent}% off)"
  * Use dynamic discountPercent from useAffiliateConfig()
- Total (USD): ${finalPriceUSD}
- Currency conversion: "≈ {localCurrency} {localAmount}"
  * Example: "≈ ₹2,166 INR"

**Renewal Notice:**
- Card with icon (AlertCircle)
- Text: "⚠️ Manual renewal required (dLocal payments)"
- Or: "♻️ Auto-renews monthly (Stripe payments)"

### 4. CURRENCY CONVERSION:
- Show real-time exchange rates
- Update when country changes
- Format with proper currency symbols (₹, ₦, Rs, ₫, Rp, ฿, R, ₺)

### 5. RESPONSIVE DESIGN:
- Desktop: Two columns side by side
- Tablet: Stack columns (form on top)
- Mobile: Single column, full width

### 6. TECHNICAL REQUIREMENTS:
- Client component ('use client')
- TypeScript with proper types
- Use shadcn/ui Card, Select, Input, Button, Badge, RadioGroup components
- Use lucide-react icons
- MUST use useAffiliateConfig() hook
- Real-time currency conversion API (mock for now)
- Form validation with React Hook Form

---

## SYSTEMCONFIG INTEGRATION:

```typescript
'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { AlertCircle, Check, Lock } from 'lucide-react'

export default function UnifiedCheckoutPage() {
  const searchParams = useSearchParams()
  const affiliateCode = searchParams.get('ref')

  // ✅ CRITICAL: Use SystemConfig hook
  const {
    discountPercent,
    calculateDiscountedPrice
  } = useAffiliateConfig()

  const [country, setCountry] = useState('IN')
  const [selectedPlan, setSelectedPlan] = useState<'3day' | 'monthly'>('monthly')
  const [discountCode, setDiscountCode] = useState(affiliateCode || '')
  const [codeApplied, setCodeApplied] = useState(!!affiliateCode)

  // Prices
  const regularPrice = selectedPlan === '3day' ? 1.99 : 29.00
  const discountedPrice = codeApplied && selectedPlan === 'monthly'
    ? calculateDiscountedPrice(regularPrice)
    : regularPrice
  const savings = regularPrice - discountedPrice

  // Currency conversion (mock rates)
  const exchangeRates = {
    IN: 83, NG: 1580, PK: 278, VN: 24500,
    ID: 15800, TH: 36, ZA: 18.5, TR: 34
  }
  const currencySymbols = {
    IN: '₹', NG: '₦', PK: 'Rs', VN: '₫',
    ID: 'Rp', TH: '฿', ZA: 'R', TR: '₺'
  }

  const rate = exchangeRates[country] || 1
  const symbol = currencySymbols[country] || '$'
  const localAmount = (discountedPrice * rate).toFixed(0)

  // ... rest of component
}
```

---

## CHECKLIST:
- ✅ Uses useAffiliateConfig hook
- ✅ Calculates discounted price dynamically
- ✅ Uses {discountPercent}% for display
- ✅ Country selector with 8 countries
- ✅ Two plan options (3-day and Monthly)
- ✅ Payment method grid (country-specific)
- ✅ Currency conversion display
- ✅ Discount code validation (Monthly only)
- ✅ Responsive two-column layout

Generate complete, production-ready code that I can copy and run immediately.
