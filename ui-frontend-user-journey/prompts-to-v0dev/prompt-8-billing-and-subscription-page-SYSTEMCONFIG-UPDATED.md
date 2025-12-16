## **PROMPT 8: Billing & Subscription Page (WITH SYSTEMCONFIG + MONTHLY-ONLY + DISCOUNT CODE INPUT)**

=========================================

Create a billing and subscription management page for Next.js 15 using TypeScript, Tailwind CSS, and shadcn/ui.

**CRITICAL: Use SystemConfig for Dynamic Percentages**

- DO NOT hardcode discount percentages (e.g., "20%")
- DO NOT hardcode commission percentages (e.g., "20%")
- DO NOT hardcode prices (e.g., "$23.20", "$5.80")
- MUST use `useAffiliateConfig()` hook for all dynamic values
- All percentages and calculations MUST be dynamic from SystemConfig

REQUIREMENTS:

1. PAGE HEADER:
   - Breadcrumb: "Dashboard > Settings > Billing" (text-sm, text-gray-500, mb-4)
   - Title: "💳 Billing & Subscription" (text-3xl, font-bold, mb-2)
   - Subtitle: "Manage your plan and payment methods" (text-gray-600, mb-8)

2. CURRENT PLAN CARD (Gradient Card - Enhanced with Affiliate Discount):
   - Card: bg-gradient-to-r from-blue-600 to-purple-600, text-white, rounded-2xl, shadow-2xl, p-8, mb-8
   - Badges row (flex gap-2, mb-4):
     - "PRO TIER ⭐" (bg-white/20, text-white, rounded-full, px-4, py-2)
     - "✓ ACTIVE" (bg-white/20, text-white, rounded-full, px-4, py-2)
     - "🎉 {discountPercent}% AFFILIATE DISCOUNT" (bg-green-400/30, text-white, rounded-full, px-4, py-2) - CONDITIONAL
       - Use dynamic discountPercent from useAffiliateConfig()

   - Plan name: "Pro Plan" (text-4xl, font-bold, mt-4)

   - PRICING DISPLAY (TWO VERSIONS - conditional):

     WITHOUT discount (default):
     - Price: "$29/month" (text-5xl, font-bold, mt-2)

     WITH affiliate discount:
     - Container: flex items-baseline gap-3
     - Original price: "$29" (text-3xl, text-white/60, line-through)
     - Discounted price: "${calculateDiscountedPrice(29)}" (text-5xl, font-bold)
       - Use calculateDiscountedPrice() helper from useAffiliateConfig()
     - Period: "/month" (text-xl, text-white/90)
     - Savings label: "{discountPercent}% off this month" (bg-green-400, text-green-900, px-2 py-1, rounded-full, text-xs, font-semibold, ml-2)
       - Use dynamic discountPercent

   - Renewal date (TWO VERSIONS):
     - WITHOUT: "Renews on Feb 15, 2025" (text-xl, text-white/90, mt-2)
     - WITH: "Renews on Feb 15, 2025 at $29.00" (text-xl, text-white/90, mt-2)
       - Sub-text: "Use a new affiliate code at renewal to get {discountPercent}% off again!" (text-sm, text-white/80, mt-1)
         - Use dynamic discountPercent

   - Member since: "Member since Jan 15, 2025" (text-lg, text-white/80)

   - AFFILIATE DISCOUNT DETAILS (conditional - only if discount active):
     - Container: bg-white/20, rounded-lg, p-3, mt-4, mb-4, border border-white/30
     - Layout: flex items-center gap-3
     - Icon: 🎉 (text-2xl)
     - Content:
       - Heading: "Affiliate Discount Active" (font-semibold, text-lg)
       - Details: "{discountPercent}% off • Code: {appliedCode}" (text-white/90, text-sm)
         - Use dynamic discountPercent
       - Savings: "You save ${29 - calculateDiscountedPrice(29)}/month" (text-white/80, text-xs)
         - Calculate savings dynamically

   - Features grid (2 columns on desktop, 1 on mobile, mt-6):
     - ✅ 15 Symbols
     - ✅ 9 Timeframes (M5-D1)
     - ✅ 20 Alerts
     - ✅ 50 Watchlist Items
     - ✅ Email & Push Notifications
     - ✅ 300 API Requests/hour

