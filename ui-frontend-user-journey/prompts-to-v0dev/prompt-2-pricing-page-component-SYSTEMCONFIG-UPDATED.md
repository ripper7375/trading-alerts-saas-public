PROMPT 2: Pricing Page Component (WITH SYSTEMCONFIG + MONTHLY-ONLY)

=======================================================
Create a comprehensive pricing page component for a Next.js 15 app using TypeScript, Tailwind CSS, and shadcn/ui.

**CRITICAL: Use SystemConfig for Dynamic Percentages**

- DO NOT hardcode discount percentages (e.g., "20%")
- DO NOT hardcode commission percentages (e.g., "20%")
- DO NOT hardcode prices (e.g., "$23.20", "$5.80")
- MUST use `useAffiliateConfig()` hook for all dynamic values
- All percentages and calculations MUST be dynamic from SystemConfig

REQUIREMENTS:

1. PAGE HEADER:
   - Breadcrumb: "Home > Pricing" (text-sm, text-gray-500)
   - Main heading: "Choose Your Plan" (text-5xl, font-bold, gradient text, centered)
   - Subheading: "Start free, upgrade when you need more" (text-xl, text-gray-600, centered)
   - NO billing cycle toggle (monthly-only during early stage)

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
       - Subtext: "{discountPercent}% off applied with code: {affiliateCode}" (text-sm, text-yellow-700)
         - Use dynamic discountPercent from useAffiliateConfig()

     - PRICING DISPLAY (TWO VERSIONS - conditionally render):

       WITHOUT discount (default):
       - Price: "$29" (text-6xl, font-bold, text-gray-900)
       - Period: "/month" (text-xl, text-gray-500)
       - Note: "Monthly subscription (auto-renews)" (text-sm, text-gray-500)

       WITH affiliate discount (when ?ref=CODE):
       - Original price: "$29" (text-3xl, text-gray-400, line-through, mr-2)
       - Discounted price: "${calculateDiscountedPrice(29)}" (text-6xl, font-bold, text-green-600)
         - Use calculateDiscountedPrice() helper from useAffiliateConfig()
       - Period: "/month" (text-xl, text-gray-500)
       - Savings text: "Save ${29 - calculateDiscountedPrice(29)}/month with affiliate code!" (text-sm, text-green-600, font-medium, mt-1)
         - Calculate savings dynamically based on current discount percentage

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
     - WITH discount: "Start 7-Day Trial ({discountPercent}% Off)" (bg-blue-600, hover:bg-blue-700, w-full, py-4, text-lg, pulse animation)
       - Use dynamic discountPercent from useAffiliateConfig()

   - Note (TWO VERSIONS):
     - WITHOUT discount: "7-day free trial, then $29/month" (text-sm, text-gray-500, centered)
     - WITH discount: "7-day free trial, then ${calculateDiscountedPrice(29)}/month with affiliate code" (text-sm, text-green-600, centered)
       - Use calculateDiscountedPrice() for dynamic pricing

3. AFFILIATE PROGRAM BANNER (BEFORE comparison table):
   - Container: bg-gradient-to-r from-green-50 to-blue-50, border-2 border-green-200, rounded-xl, p-6, mb-12, max-w-4xl, mx-auto
   - Layout: flex items-center gap-4 (stack on mobile)
   - Icon: 🤝 (text-3xl)
   - Content:
     - Heading: "Have an affiliate code?" (text-2xl, font-bold, mb-2)
     - Text: "Get {discountPercent}% off your next PRO subscription payment with a referral code from our partners. New codes available monthly!" (text-gray-700, mb-4)
       - Use dynamic discountPercent from useAffiliateConfig()
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
     | Affiliate Discount Eligible | ❌ | ✅ {discountPercent}% off with referral code |
     - Use dynamic discountPercent from useAffiliateConfig()

   - Table styling: Striped rows (bg-gray-50/white), hover:bg-blue-50, text-center for values

