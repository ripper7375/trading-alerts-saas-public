PROMPT 2: Pricing Page Component (WITH AFFILIATE DISCOUNT)

=======================================================
Create a comprehensive pricing page component for a Next.js 15 app using TypeScript, Tailwind CSS, and shadcn/ui.

REQUIREMENTS:

1. PAGE HEADER:
   - Breadcrumb: "Home > Pricing" (text-sm, text-gray-500)
   - Main heading: "Choose Your Plan" (text-5xl, font-bold, gradient text, centered)
   - Subheading: "Start free, upgrade when you need more" (text-xl, text-gray-600, centered)
   - Toggle: Monthly / Yearly (with "Save 17%" badge for yearly)

2. PRICING CARDS (2 columns, centered, max-w-5xl):

   **FREE TIER CARD:**
   - Header:
     - Badge: "FREE TIER 🆓" (bg-green-500, text-white, rounded-full, px-4, py-2)
     - Price: "$0" (text-6xl, font-bold, text-gray-900)
     - Period: "/month" (text-xl, text-gray-500)
   - Features section (with checkmarks ✅):
     - "5 Symbols"
       - Small text: "BTCUSD, EURUSD, USDJPY, US30, XAUUSD"
     - "3 Timeframes"
       - Small text: "H1, H4, D1 only"
     - "5 Active Alerts"
     - "5 Watchlist Items"
     - "60 API Requests/hour"
     - "Email & Push Notifications"
   - CTA Button: "Start Free" (bg-green-600, hover:bg-green-700, w-full, py-4, text-lg)
   - Note: "No credit card required" (text-sm, text-gray-500, centered)

   **PRO TIER CARD:** (with "MOST POPULAR" ribbon + AFFILIATE DISCOUNT SUPPORT)
   - Ribbon: "⭐ MOST POPULAR" (absolute, top-right, bg-blue-600, text-white, px-4, py-1, rounded-bl-lg)
   - Border: border-4 border-blue-600 (highlighted)

   - Header (pt-12 to avoid ribbon):
     - Badge: "PRO TIER ⭐" (bg-blue-600, text-white, rounded-full, px-4, py-2)

     - AFFILIATE DISCOUNT BANNER (conditional - show if ?ref=CODE in URL):
       - Container: bg-yellow-50, border-l-4 border-yellow-400, p-3, mb-4, rounded-lg
       - Icon: 🎉 (text-xl, inline)
       - Heading: "Affiliate Discount Active!" (font-semibold, text-yellow-800)
       - Subtext: "20% off applied with code: REF-ABC123" (text-sm, text-yellow-700)

     - PRICING DISPLAY (TWO VERSIONS - conditionally render):

       WITHOUT discount (default):
       - Price: "$29" (text-6xl, font-bold, text-gray-900)
       - Period: "/month" (text-xl, text-gray-500)
       - Yearly option: "$290/year (save $58!)" (text-green-600, text-sm)

       WITH affiliate discount (when ?ref=CODE):
       - Original price: "$29" (text-3xl, text-gray-400, line-through, mr-2)
       - Discounted price: "$23.20" (text-6xl, font-bold, text-green-600)
       - Period: "/month" (text-xl, text-gray-500)
       - Savings text: "Save $5.80/month with affiliate code!" (text-sm, text-green-600, font-medium, mt-1)
       - Yearly option:
         - Original: "$290/year" (line-through, text-gray-400)
         - Discounted: "$232/year" (text-green-600, font-bold)
         - Total savings: "Save $127.60/year total!" (text-xs, text-green-600)

   - Features section (with checkmarks ✅):
     - "15 Symbols"
       - Small text: "All major pairs + crypto + indices"
     - "9 Timeframes"
       - Small text: "M5, M15, M30, H1, H2, H4, H8, H12, D1"
     - "20 Active Alerts"
     - "50 Watchlist Items"
     - "300 API Requests/hour"
     - "All notification types (Email, Push, SMS)"
     - "Priority chart updates (30s)"
     - "Advanced analytics (Coming Soon)" (with badge: "SOON")

   - CTA Button (TWO VERSIONS):
     - WITHOUT discount: "Start 7-Day Trial" (bg-blue-600, hover:bg-blue-700, w-full, py-4, text-lg, pulse animation)
     - WITH discount: "Start 7-Day Trial (20% Off)" (bg-blue-600, hover:bg-blue-700, w-full, py-4, text-lg, pulse animation)

   - Note (TWO VERSIONS):
     - WITHOUT discount: "7-day free trial, then $29/month" (text-sm, text-gray-500, centered)
     - WITH discount: "7-day free trial, then $23.20/month with affiliate code" (text-sm, text-green-600, centered)