3. DISCOUNT CODE INPUT BOX (NEW SECTION - Critical for Option A):
   - Position: AFTER Current Plan Card, BEFORE Payment Method
   - Section heading: "💰 Maintain Your Discount (Optional)" (text-2xl, font-bold, mb-6, mt-12)
   - Card: bg-gradient-to-r from-green-50 to-blue-50, border-2 border-green-200, rounded-xl, shadow-lg, p-6
   - Layout: Single column with clear instructions

   Content:
   - Icon: 🎫 (text-3xl, mb-3)
   - Heading: "Enter Discount Code for Next Payment" (text-xl, font-bold, text-gray-900, mb-3)
   - Description: "Find a new affiliate code from our partners and enter it here BEFORE your next renewal date to continue receiving {discountPercent}% off your PRO subscription." (text-gray-700, mb-4)
     - Use dynamic discountPercent

   - Current Status Display (conditional):
     IF code scheduled for next billing:
     - Container: bg-white, rounded-lg, p-4, mb-4, border-2 border-green-500
     - Icon: ✅ (text-xl, inline)
     - Heading: "Code Ready for Next Payment" (font-semibold, text-green-700)
     - Code display: "Code: {scheduledCode}" (font-mono, text-sm, text-gray-600)
     - Savings: "You'll save ${29 - calculateDiscountedPrice(29)} on {nextBillingDate}" (text-sm, text-green-600)
     - Action: "Update Code" button (text-blue-600, text-sm, underline, mt-2)

     IF no code scheduled:
     - Container: bg-yellow-50, rounded-lg, p-4, mb-4, border-2 border-yellow-400
     - Icon: ⚠️ (text-xl, inline)
     - Heading: "No Code Scheduled" (font-semibold, text-yellow-800)
     - Warning: "Your next payment ({nextBillingDate}) will be $29.00 without a code" (text-sm, text-yellow-700)

   - Input Form:
     - Label: "Affiliate Code" (text-sm, font-medium, text-gray-700, mb-2)
     - Input field:
       - Placeholder: "Enter code (e.g., SMITH-ABC123)"
       - Type: text
       - Class: w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none
     - Button: "Apply Code for Next Payment"
       - Class: bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 mt-3 w-full
       - Should trigger validation API call

   - Reminder Schedule (below input):
     - Heading: "📅 Automatic Reminders" (text-sm, font-semibold, text-gray-700, mb-2, mt-6)
     - List:
       - "10 days before renewal: First reminder email"
       - "7 days before renewal: Second reminder email"
       - "3 days before renewal: Final reminder email + in-app notification"
     - Text styling: text-xs, text-gray-600, space-y-1

   - Info Box (at bottom):
     - Container: bg-blue-50, border-l-4 border-blue-400, p-3, mt-4, rounded
     - Icon: ℹ️ (inline)
     - Text: "Codes are one-time use. Each month, affiliates post new codes on social media. We'll remind you before each renewal to find and enter a new code!" (text-sm, text-gray-700)

4. PAYMENT METHOD SECTION:
   - Section heading: "💳 Payment Method" (text-2xl, font-bold, mb-6, mt-12)
   - Card: white bg, rounded-xl, shadow-lg, p-6
   - Layout: flex items-center justify-between
   - Left side:
     - Card icon: 💳 with Visa logo
     - "Visa ending in \*\*\*\*4242" (text-xl, font-semibold)
     - "Expires: 12/2026" (text-sm, text-gray-600)
   - Right side:
     - Button: "Update Card" (border-2, border-gray-300, px-4, py-2, rounded-lg, hover:border-blue-600)