5. FAQ SECTION:
   - Heading: "Frequently Asked Questions" (text-3xl, font-bold, centered, mb-8)
   - Use shadcn/ui Accordion component
   - Questions (5 items):

     Q1: "Can I switch plans at any time?"
     A: "Yes! You can upgrade from Free to Pro at any time. If you're on the Pro plan, you can cancel at the end of your billing period to downgrade to Free."

     Q2: "What happens after the 7-day trial?"
     A: "After your 7-day Pro trial ends, you'll be automatically charged $29/month unless you cancel before the trial period expires. You can cancel anytime during the trial with no charges."

     Q3: "Do you offer refunds?"
     A: "Yes, we offer a 30-day money-back guarantee for all Pro subscriptions. If you're not satisfied with the service, contact our support team within 30 days of your purchase for a full refund."

     Q4: "What is the affiliate discount?"
     A: "When you use an affiliate referral code during checkout, you'll receive {discountPercent}% off that month's PRO subscription payment (price drops from $29 to ${calculateDiscountedPrice(29)}). This is a one-time discount per code. To get the discount again next month, you'll need to find and apply a new code before your renewal date. Affiliates post fresh codes on social media monthly!"
     - Use dynamic discountPercent and calculateDiscountedPrice() from useAffiliateConfig()

     Q5: "Why don't you offer annual subscriptions?"
     A: "We're currently in our early stage and actively developing new features based on user feedback. We offer monthly subscriptions to give you the flexibility to adjust as we grow. Annual plans will be introduced once our feature set is stable and mature (estimated 6-12 months)."

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
   - Discount banner: Text-center on mobile, full width
   - Affiliate program banner: Stack icon and content on mobile

8. TECHNICAL:
   - Export as default component
   - TypeScript with proper types
   - Use shadcn/ui Card, Button, Badge, Table, Accordion components
   - MUST import and use useAffiliateConfig() hook
   - Smooth transitions and hover effects
   - Use Next.js useSearchParams to detect ?ref=CODE parameter
   - Calculate prices dynamically using calculateDiscountedPrice() helper

TECHNICAL IMPLEMENTATION:

```typescript
'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check } from 'lucide-react'

export default function PricingPage() {
  const searchParams = useSearchParams()
  const affiliateCode = searchParams.get('ref') // Get ?ref=CODE from URL

  // ✅ CRITICAL: Use SystemConfig hook for dynamic percentages
  const {
    discountPercent,
    commissionPercent,
    calculateDiscountedPrice,
    config,
    isLoading
  } = useAffiliateConfig()

  // Price constants
  const regularPrice = 29.00

  // Calculate discounted price using helper
  const discountedPrice = calculateDiscountedPrice(regularPrice)
  const savings = regularPrice - discountedPrice

  // Show loading state while fetching config
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Breadcrumb */}
        <nav className="mb-8 text-sm text-gray-500">
          Home &gt; Pricing
        </nav>

        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600">
            Start free, upgrade when you need more
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="mx-auto mb-16 grid max-w-5xl gap-8 md:grid-cols-2">
          {/* FREE TIER */}
          <Card className="flex flex-col">
            <CardHeader>
              <Badge className="w-fit bg-green-500 text-white">FREE TIER 🆓</Badge>
              <CardTitle className="flex items-baseline gap-2 mt-4">
                <span className="text-6xl font-bold text-gray-900">$0</span>
                <span className="text-xl text-gray-500">/month</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <div className="font-medium">5 Symbols</div>
                    <div className="text-sm text-gray-500">BTCUSD, EURUSD, USDJPY, US30, XAUUSD</div>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <div className="font-medium">3 Timeframes</div>
                    <div className="text-sm text-gray-500">H1, H4, D1 only</div>
                  </div>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>5 Active Alerts</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>5 Watchlist Items</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>60 API Requests/hour</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Email & Push Notifications</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button className="w-full bg-green-600 hover:bg-green-700 py-6 text-lg">
                Start Free
              </Button>
              <p className="text-center text-sm text-gray-500">No credit card required</p>
            </CardFooter>
          </Card>

          {/* PRO TIER */}
          <Card className="relative flex flex-col border-4 border-blue-600">
            {/* Most Popular Ribbon */}
            <div className="absolute top-0 right-0 bg-blue-600 text-white px-4 py-1 rounded-bl-lg text-sm font-medium">
              ⭐ MOST POPULAR
            </div>

            <CardHeader className="pt-12">
              <Badge className="w-fit bg-blue-600 text-white">PRO TIER ⭐</Badge>

              {/* Affiliate Discount Banner - conditional */}
              {affiliateCode && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mt-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🎉</span>
                    <div>
                      <div className="font-semibold text-yellow-800">Affiliate Discount Active!</div>
                      <div className="text-sm text-yellow-700">
                        {discountPercent}% off applied with code: {affiliateCode}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Pricing - conditional rendering */}
              <CardTitle className="flex items-baseline gap-2 mt-4">
                {affiliateCode && (
                  <span className="text-3xl text-gray-400 line-through">${regularPrice}</span>
                )}
                <span className={`text-6xl font-bold ${affiliateCode ? "text-green-600" : "text-gray-900"}`}>
                  ${affiliateCode ? discountedPrice.toFixed(2) : regularPrice}
                </span>
                <span className="text-xl text-gray-500">/month</span>
              </CardTitle>

              {affiliateCode ? (
                <p className="text-sm font-medium text-green-600 mt-2">
                  Save ${savings.toFixed(2)}/month with affiliate code!
                </p>
              ) : (
                <p className="text-sm text-gray-500 mt-2">
                  Monthly subscription (auto-renews)
                </p>
              )}
            </CardHeader>

            <CardContent className="flex-1">
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <div className="font-medium">15 Symbols</div>
                    <div className="text-sm text-gray-500">All major pairs + crypto + indices</div>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <div className="font-medium">9 Timeframes</div>
                    <div className="text-sm text-gray-500">M5, M15, M30, H1, H2, H4, H8, H12, D1</div>
                  </div>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-blue-500" />
                  <span>20 Active Alerts</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-blue-500" />
                  <span>50 Watchlist Items</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-blue-500" />
                  <span>300 API Requests/hour</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-blue-500" />
                  <span>All notification types (Email, Push, SMS)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-blue-500" />
                  <span>Priority chart updates (30s)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-blue-500" />
                  <span className="flex items-center gap-2">
                    Advanced analytics
                    <Badge variant="outline" className="text-xs">SOON</Badge>
                  </span>
                </li>
              </ul>
            </CardContent>

            <CardFooter className="flex flex-col gap-2">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-lg animate-pulse">
                Start 7-Day Trial {affiliateCode && `(${discountPercent}% Off)`}
              </Button>
              <p className={`text-center text-sm ${affiliateCode ? "text-green-600" : "text-gray-500"}`}>
                7-day free trial, then ${affiliateCode ? discountedPrice.toFixed(2) : regularPrice}/month
                {affiliateCode && " with affiliate code"}
              </p>
            </CardFooter>
          </Card>
        </div>

        {/* Affiliate Program Banner */}
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-xl p-6 mb-12 max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <span className="text-3xl">🤝</span>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl font-bold mb-2">Have an affiliate code?</h3>
              <p className="text-gray-700 mb-4">
                Get {discountPercent}% off your next PRO subscription payment with a referral code from our partners.
                New codes available monthly!
              </p>
              <a href="/affiliate" className="text-blue-600 hover:underline font-medium">
                Learn about our Affiliate Program →
              </a>
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">Detailed Feature Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="p-4 text-left">Feature</th>
                  <th className="p-4 text-center">FREE</th>
                  <th className="p-4 text-center">PRO</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-blue-50">
                  <td className="p-4">Symbols</td>
                  <td className="p-4 text-center">5</td>
                  <td className="p-4 text-center">15</td>
                </tr>
                <tr className="border-b bg-gray-50 hover:bg-blue-50">
                  <td className="p-4">Timeframes</td>
                  <td className="p-4 text-center">3 (H1, H4, D1)</td>
                  <td className="p-4 text-center">9 (M5-D1)</td>
                </tr>
                <tr className="border-b hover:bg-blue-50">
                  <td className="p-4">Active Alerts</td>
                  <td className="p-4 text-center">5</td>
                  <td className="p-4 text-center">20</td>
                </tr>
                <tr className="border-b bg-gray-50 hover:bg-blue-50">
                  <td className="p-4">Watchlist Items</td>
                  <td className="p-4 text-center">5</td>
                  <td className="p-4 text-center">50</td>
                </tr>
                <tr className="border-b hover:bg-blue-50">
                  <td className="p-4">API Requests/hour</td>
                  <td className="p-4 text-center">60</td>
                  <td className="p-4 text-center">300</td>
                </tr>
                <tr className="border-b bg-gray-50 hover:bg-blue-50">
                  <td className="p-4">Chart Updates</td>
                  <td className="p-4 text-center">60 seconds</td>
                  <td className="p-4 text-center">30 seconds</td>
                </tr>
                <tr className="border-b hover:bg-blue-50">
                  <td className="p-4">Email Notifications</td>
                  <td className="p-4 text-center">✅</td>
                  <td className="p-4 text-center">✅</td>
                </tr>
                <tr className="border-b bg-gray-50 hover:bg-blue-50">
                  <td className="p-4">Push Notifications</td>
                  <td className="p-4 text-center">✅</td>
                  <td className="p-4 text-center">✅</td>
                </tr>
                <tr className="border-b hover:bg-blue-50">
                  <td className="p-4">SMS Notifications</td>
                  <td className="p-4 text-center">❌</td>
                  <td className="p-4 text-center">✅</td>
                </tr>
                <tr className="border-b bg-gray-50 hover:bg-blue-50">
                  <td className="p-4">Priority Support</td>
                  <td className="p-4 text-center">❌</td>
                  <td className="p-4 text-center">✅</td>
                </tr>
                <tr className="border-b hover:bg-blue-50">
                  <td className="p-4">Advanced Analytics</td>
                  <td className="p-4 text-center">❌</td>
                  <td className="p-4 text-center">Coming Soon</td>
                </tr>
                <tr className="border-b bg-gray-50 hover:bg-blue-50">
                  <td className="p-4">Affiliate Discount Eligible</td>
                  <td className="p-4 text-center">❌</td>
                  <td className="p-4 text-center">✅ {discountPercent}% off with referral code</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mb-16 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          {/* Use shadcn/ui Accordion component here */}
          <div className="space-y-4">
            <details className="group">
              <summary className="flex cursor-pointer items-center justify-between rounded-lg bg-gray-50 p-4 hover:bg-gray-100">
                <h3 className="font-medium">Can I switch plans at any time?</h3>
                <span className="ml-1.5 flex-shrink-0">
                  <svg className="h-5 w-5 transition group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </summary>
              <p className="mt-4 px-4 text-gray-600">
                Yes! You can upgrade from Free to Pro at any time. If you're on the Pro plan, you can cancel at the end of your billing period to downgrade to Free.
              </p>
            </details>

            <details className="group">
              <summary className="flex cursor-pointer items-center justify-between rounded-lg bg-gray-50 p-4 hover:bg-gray-100">
                <h3 className="font-medium">What happens after the 7-day trial?</h3>
                <span className="ml-1.5 flex-shrink-0">
                  <svg className="h-5 w-5 transition group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </summary>
              <p className="mt-4 px-4 text-gray-600">
                After your 7-day Pro trial ends, you'll be automatically charged $29/month unless you cancel before the trial period expires. You can cancel anytime during the trial with no charges.
              </p>
            </details>

            <details className="group">
              <summary className="flex cursor-pointer items-center justify-between rounded-lg bg-gray-50 p-4 hover:bg-gray-100">
                <h3 className="font-medium">Do you offer refunds?</h3>
                <span className="ml-1.5 flex-shrink-0">
                  <svg className="h-5 w-5 transition group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </summary>
              <p className="mt-4 px-4 text-gray-600">
                Yes, we offer a 30-day money-back guarantee for all Pro subscriptions. If you're not satisfied with the service, contact our support team within 30 days of your purchase for a full refund.
              </p>
            </details>

            <details className="group">
              <summary className="flex cursor-pointer items-center justify-between rounded-lg bg-gray-50 p-4 hover:bg-gray-100">
                <h3 className="font-medium">What is the affiliate discount?</h3>
                <span className="ml-1.5 flex-shrink-0">
                  <svg className="h-5 w-5 transition group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </summary>
              <p className="mt-4 px-4 text-gray-600">
                When you use an affiliate referral code during checkout, you'll receive {discountPercent}% off that month's PRO subscription payment
                (price drops from $29 to ${discountedPrice.toFixed(2)}). This is a one-time discount per code. To get the discount again next month,
                you'll need to find and apply a new code before your renewal date. Affiliates post fresh codes on social media monthly!
              </p>
            </details>

            <details className="group">
              <summary className="flex cursor-pointer items-center justify-between rounded-lg bg-gray-50 p-4 hover:bg-gray-100">
                <h3 className="font-medium">Why don't you offer annual subscriptions?</h3>
                <span className="ml-1.5 flex-shrink-0">
                  <svg className="h-5 w-5 transition group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </summary>
              <p className="mt-4 px-4 text-gray-600">
                We're currently in our early stage and actively developing new features based on user feedback. We offer monthly subscriptions
                to give you the flexibility to adjust as we grow. Annual plans will be introduced once our feature set is stable and mature
                (estimated 6-12 months).
              </p>
            </details>
          </div>
        </div>

        {/* Final CTA */}
        <div className="bg-blue-50 rounded-xl p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-xl text-gray-600 mb-8">Join thousands of traders using our platform</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button className="bg-green-600 hover:bg-green-700 px-8 py-6 text-lg">
              Start Free
            </Button>
            <Button variant="outline" className="border-2 border-gray-300 hover:border-blue-600 px-8 py-6 text-lg">
              Contact Sales
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

**SYSTEMCONFIG INTEGRATION CHECKLIST:**

- ✅ Imported useAffiliateConfig hook
- ✅ No hardcoded "20%" or "20.0" anywhere
- ✅ No hardcoded "$23.20" or "$5.80" anywhere
- ✅ Uses {discountPercent} for discount percentage display
- ✅ Uses {commissionPercent} for commission percentage display (if needed)
- ✅ Uses calculateDiscountedPrice(29) for price calculations
- ✅ All savings calculations are dynamic
- ✅ FAQ answers use dynamic values
- ✅ Affiliate banner uses dynamic percentage
- ✅ Comparison table uses dynamic percentage

Generate complete, production-ready code that I can copy and run immediately.