3. AFFILIATE PROGRAM BANNER (BEFORE comparison table):
   - Container: bg-gradient-to-r from-green-50 to-blue-50, border-2 border-green-200, rounded-xl, p-6, mb-12, max-w-4xl, mx-auto
   - Layout: flex items-center gap-4 (stack on mobile)
   - Icon: 🤝 (text-3xl)
   - Content:
     - Heading: "Have an affiliate code?" (text-2xl, font-bold, mb-2)
     - Text: "Get 20% off your next PRO subscription payment with a referral code from our partners. New codes available monthly!" (text-gray-700, mb-4)
     - Link: "Learn about our Affiliate Program →" (text-blue-600, hover:underline, font-medium)

4. DETAILED COMPARISON TABLE (Below cards):
   - Section heading: "Detailed Feature Comparison" (text-3xl, font-bold, centered, mt-16, mb-8)
   - Table (w-full, border):

     Headers: Feature | FREE | PRO

     Rows:
     | Symbols | 5 | 15 |
     | Timeframes | 3 (H1, H4, D1) | 9 (M5-D1) |
     | Active Alerts | 5 | 20 |
     | Watchlist Items | 5 | 50 |
     | API Requests/hour | 60 | 300 |
     | Chart Updates | 60 seconds | 30 seconds |
     | Email Notifications | ✅ | ✅ |
     | Push Notifications | ✅ | ✅ |
     | SMS Notifications | ❌ | ✅ |
     | Priority Support | ❌ | ✅ |
     | Advanced Analytics | ❌ | Coming Soon |
     | Affiliate Discount Eligible | ❌ | ✅ 20% off with referral code |

   - Table styling: Striped rows (bg-gray-50/white), hover:bg-blue-50, text-center for values

5. FAQ SECTION:
   - Heading: "Frequently Asked Questions" (text-3xl, font-bold, centered, mb-8)
   - Use shadcn/ui Accordion component
   - Questions (4 items):

     Q1: "Can I switch plans at any time?"
     A: "Yes! You can upgrade from Free to Pro at any time. If you're on the Pro plan, you can downgrade at the end of your billing period. We'll prorate any charges when upgrading mid-cycle."

     Q2: "What happens after the 7-day trial?"
     A: "After your 7-day Pro trial ends, you'll be automatically charged ${isYearly ? "$290/year" : "$29/month"} unless you cancel before the trial period expires. You can cancel anytime during the trial with no charges."

     Q3: "Do you offer refunds?"
     A: "Yes, we offer a 30-day money-back guarantee for all Pro subscriptions. If you're not satisfied with the service, contact our support team within 30 days of your purchase for a full refund."

     Q4: "What is the affiliate discount?" (NEW)
     A: "When you use an affiliate referral code during checkout, you'll receive 20% off that month's PRO subscription payment (price drops from $29 to $23.20). This is a one-time discount per code. To get the discount again next month, you'll need to find and apply a new code during renewal. Affiliates post fresh codes on social media monthly!"