5. AFFILIATE DISCOUNT SUMMARY (conditional section - only if discount currently active):
   - Position: AFTER Payment Method, BEFORE Usage Statistics
   - Section heading: "🎁 Your Current Discount" (text-2xl, font-bold, mb-6, mt-12)
   - Card: bg-gradient-to-r from-green-50 to-blue-50, border-2 border-green-200, rounded-xl, shadow-lg, p-6
   - Layout: Grid 2 columns on desktop, 1 on mobile, gap-8

   Left Column:
   - Icon: 🤝 (text-4xl, mb-3)
   - Heading: "{discountPercent}% Discount This Month" (text-2xl, font-bold, text-gray-900, mb-2)
     - Use dynamic discountPercent
   - Description: "You're saving ${29 - calculateDiscountedPrice(29)} this month with your affiliate code. Find new codes monthly to keep saving!" (text-gray-700, mb-4)
     - Calculate savings dynamically
   - Code display:
     - Label: "Your current code:" (text-sm, text-gray-600)
     - Code: "{currentCode}" (bg-white, px-4, py-2, rounded-lg, font-mono, text-lg, border-2 border-gray-300, mt-1)

   Right Column (Stats):
   - Stat 1:
     - Label: "Total Saved So Far" (text-sm, text-gray-600)
     - Value: "${totalSaved}" (text-3xl, font-bold, text-green-600)
       - Calculate from billing history dynamically
     - Subtext: "Across {cyclesSaved} billing cycles" (text-xs, text-gray-500)
   - Stat 2 (mt-4):
     - Label: "Projected Annual Savings" (text-sm, text-gray-600)
     - Value: "${(29 - calculateDiscountedPrice(29)) \* 12}" (text-2xl, font-bold, text-blue-600)
       - Calculate projected savings dynamically
     - Subtext: "If you use codes every month" (text-xs, text-gray-500)

   Important Notice (below card):
   - Text: "ℹ️ Your discount code is valid for one payment only. At renewal, enter a new code in the box above to get {discountPercent}% off again. Affiliates post fresh codes on social media monthly!" (text-sm, text-gray-600, italic, mt-4)
     - Use dynamic discountPercent

6. USAGE STATISTICS:
   - Section heading: "📊 Usage This Month" (text-2xl, font-bold, mb-6, mt-12)
   - Card: white bg, rounded-xl, shadow-lg, p-8
   - Three usage items (stack vertically, gap-6):

   Item 1 - Alerts:
   - Label: "Alerts" with usage "8/20" (float right, text-2xl, font-bold)
   - Progress bar: h-4, bg-gray-200, rounded-full, fill 40% with bg-green-500
   - Text below: "40% used" (text-sm, text-gray-600)

   Item 2 - Watchlist:
   - Label: "Watchlist Items" with usage "12/50" (float right, text-2xl, font-bold)
   - Progress bar: h-4, bg-gray-200, rounded-full, fill 24% with bg-blue-500
   - Text below: "24% used" (text-sm, text-gray-600)

   Item 3 - API Calls:
   - Label: "API Calls (Peak Hour)" with usage "245/300" (float right, text-2xl, font-bold)
   - Progress bar: h-4, bg-gray-200, rounded-full, fill 82% with bg-yellow-500
   - Warning badge: "⚠️ High usage" (text-orange-600, text-xs) next to label
   - Text below: "82% used" (text-sm, text-gray-600)

7. BILLING HISTORY (Updated with Dynamic Discount):
   - Section heading: "📄 Billing History" (text-2xl, font-bold, mb-6, mt-12)
   - Card: white bg, rounded-xl, shadow-lg, p-6
   - Table with columns: Date | Description | Amount | Status | Invoice

   - TWO VERSIONS OF DATA:

   WITHOUT discount:
   - Row 1: Feb 15, 2025 | Pro Plan - Monthly | $29.00 | Paid ✓ | [Download PDF]
   - Row 2: Jan 15, 2025 | Pro Plan - Monthly | $29.00 | Paid ✓ | [Download PDF]
   - Row 3: Dec 15, 2024 | Pro Plan - Monthly | $29.00 | Paid ✓ | [Download PDF]

   WITH discount:
   - Row 1: Feb 15, 2025 | Pro Plan - Monthly ({discountPercent}% off) ℹ️ | ${calculateDiscountedPrice(29)} | Paid ✓ | [Download PDF]
   - Row 2: Jan 15, 2025 | Pro Plan - Monthly ({discountPercent}% off) ℹ️ | ${calculateDiscountedPrice(29)} | Paid ✓ | [Download PDF]
   - Row 3: Dec 15, 2024 | Pro Plan - Monthly ({discountPercent}% off) ℹ️ | ${calculateDiscountedPrice(29)} | Paid ✓ | [Download PDF]
     - Use dynamic discountPercent and calculateDiscountedPrice()
   * Info icon (ℹ️) has tooltip on hover: "Original: $29.00 | Discount: -${29 - calculateDiscountedPrice(29)} | Paid: ${calculateDiscountedPrice(29)}"
     - Calculate discount amount dynamically
   * Table styling: Striped rows (hover:bg-gray-50)
   * Pagination below: "Page 1 of 3" with [Previous] [Next] buttons

