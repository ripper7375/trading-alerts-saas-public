## **PROMPT 8: Billing & Subscription Page (WITH AFFILIATE DISCOUNT)**

=========================================

Create a billing and subscription management page for Next.js 15 using TypeScript, Tailwind CSS, and shadcn/ui.

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
     - "🎉 20% AFFILIATE DISCOUNT" (bg-green-400/30, text-white, rounded-full, px-4, py-2) - CONDITIONAL

   - Plan name: "Pro Plan" (text-4xl, font-bold, mt-4)

   - PRICING DISPLAY (TWO VERSIONS - conditional):

     WITHOUT discount (default):
     - Price: "$29/month" (text-5xl, font-bold, mt-2)

     WITH affiliate discount:
     - Container: flex items-baseline gap-3
     - Original price: "$29" (text-3xl, text-white/60, line-through)
     - Discounted price: "$23.20" (text-5xl, font-bold)
     - Period: "/month" (text-xl, text-white/90)
     - Savings label: "20% off this month" (bg-green-400, text-green-900, px-2 py-1, rounded-full, text-xs, font-semibold, ml-2)

   - Renewal date (TWO VERSIONS):
     - WITHOUT: "Renews on Feb 15, 2025" (text-xl, text-white/90, mt-2)
     - WITH: "Renews on Feb 15, 2025 at $29.00" (text-xl, text-white/90, mt-2)
       - Sub-text: "Use a new affiliate code at renewal to get 20% off again!" (text-sm, text-white/80, mt-1)

   - Member since: "Member since Jan 15, 2025" (text-lg, text-white/80)

   - AFFILIATE DISCOUNT DETAILS (conditional - only if discount active):
     - Container: bg-white/20, rounded-lg, p-3, mt-4, mb-4, border border-white/30
     - Layout: flex items-center gap-3
     - Icon: 🎉 (text-2xl)
     - Content:
       - Heading: "Affiliate Discount Active" (font-semibold, text-lg)
       - Details: "20% off • Code: REF-ABC123XYZ" (text-white/90, text-sm)
       - Savings: "You save $5.80/month" (text-white/80, text-xs)

   - Features grid (2 columns on desktop, 1 on mobile, mt-6):
     - ✅ 15 Symbols
     - ✅ 9 Timeframes (M5-D1)
     - ✅ 20 Alerts
     - ✅ 50 Watchlist Items
     - ✅ Email & Push Notifications
     - ✅ 300 API Requests/hour

3. PAYMENT METHOD SECTION:
   - Section heading: "💳 Payment Method" (text-2xl, font-bold, mb-6, mt-12)
   - Card: white bg, rounded-xl, shadow-lg, p-6
   - Layout: flex items-center justify-between
   - Left side:
     - Card icon: 💳 with Visa logo
     - "Visa ending in \*\*\*\*4242" (text-xl, font-semibold)
     - "Expires: 12/2026" (text-sm, text-gray-600)
   - Right side:
     - Button: "Update Card" (border-2, border-gray-300, px-4, py-2, rounded-lg, hover:border-blue-600)

4. AFFILIATE DISCOUNT SUMMARY (NEW - conditional section):
   - Position: AFTER Payment Method, BEFORE Usage Statistics
   - Section heading: "🎁 Your Affiliate Discount" (text-2xl, font-bold, mb-6, mt-12)
   - Card: bg-gradient-to-r from-green-50 to-blue-50, border-2 border-green-200, rounded-xl, shadow-lg, p-6
   - Layout: Grid 2 columns on desktop, 1 on mobile, gap-8

   Left Column:
   - Icon: 🤝 (text-4xl, mb-3)
   - Heading: "20% Discount This Month" (text-2xl, font-bold, text-gray-900, mb-2)
   - Description: "You're saving $5.80 this month with your affiliate code. Find new codes monthly to keep saving!" (text-gray-700, mb-4)
   - Code display:
     - Label: "Your referral code:" (text-sm, text-gray-600)
     - Code: "REF-ABC123XYZ" (bg-white, px-4, py-2, rounded-lg, font-mono, text-lg, border-2 border-gray-300, mt-1)

   Right Column (Stats):
   - Stat 1:
     - Label: "Total Saved So Far" (text-sm, text-gray-600)
     - Value: "$17.40" (text-3xl, font-bold, text-green-600)
     - Subtext: "Across 3 billing cycles" (text-xs, text-gray-500)
   - Stat 2 (mt-4):
     - Label: "Projected Annual Savings" (text-sm, text-gray-600)
     - Value: "$69.60" (text-2xl, font-bold, text-blue-600)
     - Subtext: "Over 12 months" (text-xs, text-gray-500)

   Important Notice (below card):
   - Text: "ℹ️ Your discount code is valid for one payment only. At renewal, enter a new code to get 20% off again. Affiliates post fresh codes on social media monthly!" (text-sm, text-gray-600, italic, mt-4)

