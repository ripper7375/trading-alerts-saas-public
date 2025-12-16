'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';

function PricingPageContent() {
  const searchParams = useSearchParams();
  const affiliateCode = searchParams.get('ref'); // Get ?ref=CODE from URL

  // ✅ CRITICAL: Use SystemConfig hook for dynamic percentages
  const {
    discountPercent,
    commissionPercent,
    calculateDiscountedPrice,
    config,
    isLoading,
  } = useAffiliateConfig();

  // Price constants
  const regularPrice = 29.0;

  // Calculate discounted price using helper
  const discountedPrice = calculateDiscountedPrice(regularPrice);
  const savings = regularPrice - discountedPrice;

  // Show loading state while fetching config
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading pricing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Breadcrumb */}
        <nav className="mb-8 text-sm text-muted-foreground">
          Home &gt; Pricing
        </nav>

        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-foreground mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-muted-foreground">
            Start free, upgrade when you need more
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="mx-auto mb-16 grid max-w-5xl gap-8 md:grid-cols-2">
          {/* FREE TIER */}
          <Card className="flex flex-col">
            <CardHeader>
              <Badge
                className="w-fit text-white"
                style={{ backgroundColor: '#22c55e' }}
              >
                FREE TIER 🆓
              </Badge>
              <CardTitle className="flex items-baseline gap-2 mt-4">
                <span className="text-6xl font-bold">$0</span>
                <span className="text-xl text-muted-foreground">/month</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Check
                    className="h-5 w-5 mt-0.5 flex-shrink-0"
                    style={{ color: '#22c55e' }}
                  />
                  <div>
                    <div className="font-medium">5 Symbols</div>
                    <div className="text-sm text-muted-foreground">
                      BTCUSD, EURUSD, USDJPY, US30, XAUUSD
                    </div>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <Check
                    className="h-5 w-5 mt-0.5 flex-shrink-0"
                    style={{ color: '#22c55e' }}
                  />
                  <div>
                    <div className="font-medium">3 Timeframes</div>
                    <div className="text-sm text-muted-foreground">
                      H1, H4, D1 only
                    </div>
                  </div>
                </li>
                <li className="flex items-center gap-2">
                  <Check
                    className="h-5 w-5 flex-shrink-0"
                    style={{ color: '#22c55e' }}
                  />
                  <span>5 Active Alerts</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check
                    className="h-5 w-5 flex-shrink-0"
                    style={{ color: '#22c55e' }}
                  />
                  <span>5 Watchlist Items</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check
                    className="h-5 w-5 flex-shrink-0"
                    style={{ color: '#22c55e' }}
                  />
                  <span>60 API Requests/hour</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check
                    className="h-5 w-5 flex-shrink-0"
                    style={{ color: '#22c55e' }}
                  />
                  <span>Email & Push Notifications</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button
                className="w-full py-6 text-lg text-white"
                style={{ backgroundColor: '#16a34a' }}
              >
                Start Free
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                No credit card required
              </p>
            </CardFooter>
          </Card>

          {/* PRO TIER */}
          <Card
            className="relative flex flex-col border-4"
            style={{ borderColor: '#2563eb' }}
          >
            {/* Most Popular Ribbon */}
            <div
              className="absolute top-0 right-0 text-white px-4 py-1 rounded-bl-lg text-sm font-medium"
              style={{ backgroundColor: '#2563eb' }}
            >
              ⭐ MOST POPULAR
            </div>

            <CardHeader className="pt-12">
              <Badge
                className="w-fit text-white"
                style={{ backgroundColor: '#2563eb' }}
              >
                PRO TIER ⭐
              </Badge>

              {/* Affiliate Discount Banner - conditional */}
              {affiliateCode && (
                <div
                  className="border-l-4 p-3 mt-4 rounded-lg"
                  style={{
                    backgroundColor: 'oklch(0.97 0.08 90)',
                    borderColor: '#facc15',
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xl">🎉</span>
                    <div className="flex-1">
                      <div
                        className="font-semibold"
                        style={{ color: '#854d0e' }}
                      >
                        Affiliate Discount Active!
                      </div>
                      <div className="text-sm" style={{ color: '#a16207' }}>
                        {discountPercent}% off applied with code:{' '}
                        <span className="font-mono font-bold">
                          {affiliateCode}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Pricing - conditional rendering */}
              <CardTitle className="flex flex-wrap items-baseline gap-2 mt-4">
                {affiliateCode && (
                  <span className="text-3xl text-muted-foreground line-through">
                    ${regularPrice}
                  </span>
                )}
                <span
                  className={`text-6xl font-bold`}
                  style={affiliateCode ? { color: '#16a34a' } : {}}
                >
                  ${affiliateCode ? discountedPrice.toFixed(2) : regularPrice}
                </span>
                <span className="text-xl text-muted-foreground">/month</span>
              </CardTitle>

              {affiliateCode ? (
                <p
                  className="text-sm font-medium mt-2"
                  style={{ color: '#16a34a' }}
                >
                  Save ${savings.toFixed(2)}/month with affiliate code!
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">
                  Monthly subscription (auto-renews)
                </p>
              )}
            </CardHeader>

            <CardContent className="flex-1">
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Check
                    className="h-5 w-5 mt-0.5 flex-shrink-0"
                    style={{ color: '#2563eb' }}
                  />
                  <div>
                    <div className="font-medium">15 Symbols</div>
                    <div className="text-sm text-muted-foreground">
                      All major pairs + crypto + indices
                    </div>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <Check
                    className="h-5 w-5 mt-0.5 flex-shrink-0"
                    style={{ color: '#2563eb' }}
                  />
                  <div>
                    <div className="font-medium">9 Timeframes</div>
                    <div className="text-sm text-muted-foreground">
                      M5, M15, M30, H1, H2, H4, H8, H12, D1
                    </div>
                  </div>
                </li>
                <li className="flex items-center gap-2">
                  <Check
                    className="h-5 w-5 flex-shrink-0"
                    style={{ color: '#2563eb' }}
                  />
                  <span>20 Active Alerts</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check
                    className="h-5 w-5 flex-shrink-0"
                    style={{ color: '#2563eb' }}
                  />
                  <span>50 Watchlist Items</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check
                    className="h-5 w-5 flex-shrink-0"
                    style={{ color: '#2563eb' }}
                  />
                  <span>300 API Requests/hour</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check
                    className="h-5 w-5 flex-shrink-0"
                    style={{ color: '#2563eb' }}
                  />
                  <span>All notification types (Email, Push, SMS)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check
                    className="h-5 w-5 flex-shrink-0"
                    style={{ color: '#2563eb' }}
                  />
                  <span>Priority chart updates (30s)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check
                    className="h-5 w-5 flex-shrink-0"
                    style={{ color: '#2563eb' }}
                  />
                  <span className="flex items-center gap-2 flex-wrap">
                    Advanced analytics
                    <Badge variant="outline" className="text-xs">
                      SOON
                    </Badge>
                  </span>
                </li>
              </ul>
            </CardContent>

            <CardFooter className="flex flex-col gap-2">
              <Button
                className="w-full py-6 text-lg animate-pulse text-white"
                style={{ backgroundColor: '#2563eb' }}
              >
                Start 7-Day Trial {affiliateCode && `(${discountPercent}% Off)`}
              </Button>
              <p
                className={`text-center text-sm ${affiliateCode ? '' : 'text-muted-foreground'}`}
                style={affiliateCode ? { color: '#16a34a' } : {}}
              >
                7-day free trial, then $
                {affiliateCode ? discountedPrice.toFixed(2) : regularPrice}
                /month
                {affiliateCode && ' with affiliate code'}
              </p>
            </CardFooter>
          </Card>
        </div>

        {/* Affiliate Program Banner */}
        <div
          className="border-2 rounded-xl p-6 mb-12 max-w-4xl mx-auto"
          style={{
            backgroundColor: 'oklch(0.96 0.04 160)',
            borderColor: '#86efac',
          }}
        >
          <div className="flex flex-col md:flex-row items-center gap-4">
            <span className="text-3xl">🤝</span>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl font-bold mb-2">
                Have an affiliate code?
              </h3>
              <p className="text-foreground/80 mb-4">
                Get {discountPercent}% off your next PRO subscription payment
                with a referral code from our partners. New codes available
                monthly!
              </p>
              <a
                href="/affiliate"
                className="font-medium"
                style={{ color: '#2563eb' }}
              >
                Learn about our Affiliate Program →
              </a>
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">
            Detailed Feature Comparison
          </h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 bg-muted/50">
                  <th className="p-4 text-left font-semibold">Feature</th>
                  <th className="p-4 text-center font-semibold">FREE</th>
                  <th className="p-4 text-center font-semibold">PRO</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-muted/50 transition-colors">
                  <td className="p-4">Symbols</td>
                  <td className="p-4 text-center">5</td>
                  <td className="p-4 text-center">15</td>
                </tr>
                <tr className="border-b bg-muted/30 hover:bg-muted/50 transition-colors">
                  <td className="p-4">Timeframes</td>
                  <td className="p-4 text-center">3 (H1, H4, D1)</td>
                  <td className="p-4 text-center">9 (M5-D1)</td>
                </tr>
                <tr className="border-b hover:bg-muted/50 transition-colors">
                  <td className="p-4">Active Alerts</td>
                  <td className="p-4 text-center">5</td>
                  <td className="p-4 text-center">20</td>
                </tr>
                <tr className="border-b bg-muted/30 hover:bg-muted/50 transition-colors">
                  <td className="p-4">Watchlist Items</td>
                  <td className="p-4 text-center">5</td>
                  <td className="p-4 text-center">50</td>
                </tr>
                <tr className="border-b hover:bg-muted/50 transition-colors">
                  <td className="p-4">API Requests/hour</td>
                  <td className="p-4 text-center">60</td>
                  <td className="p-4 text-center">300</td>
                </tr>
                <tr className="border-b bg-muted/30 hover:bg-muted/50 transition-colors">
                  <td className="p-4">Chart Updates</td>
                  <td className="p-4 text-center">60 seconds</td>
                  <td className="p-4 text-center">30 seconds</td>
                </tr>
                <tr className="border-b hover:bg-muted/50 transition-colors">
                  <td className="p-4">Email Notifications</td>
                  <td className="p-4 text-center">✅</td>
                  <td className="p-4 text-center">✅</td>
                </tr>
                <tr className="border-b bg-muted/30 hover:bg-muted/50 transition-colors">
                  <td className="p-4">Push Notifications</td>
                  <td className="p-4 text-center">✅</td>
                  <td className="p-4 text-center">✅</td>
                </tr>
                <tr className="border-b hover:bg-muted/50 transition-colors">
                  <td className="p-4">SMS Notifications</td>
                  <td className="p-4 text-center">❌</td>
                  <td className="p-4 text-center">✅</td>
                </tr>
                <tr className="border-b bg-muted/30 hover:bg-muted/50 transition-colors">
                  <td className="p-4">Priority Support</td>
                  <td className="p-4 text-center">❌</td>
                  <td className="p-4 text-center">✅</td>
                </tr>
                <tr className="border-b hover:bg-muted/50 transition-colors">
                  <td className="p-4">Advanced Analytics</td>
                  <td className="p-4 text-center">❌</td>
                  <td className="p-4 text-center">Coming Soon</td>
                </tr>
                <tr className="border-b bg-muted/30 hover:bg-muted/50 transition-colors">
                  <td className="p-4">Affiliate Discount Eligible</td>
                  <td className="p-4 text-center">❌</td>
                  <td className="p-4 text-center">
                    ✅ {discountPercent}% off with referral code
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mb-16 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            <details className="group rounded-lg bg-muted/30 overflow-hidden">
              <summary className="flex cursor-pointer items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <h3 className="font-medium">Can I switch plans at any time?</h3>
                <span className="ml-1.5 flex-shrink-0">
                  <svg
                    className="h-5 w-5 transition-transform group-open:rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </span>
              </summary>
              <p className="px-4 pb-4 text-muted-foreground">
                Yes! You can upgrade from Free to Pro at any time. If you're on
                the Pro plan, you can cancel at the end of your billing period
                to downgrade to Free.
              </p>
            </details>

            <details className="group rounded-lg bg-muted/30 overflow-hidden">
              <summary className="flex cursor-pointer items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <h3 className="font-medium">
                  What happens after the 7-day trial?
                </h3>
                <span className="ml-1.5 flex-shrink-0">
                  <svg
                    className="h-5 w-5 transition-transform group-open:rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </span>
              </summary>
              <p className="px-4 pb-4 text-muted-foreground">
                After your 7-day Pro trial ends, you'll be automatically charged
                $29/month unless you cancel before the trial period expires. You
                can cancel anytime during the trial with no charges.
              </p>
            </details>

            <details className="group rounded-lg bg-muted/30 overflow-hidden">
              <summary className="flex cursor-pointer items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <h3 className="font-medium">Do you offer refunds?</h3>
                <span className="ml-1.5 flex-shrink-0">
                  <svg
                    className="h-5 w-5 transition-transform group-open:rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </span>
              </summary>
              <p className="px-4 pb-4 text-muted-foreground">
                Yes, we offer a 30-day money-back guarantee for all Pro
                subscriptions. If you're not satisfied with the service, contact
                our support team within 30 days of your purchase for a full
                refund.
              </p>
            </details>

            <details className="group rounded-lg bg-muted/30 overflow-hidden">
              <summary className="flex cursor-pointer items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <h3 className="font-medium">What is the affiliate discount?</h3>
                <span className="ml-1.5 flex-shrink-0">
                  <svg
                    className="h-5 w-5 transition-transform group-open:rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </span>
              </summary>
              <p className="px-4 pb-4 text-muted-foreground">
                When you use an affiliate referral code during checkout, you'll
                receive {discountPercent}% off that month's PRO subscription
                payment (price drops from ${regularPrice} to $
                {discountedPrice.toFixed(2)}). This is a one-time discount per
                code. To get the discount again next month, you'll need to find
                and apply a new code before your renewal date. Affiliates post
                fresh codes on social media monthly!
              </p>
            </details>

            <details className="group rounded-lg bg-muted/30 overflow-hidden">
              <summary className="flex cursor-pointer items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <h3 className="font-medium">
                  Why don't you offer annual subscriptions?
                </h3>
                <span className="ml-1.5 flex-shrink-0">
                  <svg
                    className="h-5 w-5 transition-transform group-open:rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </span>
              </summary>
              <p className="px-4 pb-4 text-muted-foreground">
                We're currently in our early stage and actively developing new
                features based on user feedback. We offer monthly subscriptions
                to give you the flexibility to adjust as we grow. Annual plans
                will be introduced once our feature set is stable and mature
                (estimated 6-12 months).
              </p>
            </details>
          </div>
        </div>

        {/* Final CTA */}
        <div
          className="rounded-xl p-12 text-center"
          style={{ backgroundColor: 'oklch(0.96 0.02 240)' }}
        >
          <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of traders using our platform
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button
              className="px-8 py-6 text-lg text-white"
              style={{ backgroundColor: '#16a34a' }}
            >
              Start Free
            </Button>
            <Button
              variant="outline"
              className="border-2 px-8 py-6 text-lg"
              style={{ borderColor: '#2563eb' }}
            >
              Contact Sales
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
            <p className="mt-4 text-muted-foreground">Loading pricing...</p>
          </div>
        </div>
      }
    >
      <PricingPageContent />
    </Suspense>
  );
}