8. SUBSCRIPTION ACTIONS (Monthly-Only):
   - Section heading: "⚙️ Manage Subscription" (text-2xl, font-bold, mb-6, mt-12)
   - Card: white bg, rounded-xl, shadow-lg, p-6
   - Grid: 2 columns on desktop, 1 on mobile, gap-6

   Action Card 1:
   - Icon: ⏸️ (text-4xl, mb-3)
   - Title: "Pause Subscription" (text-lg, font-semibold, mb-2)
   - Description: "Take a break for up to 3 months" (text-sm, text-gray-600, mb-4)
   - Button: "Pause" (border-2, border-gray-300, text-gray-700, px-4, py-2, rounded-lg, hover:border-yellow-500, w-full)

   Action Card 2:
   - Icon: 🔔 (text-4xl, mb-3)
   - Title: "Notification Settings" (text-lg, font-semibold, mb-2)
   - Description: "Manage billing and renewal reminders" (text-sm, text-gray-600, mb-4)
   - Button: "Configure" (border-2, border-gray-300, text-gray-700, px-4, py-2, rounded-lg, hover:border-blue-500, w-full)

9. DOWNGRADE SECTION (Enhanced with Discount Warning):
   - Card: bg-gray-50, border-2 border-gray-300, rounded-xl, p-6, mt-12
   - Heading: "Want to downgrade?" (text-xl, font-semibold, text-gray-700, mb-2)
   - Description: "Switch to FREE tier anytime. You'll keep your data but lose PRO features." (text-sm, text-gray-600, mb-4)
   - Warning list (text-sm):
     - ⚠️ Limited to 5 symbols (currently: 15) (text-orange-600)
     - ⚠️ Only 3 timeframes (currently: 9) (text-orange-600)
     - ⚠️ Only 5 alerts (currently: 20) (text-orange-600)
     - ⚠️ FREE tier is not eligible for affiliate discount codes (text-orange-600) - CONDITIONAL (show if currently has discount)

   - Buttons (flex, gap-3, mt-6):
     - "Keep PRO Plan" (bg-blue-600, text-white, px-6, py-3, rounded-lg, hover:bg-blue-700)
     - "Downgrade to FREE" (border-2, border-gray-300, text-gray-700, px-6, py-3, rounded-lg, hover:border-red-500, hover:text-red-600)

DESIGN NOTES:

- Use gradient card for current plan to make it stand out
- Progress bars use semantic colors: green (healthy), blue (normal), yellow/orange (warning)
- Consistent spacing: mb-12 between major sections, mb-6 for section headings
- All cards use rounded-xl and shadow-lg
- Responsive: stack grids to 1 column on mobile
- Conditional rendering: Only show affiliate sections if discount is active
- Discount code input box is ALWAYS visible (critical for Option A auto-renewal model)

TECHNICAL:

- Export as default component
- TypeScript with props interface (see below)
- Use shadcn/ui: Card, Button, Badge, Progress, Table, Input
- MUST import and use useAffiliateConfig() hook
- Mock data included
- Make interactive (buttons should have onClick handlers with console.log)

TECHNICAL IMPLEMENTATION:

```typescript
'use client'

import { useState } from 'react'
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'

interface BillingPageProps {
  tier?: "FREE" | "PRO"
  subscriptionStatus?: "active" | "trial" | "canceled"
  currentDiscount?: {
    active: boolean
    code: string
    totalSaved: number
    cyclesSaved: number
  } | null
  nextBillingCodeScheduled?: {
    code: string
    appliesOn: string // Date string
  } | null
}

export default function BillingPage({
  tier = "PRO",
  subscriptionStatus = "active",
  currentDiscount = null,
  nextBillingCodeScheduled = null
}: BillingPageProps) {

  // ✅ CRITICAL: Use SystemConfig hook for dynamic percentages
  const {
    discountPercent,
    commissionPercent,
    calculateDiscountedPrice,
    config,
    isLoading
  } = useAffiliateConfig()

  const [discountCode, setDiscountCode] = useState("")
  const [isApplying, setIsApplying] = useState(false)

  // Price constants
  const baseMonthlyPrice = 29.00

  // Calculate prices using helper
  const discountedPrice = calculateDiscountedPrice(baseMonthlyPrice)
  const monthlySavings = baseMonthlyPrice - discountedPrice

  // Mock next billing date
  const nextBillingDate = "March 15, 2025"

  // Handle discount code application
  const handleApplyCode = async () => {
    setIsApplying(true)
    console.log("Applying discount code for next billing:", discountCode)

    // API call would go here
    // POST /api/user/billing/apply-code
    // Body: { code: discountCode }

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))

    alert(`Code "${discountCode}" will be applied on ${nextBillingDate}!`)
    setDiscountCode("")
    setIsApplying(false)
  }

  // Billing history with dynamic prices
  const billingHistory = [
    {
      date: "Feb 15, 2025",
      description: currentDiscount?.active
        ? `Pro Plan - Monthly (${discountPercent}% off)`
        : "Pro Plan - Monthly",
      amount: currentDiscount?.active ? discountedPrice : baseMonthlyPrice,
      status: "Paid",
    },
    {
      date: "Jan 15, 2025",
      description: currentDiscount?.active
        ? `Pro Plan - Monthly (${discountPercent}% off)`
        : "Pro Plan - Monthly",
      amount: currentDiscount?.active ? discountedPrice : baseMonthlyPrice,
      status: "Paid",
    },
    {
      date: "Dec 15, 2024",
      description: "Pro Plan - Monthly",
      amount: baseMonthlyPrice,
      status: "Paid",
    },
  ]

  // Show loading state
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-4">
          Dashboard &gt; Settings &gt; Billing
        </nav>

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">💳 Billing & Subscription</h1>
          <p className="text-gray-600">Manage your plan and payment methods</p>
        </div>

        {/* Current Plan Card */}
        <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl shadow-2xl mb-8 border-0">
          <CardContent className="p-8">
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge className="bg-white/20 text-white">PRO TIER ⭐</Badge>
              <Badge className="bg-white/20 text-white">✓ ACTIVE</Badge>
              {currentDiscount?.active && (
                <Badge className="bg-green-400/30 text-white">
                  🎉 {discountPercent}% AFFILIATE DISCOUNT
                </Badge>
              )}
            </div>

            <h2 className="text-4xl font-bold mt-4">Pro Plan</h2>

            {/* Pricing - conditional */}
            <div className="flex items-baseline gap-3 mt-2">
              {currentDiscount?.active && (
                <span className="text-3xl text-white/60 line-through">${baseMonthlyPrice}</span>
              )}
              <span className="text-5xl font-bold">
                ${currentDiscount?.active ? discountedPrice.toFixed(2) : baseMonthlyPrice}
              </span>
              <span className="text-xl text-white/90">/month</span>
              {currentDiscount?.active && (
                <span className="bg-green-400 text-green-900 px-2 py-1 rounded-full text-xs font-semibold ml-2">
                  {discountPercent}% off this month
                </span>
              )}
            </div>

            {/* Renewal date */}
            <div className="text-xl text-white/90 mt-2">
              Renews on {nextBillingDate} at ${baseMonthlyPrice.toFixed(2)}
            </div>
            {currentDiscount?.active && (
              <div className="text-sm text-white/80 mt-1">
                Use a new affiliate code at renewal to get {discountPercent}% off again!
              </div>
            )}

            <div className="text-lg text-white/80 mt-2">Member since Jan 15, 2025</div>

            {/* Affiliate discount details */}
            {currentDiscount?.active && (
              <div className="bg-white/20 rounded-lg p-3 mt-4 mb-4 border border-white/30">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎉</span>
                  <div className="flex-1">
                    <div className="font-semibold text-lg">Affiliate Discount Active</div>
                    <div className="text-white/90 text-sm">
                      {discountPercent}% off • Code: {currentDiscount.code}
                    </div>
                    <div className="text-white/80 text-xs">
                      You save ${monthlySavings.toFixed(2)}/month
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Features grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
              <div className="flex items-center gap-2">
                <span className="text-white/90">✅</span>
                <span className="text-white/90">15 Symbols</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/90">✅</span>
                <span className="text-white/90">9 Timeframes (M5-D1)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/90">✅</span>
                <span className="text-white/90">20 Alerts</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/90">✅</span>
                <span className="text-white/90">50 Watchlist Items</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/90">✅</span>
                <span className="text-white/90">Email & Push Notifications</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/90">✅</span>
                <span className="text-white/90">300 API Requests/hour</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* DISCOUNT CODE INPUT BOX (Critical for Option A) */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-6">💰 Maintain Your Discount (Optional)</h2>
          <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200">
            <CardContent className="p-6">
              <div className="text-3xl mb-3">🎫</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Enter Discount Code for Next Payment
              </h3>
              <p className="text-gray-700 mb-4">
                Find a new affiliate code from our partners and enter it here BEFORE your next renewal
                date to continue receiving {discountPercent}% off your PRO subscription.
              </p>

              {/* Current Status Display */}
              {nextBillingCodeScheduled ? (
                <div className="bg-white rounded-lg p-4 mb-4 border-2 border-green-500">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">✅</span>
                    <span className="font-semibold text-green-700">Code Ready for Next Payment</span>
                  </div>
                  <p className="text-sm text-gray-600 font-mono">
                    Code: {nextBillingCodeScheduled.code}
                  </p>
                  <p className="text-sm text-green-600 mt-1">
                    You'll save ${monthlySavings.toFixed(2)} on {nextBillingCodeScheduled.appliesOn}
                  </p>
                  <button className="text-blue-600 text-sm underline mt-2">
                    Update Code
                  </button>
                </div>
              ) : (
                <div className="bg-yellow-50 rounded-lg p-4 mb-4 border-2 border-yellow-400">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">⚠️</span>
                    <span className="font-semibold text-yellow-800">No Code Scheduled</span>
                  </div>
                  <p className="text-sm text-yellow-700">
                    Your next payment ({nextBillingDate}) will be ${baseMonthlyPrice.toFixed(2)} without a code
                  </p>
                </div>
              )}

              {/* Input Form */}
              <div>
                <Label htmlFor="discount-code" className="text-sm font-medium text-gray-700 mb-2">
                  Affiliate Code
                </Label>
                <Input
                  id="discount-code"
                  type="text"
                  placeholder="Enter code (e.g., SMITH-ABC123)"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 mt-2"
                />
                <Button
                  onClick={handleApplyCode}
                  disabled={!discountCode || isApplying}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 mt-3 w-full"
                >
                  {isApplying ? "Applying..." : "Apply Code for Next Payment"}
                </Button>
              </div>

              {/* Reminder Schedule */}
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">📅 Automatic Reminders</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• 10 days before renewal: First reminder email</li>
                  <li>• 7 days before renewal: Second reminder email</li>
                  <li>• 3 days before renewal: Final reminder email + in-app notification</li>
                </ul>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mt-4 rounded">
                <p className="text-sm text-gray-700">
                  <span className="inline-block mr-1">ℹ️</span>
                  Codes are one-time use. Each month, affiliates post new codes on social media.
                  We'll remind you before each renewal to find and enter a new code!
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Payment Method Section */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-6">💳 Payment Method</h2>
          <Card>
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-3xl">💳</div>
                <div>
                  <div className="text-xl font-semibold">Visa ending in ****4242</div>
                  <div className="text-sm text-gray-600">Expires: 12/2026</div>
                </div>
              </div>
              <Button variant="outline">Update Card</Button>
            </CardContent>
          </Card>
        </section>

        {/* Affiliate Discount Summary (conditional) */}
        {currentDiscount?.active && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold mb-6">🎁 Your Current Discount</h2>
            <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Column */}
                  <div>
                    <div className="text-4xl mb-3">🤝</div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      {discountPercent}% Discount This Month
                    </h3>
                    <p className="text-gray-700 mb-4">
                      You're saving ${monthlySavings.toFixed(2)} this month with your affiliate code.
                      Find new codes monthly to keep saving!
                    </p>
                    <div>
                      <div className="text-sm text-gray-600">Your current code:</div>
                      <div className="bg-white px-4 py-2 rounded-lg font-mono text-lg border-2 border-gray-300 mt-1">
                        {currentDiscount.code}
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Stats */}
                  <div>
                    <div>
                      <div className="text-sm text-gray-600">Total Saved So Far</div>
                      <div className="text-3xl font-bold text-green-600">
                        ${currentDiscount.totalSaved.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Across {currentDiscount.cyclesSaved} billing cycles
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="text-sm text-gray-600">Projected Annual Savings</div>
                      <div className="text-2xl font-bold text-blue-600">
                        ${(monthlySavings * 12).toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">If you use codes every month</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <p className="text-sm text-gray-600 italic mt-4">
              ℹ️ Your discount code is valid for one payment only. At renewal, enter a new code in the box above
              to get {discountPercent}% off again. Affiliates post fresh codes on social media monthly!
            </p>
          </section>
        )}

        {/* Usage Statistics */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-6">📊 Usage This Month</h2>
          <Card>
            <CardContent className="p-8 space-y-6">
              {/* Alerts */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-medium">Alerts</span>
                  <span className="text-2xl font-bold">8/20</span>
                </div>
                <Progress value={40} className="h-4" />
                <p className="text-sm text-gray-600 mt-1">40% used</p>
              </div>

              {/* Watchlist */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-medium">Watchlist Items</span>
                  <span className="text-2xl font-bold">12/50</span>
                </div>
                <Progress value={24} className="h-4" />
                <p className="text-sm text-gray-600 mt-1">24% used</p>
              </div>

              {/* API Calls */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-medium flex items-center gap-2">
                    API Calls (Peak Hour)
                    <span className="text-orange-600 text-xs">⚠️ High usage</span>
                  </span>
                  <span className="text-2xl font-bold">245/300</span>
                </div>
                <Progress value={82} className="h-4" />
                <p className="text-sm text-gray-600 mt-1">82% used</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Billing History */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-6">📄 Billing History</h2>
          <Card>
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="p-3 text-left">Date</th>
                      <th className="p-3 text-left">Description</th>
                      <th className="p-3 text-right">Amount</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center">Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingHistory.map((item, idx) => (
                      <tr key={idx} className={`border-b ${idx % 2 === 0 ? 'bg-gray-50' : ''} hover:bg-blue-50`}>
                        <td className="p-3">{item.date}</td>
                        <td className="p-3">{item.description}</td>
                        <td className="p-3 text-right font-semibold">${item.amount.toFixed(2)}</td>
                        <td className="p-3 text-center text-green-600">{item.status} ✓</td>
                        <td className="p-3 text-center">
                          <Button variant="link" size="sm">Download PDF</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center mt-4">
                <Button variant="outline" size="sm">Previous</Button>
                <span className="text-sm text-gray-600">Page 1 of 3</span>
                <Button variant="outline" size="sm">Next</Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Subscription Actions (Monthly-Only) */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-6">⚙️ Manage Subscription</h2>
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pause Subscription */}
                <div className="text-center p-4">
                  <div className="text-4xl mb-3">⏸️</div>
                  <h3 className="text-lg font-semibold mb-2">Pause Subscription</h3>
                  <p className="text-sm text-gray-600 mb-4">Take a break for up to 3 months</p>
                  <Button variant="outline" className="w-full">Pause</Button>
                </div>

                {/* Notification Settings */}
                <div className="text-center p-4">
                  <div className="text-4xl mb-3">🔔</div>
                  <h3 className="text-lg font-semibold mb-2">Notification Settings</h3>
                  <p className="text-sm text-gray-600 mb-4">Manage billing and renewal reminders</p>
                  <Button variant="outline" className="w-full">Configure</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Downgrade Section */}
        <Card className="bg-gray-50 border-2 border-gray-300 mt-12">
          <CardContent className="p-6">
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Want to downgrade?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Switch to FREE tier anytime. You'll keep your data but lose PRO features.
            </p>
            <ul className="text-sm space-y-2 mb-6">
              <li className="text-orange-600">⚠️ Limited to 5 symbols (currently: 15)</li>
              <li className="text-orange-600">⚠️ Only 3 timeframes (currently: 9)</li>
              <li className="text-orange-600">⚠️ Only 5 alerts (currently: 20)</li>
              {currentDiscount?.active && (
                <li className="text-orange-600">⚠️ FREE tier is not eligible for affiliate discount codes</li>
              )}
            </ul>
            <div className="flex gap-3">
              <Button className="flex-1">Keep PRO Plan</Button>
              <Button variant="outline" className="flex-1 border-gray-300 hover:border-red-500 hover:text-red-600">
                Downgrade to FREE
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

**SYSTEMCONFIG INTEGRATION CHECKLIST:**

- ✅ Imported useAffiliateConfig hook
- ✅ No hardcoded "20%" or "20.0" anywhere
- ✅ No hardcoded "$23.20", "$5.80", "$17.40", "$69.60" anywhere
- ✅ Uses {discountPercent} for all discount percentage displays
- ✅ Uses calculateDiscountedPrice(29) for all price calculations
- ✅ All savings calculations are dynamic
- ✅ Billing history uses dynamic values
- ✅ Annual subscription references removed
- ✅ Discount code input box added (critical for Option A)
- ✅ Reminder schedule documented

Generate complete, production-ready code that I can copy and run immediately.