5. USAGE STATISTICS:
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

6. BILLING HISTORY (Updated with Discount):
   - Section heading: "📄 Billing History" (text-2xl, font-bold, mb-6, mt-12)
   - Card: white bg, rounded-xl, shadow-lg, p-6
   - Table with columns: Date | Description | Amount | Status | Invoice

   - TWO VERSIONS OF DATA:

   WITHOUT discount:
   - Row 1: Feb 15, 2025 | Pro Plan - Monthly | $29.00 | Paid ✓ | [Download PDF]
   - Row 2: Jan 15, 2025 | Pro Plan - Monthly | $29.00 | Paid ✓ | [Download PDF]
   - Row 3: Dec 15, 2024 | Pro Plan - Monthly | $29.00 | Paid ✓ | [Download PDF]

   WITH discount:
   - Row 1: Feb 15, 2025 | Pro Plan - Monthly (20% off) ℹ️ | $23.20 | Paid ✓ | [Download PDF]
   - Row 2: Jan 15, 2025 | Pro Plan - Monthly (20% off) ℹ️ | $23.20 | Paid ✓ | [Download PDF]
   - Row 3: Dec 15, 2024 | Pro Plan - Monthly (20% off) ℹ️ | $23.20 | Paid ✓ | [Download PDF]
   * Info icon (ℹ️) has tooltip on hover: "Original: $29.00 | Discount: -$5.80 | Paid: $23.20"
   * Table styling: Striped rows (hover:bg-gray-50)
   * Pagination below: "Page 1 of 3" with [Previous] [Next] buttons

7. SUBSCRIPTION ACTIONS (Enhanced with Discount Warning):
   - Section heading: "⚙️ Manage Subscription" (text-2xl, font-bold, mb-6, mt-12)
   - Card: white bg, rounded-xl, shadow-lg, p-6
   - Grid: 2 columns on desktop, 1 on mobile, gap-6

   Action Card 1 (Enhanced):
   - Icon: 💰 (text-4xl, mb-3)
   - Title: "Switch to Annual" (text-lg, font-semibold, mb-2)
   - Description (TWO VERSIONS):
     - WITHOUT: "Save $58/year by switching"
     - WITH: "Annual price with your 20% discount: $232/year" (text-sm, text-green-600, font-medium, mt-1)
       - Original: "$290/year" (text-gray-400, line-through, text-sm)
       - Total savings: "Save $127.60/year total" (text-xs, text-gray-600)
   - Button: "Switch to Annual" (border-2, border-blue-600, text-blue-600, px-4, py-2, rounded-lg, hover:bg-blue-50, w-full)

   Action Card 2:
   - Icon: ⏸️ (text-4xl, mb-3)
   - Title: "Pause Subscription" (text-lg, font-semibold, mb-2)
   - Description: "Take a break for up to 3 months" (text-sm, text-gray-600, mb-4)
   - Button: "Pause" (border-2, border-gray-300, text-gray-700, px-4, py-2, rounded-lg, hover:border-yellow-500, w-full)

8. DOWNGRADE SECTION (Enhanced with Discount Warning):
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

TECHNICAL:

- Export as default component
- TypeScript with props interface (see below)
- Use shadcn/ui: Card, Button, Badge, Progress, Table
- Mock data included
- Make interactive (buttons should have onClick handlers with console.log)

TECHNICAL IMPLEMENTATION:

```typescript
'use client'

interface BillingPageProps {
  tier?: "FREE" | "PRO"
  subscriptionStatus?: "active" | "trial" | "canceled"
  affiliateDiscount?: {
    active: boolean
    code: string
    discountPercent: number // 20
    monthlySavings: number // 5.80
    totalSaved: number // 17.40
    cyclesSaved: number // 3
  } | null
}

export default function BillingPage({
  tier = "PRO",
  subscriptionStatus = "active",
  affiliateDiscount = null
}: BillingPageProps) {

  // Price calculation
  const baseMonthlyPrice = 29.00
  const baseYearlyPrice = 290.00

  const monthlyPrice = affiliateDiscount?.active
    ? baseMonthlyPrice * (1 - affiliateDiscount.discountPercent / 100)
    : baseMonthlyPrice

  const yearlyPrice = affiliateDiscount?.active
    ? baseYearlyPrice * (1 - affiliateDiscount.discountPercent / 100)
    : baseYearlyPrice

  // Billing history
  const billingHistory = [
    {
      date: "Feb 15, 2025",
      description: affiliateDiscount?.active
        ? "Pro Plan - Monthly (20% off)"
        : "Pro Plan - Monthly",
      amount: `$${monthlyPrice.toFixed(2)}`,
      originalAmount: affiliateDiscount?.active ? "$29.00" : undefined,
      savings: affiliateDiscount?.active ? "$5.80" : undefined,
      status: "Paid",
    },
    // ... more entries
  ]

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        {/* Breadcrumb */}
        {/* ... */}

        {/* Page Header */}
        {/* ... */}

        {/* Current Plan Card */}
        <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl shadow-2xl mb-8 border-0">
          <CardContent className="p-8">
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge>PRO TIER ⭐</Badge>
              <Badge>✓ ACTIVE</Badge>
              {affiliateDiscount?.active && (
                <Badge className="bg-green-400/30">🎉 20% AFFILIATE DISCOUNT</Badge>
              )}
            </div>

            <h2 className="text-4xl font-bold mt-4">Pro Plan</h2>

            {/* Pricing - conditional */}
            <div className="flex items-baseline gap-3 mt-2">
              {affiliateDiscount?.active && (
                <span className="text-3xl text-white/60 line-through">$29</span>
              )}
              <span className="text-5xl font-bold">${monthlyPrice.toFixed(2)}</span>
              <span className="text-xl text-white/90">/month</span>
              {affiliateDiscount?.active && (
                <span className="bg-green-400 text-green-900 px-2 py-1 rounded-full text-xs font-semibold ml-2">
                  20% off this month
                </span>
              )}
            </div>

            {/* Renewal date */}
            <div className="text-xl text-white/90 mt-2">
              Renews on Feb 15, 2025 at $29.00
            </div>
            {affiliateDiscount?.active && (
              <div className="text-sm text-white/80 mt-1">
                Use a new affiliate code at renewal to get 20% off again!
              </div>
            )}

            <div className="text-lg text-white/80">Member since Jan 15, 2025</div>

            {/* Affiliate discount details */}
            {affiliateDiscount?.active && (
              <div className="bg-white/20 rounded-lg p-3 mt-4 mb-4 border border-white/30">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎉</span>
                  <div className="flex-1">
                    <div className="font-semibold text-lg">Affiliate Discount Active</div>
                    <div className="text-white/90 text-sm">20% off • Code: {affiliateDiscount.code}</div>
                    <div className="text-white/80 text-xs">You save ${affiliateDiscount.monthlySavings}/month</div>
                  </div>
                </div>
              </div>
            )}

            {/* Features grid */}
            {/* ... */}
          </CardContent>
        </Card>

        {/* Payment Method Section */}
        {/* ... */}

        {/* Affiliate Discount Summary (conditional) */}
        {affiliateDiscount?.active && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold mb-6">🎁 Your Affiliate Discount</h2>
            <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200">
              {/* ... stats and code display ... */}
            </Card>
            <p className="text-sm text-gray-600 italic mt-4">
              ℹ️ Your discount code is valid for one payment only. At renewal, enter a new code to get 20% off again.
              Affiliates post fresh codes on social media monthly!
            </p>
          </section>
        )}

        {/* Usage Statistics */}
        {/* ... */}

        {/* Billing History (with discount amounts) */}
        {/* ... */}

        {/* Subscription Actions */}
        {/* ... */}

        {/* Downgrade Section (with discount warning) */}
        {/* ... */}
      </div>
    </div>
  )
}
```

Generate complete, production-ready code with all sections that I can copy and run immediately.