6. FINAL CTA:
   - Background: bg-blue-50, rounded-xl, p-12, text-center
   - Heading: "Ready to get started?" (text-3xl, font-bold, mb-4)
   - Subheading: "Join thousands of traders using our platform" (text-xl, text-gray-600, mb-8)
   - Buttons (flex, justify-center, gap-4):
     - "Start Free" (bg-green-600, hover:bg-green-700, px-8, py-4, text-lg)
     - "Contact Sales" (border-2, border-gray-300, hover:border-blue-600, px-8, py-4, text-lg)

7. RESPONSIVE:
   - Cards: Stack vertically on mobile, side-by-side on desktop
   - Table: Horizontal scroll on mobile
   - Toggle: Full width on mobile
   - Discount banner: Text-center on mobile, full width
   - Affiliate program banner: Stack icon and content on mobile

8. TECHNICAL:
   - Export as default component
   - TypeScript with proper types
   - Use shadcn/ui Card, Button, Badge, Table, Accordion components
   - State for monthly/yearly toggle
   - Smooth transitions and hover effects
   - Use Next.js useSearchParams to detect ?ref=CODE parameter
   - Calculate prices based on affiliate code presence

TECHNICAL IMPLEMENTATION:

```typescript
'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false)
  const searchParams = useSearchParams()
  const affiliateCode = searchParams.get('ref') // Get ?ref=CODE from URL

  // Price calculation
  const proMonthlyPrice = affiliateCode ? 23.20 : 29.00
  const proYearlyPrice = affiliateCode ? 232.00 : 290.00
  const monthlySavings = affiliateCode ? 5.80 : 0

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Breadcrumb */}
        {/* ... */}

        {/* Header */}
        {/* ... */}

        {/* Pricing Cards */}
        <div className="mx-auto mb-16 grid max-w-5xl gap-8 md:grid-cols-2">
          {/* FREE TIER */}
          {/* ... */}

          {/* PRO TIER */}
          <Card className="relative flex flex-col border-4 border-blue-600">
            {/* Most Popular Ribbon */}
            {/* ... */}

            {/* Affiliate Discount Banner - conditional */}
            {affiliateCode && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4 rounded-lg">
                <span className="text-xl">🎉</span>
                <div className="font-semibold text-yellow-800">Affiliate Discount Active!</div>
                <div className="text-sm text-yellow-700">20% off applied with code: {affiliateCode}</div>
              </div>
            )}

            {/* Pricing - conditional rendering */}
            <CardHeader className="pt-12">
              <Badge>PRO TIER ⭐</Badge>
              <CardTitle className="flex items-baseline gap-2">
                {affiliateCode && (
                  <span className="text-3xl text-gray-400 line-through">${isYearly ? "290" : "29"}</span>
                )}
                <span className={`text-6xl font-bold ${affiliateCode ? "text-green-600" : ""}`}>
                  ${isYearly ? proYearlyPrice : proMonthlyPrice}
                </span>
                <span className="text-xl text-muted-foreground">/{isYearly ? "year" : "month"}</span>
              </CardTitle>
              {affiliateCode && (
                <p className="text-sm font-medium text-green-600">
                  Save ${monthlySavings}/month with affiliate code!
                </p>
              )}
            </CardHeader>

            {/* Features */}
            {/* ... */}

            {/* CTA */}
            <CardFooter>
              <Button className="w-full animate-pulse">
                Start 7-Day Trial {affiliateCode && "(20% Off)"}
              </Button>
              <p className={`text-center text-sm ${affiliateCode ? "text-green-600" : "text-muted-foreground"}`}>
                7-day free trial, then ${proMonthlyPrice}/month{affiliateCode && " with affiliate code"}
              </p>
            </CardFooter>
          </Card>
        </div>

        {/* Affiliate Program Banner */}
        {/* ... */}

        {/* Comparison Table */}
        {/* ... */}

        {/* FAQ */}
        {/* ... */}

        {/* Final CTA */}
        {/* ... */}
      </div>
    </div>
  )
}
```

Generate complete, production-ready code that I can copy and run immediately.
