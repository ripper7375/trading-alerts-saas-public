'use client';

/**
 * Pricing Page
 *
 * Displays FREE vs PRO tier comparison with:
 * - Pricing cards with feature lists
 * - Affiliate code support (?ref=CODE)
 * - Detailed feature comparison table
 * - FAQ section
 * - CTA buttons for signup/upgrade
 *
 * @module app/(marketing)/pricing/page
 */

import { Check, X, Globe, Clock } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { DLOCAL_SUPPORTED_COUNTRIES, COUNTRY_NAMES, PRICING } from '@/lib/dlocal/constants';
import type { DLocalCountry } from '@/types/dlocal';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PRO_PRICE = 29;
const DISCOUNT_PERCENT = 10; // Default affiliate discount

const FREE_TIER = {
  name: 'FREE',
  price: 0,
  description: 'Perfect for getting started',
  features: [
    { name: '5 Symbols', detail: 'BTCUSD, EURUSD, USDJPY, US30, XAUUSD' },
    { name: '3 Timeframes', detail: 'H1, H4, D1 only' },
    { name: '5 Active Alerts', detail: null },
    { name: '5 Watchlist Items', detail: null },
    { name: '60 API Requests/hour', detail: null },
    { name: 'Email & Push Notifications', detail: null },
  ],
  buttonText: 'Start Free',
  popular: false,
};

const PRO_TIER = {
  name: 'PRO',
  price: PRO_PRICE,
  description: 'For serious traders',
  features: [
    { name: '15 Symbols', detail: 'All major pairs + crypto + indices' },
    { name: '9 Timeframes', detail: 'M5, M15, M30, H1, H2, H4, H8, H12, D1' },
    { name: '20 Active Alerts', detail: null },
    { name: '50 Watchlist Items', detail: null },
    { name: '300 API Requests/hour', detail: null },
    { name: 'All Notification Types', detail: 'Email, Push, SMS' },
    { name: 'Priority Chart Updates', detail: '30s refresh rate' },
    { name: 'Priority Support', detail: null },
  ],
  buttonText: 'Start 7-Day Trial',
  popular: true,
};

const COMPARISON_FEATURES = [
  { name: 'Symbols', free: '5', pro: '15' },
  { name: 'Timeframes', free: '3 (H1, H4, D1)', pro: '9 (M5-D1)' },
  { name: 'Active Alerts', free: '5', pro: '20' },
  { name: 'Watchlist Items', free: '5', pro: '50' },
  { name: 'API Requests/hour', free: '60', pro: '300' },
  { name: 'Chart Updates', free: '60 seconds', pro: '30 seconds' },
  { name: 'Email Notifications', free: true, pro: true },
  { name: 'Push Notifications', free: true, pro: true },
  { name: 'SMS Notifications', free: false, pro: true },
  { name: 'Priority Support', free: false, pro: true },
];

const FAQ_ITEMS = [
  {
    question: 'Can I switch plans at any time?',
    answer:
      "Yes! You can upgrade from Free to Pro at any time. If you're on the Pro plan, you can cancel at the end of your billing period to downgrade to Free.",
  },
  {
    question: 'What happens after the 7-day trial?',
    answer:
      "After your 7-day Pro trial ends, you'll be automatically charged $29/month unless you cancel before the trial period expires. You can cancel anytime during the trial with no charges.",
  },
  {
    question: 'Do you offer refunds?',
    answer:
      "Yes, we offer a 30-day money-back guarantee for all Pro subscriptions. If you're not satisfied with the service, contact our support team within 30 days of your purchase for a full refund.",
  },
  {
    question: 'What is the affiliate discount?',
    answer: `When you use an affiliate referral code during checkout, you'll receive ${DISCOUNT_PERCENT}% off your PRO subscription payment. This is applied automatically when you use a valid referral link.`,
  },
  {
    question: "Why don't you offer annual subscriptions?",
    answer:
      "We're currently in our early stage and actively developing new features based on user feedback. We offer monthly subscriptions to give you the flexibility to adjust as we grow. Annual plans will be introduced once our feature set is stable.",
  },
];

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRICING PAGE CONTENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function PricingPageContent(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [detectedCountry, setDetectedCountry] = useState<DLocalCountry | null>(null);
  const [canUseThreeDayPlan, setCanUseThreeDayPlan] = useState(false);
  const [threeDayEligibilityChecked, setThreeDayEligibilityChecked] = useState(false);

  // Get affiliate code from URL
  const affiliateCode = searchParams.get('ref');

  // Detect user country for dLocal support
  useEffect(() => {
    const detectCountry = async (): Promise<void> => {
      try {
        const res = await fetch('/api/geo/detect');
        if (res.ok) {
          const data = await res.json();
          if (data.country && DLOCAL_SUPPORTED_COUNTRIES.includes(data.country)) {
            setDetectedCountry(data.country as DLocalCountry);
          }
        }
      } catch (error) {
        console.error('Country detection failed:', error);
      }
    };
    detectCountry();
  }, []);

  // Check 3-day plan eligibility
  useEffect(() => {
    const checkEligibility = async (): Promise<void> => {
      if (!session?.user?.id || !detectedCountry) {
        setThreeDayEligibilityChecked(true);
        return;
      }

      try {
        const res = await fetch('/api/payments/dlocal/check-three-day-eligibility');
        if (res.ok) {
          const data = await res.json();
          setCanUseThreeDayPlan(data.eligible === true);
        }
      } catch (error) {
        console.error('Eligibility check failed:', error);
      } finally {
        setThreeDayEligibilityChecked(true);
      }
    };
    checkEligibility();
  }, [session?.user?.id, detectedCountry]);

  const isDLocalCountry = detectedCountry !== null;

  // Calculate discounted price if affiliate code exists
  const discountedPrice = affiliateCode
    ? PRO_PRICE * (1 - DISCOUNT_PERCENT / 100)
    : PRO_PRICE;
  const savings = PRO_PRICE - discountedPrice;

  // Check user's current tier
  const userTier = session?.user?.tier || 'FREE';
  const isAuthenticated = status === 'authenticated';

  /**
   * Handle upgrade button click
   */
  const handleUpgrade = async (): Promise<void> => {
    if (!isAuthenticated) {
      // Redirect to login with return URL
      router.push('/login?callbackUrl=/pricing');
      return;
    }

    if (userTier === 'PRO') {
      // Already PRO, go to dashboard
      router.push('/dashboard');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateCode }),
      });

      const data = await response.json();

      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        console.error('No checkout URL received:', data);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setIsLoading(false);
    }
  };

  /**
   * Handle free signup button click
   */
  const handleFreeSignup = (): void => {
    if (isAuthenticated) {
      router.push('/dashboard');
    } else {
      router.push('/register');
    }
  };

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

        {/* dLocal 3-Day Trial Banner for supported countries */}
        {isDLocalCountry && canUseThreeDayPlan && threeDayEligibilityChecked && (
          <div className="mx-auto mb-8 max-w-4xl">
            <Card className="border-2 border-purple-500 bg-gradient-to-r from-purple-50 to-blue-50">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="flex-shrink-0">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
                      <Clock className="h-8 w-8 text-purple-600" />
                    </div>
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <Badge className="mb-2 bg-purple-600 text-white">
                      One-Time Offer for {COUNTRY_NAMES[detectedCountry]}
                    </Badge>
                    <h3 className="text-2xl font-bold mb-2">Try PRO for Just ${PRICING.THREE_DAY_USD}</h3>
                    <p className="text-muted-foreground mb-4">
                      Get 3 days of full PRO access to test all features before committing.
                      Pay with local payment methods like{' '}
                      {detectedCountry === 'IN' && 'UPI, Paytm, PhonePe'}
                      {detectedCountry === 'NG' && 'Bank Transfer, Paystack'}
                      {detectedCountry === 'ID' && 'GoPay, OVO, Dana'}
                      {detectedCountry === 'TH' && 'TrueMoney, Thai QR'}
                      {!['IN', 'NG', 'ID', 'TH'].includes(detectedCountry) && 'local wallets'}.
                    </p>
                    <Link href={`/checkout?country=${detectedCountry}&plan=THREE_DAY`}>
                      <Button className="bg-purple-600 hover:bg-purple-700">
                        <Globe className="mr-2 h-4 w-4" />
                        Start 3-Day Trial - ${PRICING.THREE_DAY_USD}
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pricing Cards */}
        <div className={`mx-auto mb-16 grid max-w-5xl gap-8 ${isDLocalCountry ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          {/* FREE TIER */}
          <Card className="flex flex-col">
            <CardHeader>
              <Badge className="w-fit bg-green-500 text-white">FREE TIER</Badge>
              <CardTitle className="flex items-baseline gap-2 mt-4">
                <span className="text-6xl font-bold">$0</span>
                <span className="text-xl text-muted-foreground">/month</span>
              </CardTitle>
              <p className="text-muted-foreground">{FREE_TIER.description}</p>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-3">
                {FREE_TIER.features.map((feature) => (
                  <li key={feature.name} className="flex items-start gap-2">
                    <Check className="h-5 w-5 mt-0.5 flex-shrink-0 text-green-500" />
                    <div>
                      <div className="font-medium">{feature.name}</div>
                      {feature.detail && (
                        <div className="text-sm text-muted-foreground">
                          {feature.detail}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button
                className="w-full py-6 text-lg bg-green-600 hover:bg-green-700"
                onClick={handleFreeSignup}
              >
                {isAuthenticated && userTier === 'FREE'
                  ? 'Current Plan'
                  : FREE_TIER.buttonText}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                No credit card required
              </p>
            </CardFooter>
          </Card>

          {/* PRO TIER */}
          <Card className="relative flex flex-col border-4 border-blue-600">
            {/* Most Popular Ribbon */}
            <div className="absolute top-0 right-0 bg-blue-600 text-white px-4 py-1 rounded-bl-lg text-sm font-medium">
              MOST POPULAR
            </div>

            <CardHeader className="pt-12">
              <Badge className="w-fit bg-blue-600 text-white">PRO TIER</Badge>

              {/* Affiliate Discount Banner */}
              {affiliateCode && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mt-4 rounded-lg">
                  <div className="flex items-start gap-2">
                    <span className="text-xl">🎉</span>
                    <div className="flex-1">
                      <div className="font-semibold text-yellow-800">
                        Affiliate Discount Active!
                      </div>
                      <div className="text-sm text-yellow-700">
                        {DISCOUNT_PERCENT}% off applied with code:{' '}
                        <span className="font-mono font-bold">
                          {affiliateCode}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Price Display */}
              <CardTitle className="flex flex-wrap items-baseline gap-2 mt-4">
                {affiliateCode && (
                  <span className="text-3xl text-muted-foreground line-through">
                    ${PRO_PRICE}
                  </span>
                )}
                <span
                  className={`text-6xl font-bold ${affiliateCode ? 'text-green-600' : ''}`}
                >
                  ${affiliateCode ? discountedPrice.toFixed(2) : PRO_PRICE}
                </span>
                <span className="text-xl text-muted-foreground">/month</span>
              </CardTitle>

              {affiliateCode ? (
                <p className="text-sm font-medium text-green-600 mt-2">
                  Save ${savings.toFixed(2)}/month with affiliate code!
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">
                  {PRO_TIER.description}
                </p>
              )}
            </CardHeader>

            <CardContent className="flex-1">
              <ul className="space-y-3">
                {PRO_TIER.features.map((feature) => (
                  <li key={feature.name} className="flex items-start gap-2">
                    <Check className="h-5 w-5 mt-0.5 flex-shrink-0 text-blue-600" />
                    <div>
                      <div className="font-medium">{feature.name}</div>
                      {feature.detail && (
                        <div className="text-sm text-muted-foreground">
                          {feature.detail}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter className="flex flex-col gap-2">
              <Button
                className="w-full py-6 text-lg bg-blue-600 hover:bg-blue-700"
                onClick={handleUpgrade}
                disabled={isLoading || userTier === 'PRO'}
              >
                {isLoading
                  ? 'Loading...'
                  : userTier === 'PRO'
                    ? 'Current Plan'
                    : `${PRO_TIER.buttonText}${affiliateCode ? ` (${DISCOUNT_PERCENT}% Off)` : ''}`}
              </Button>
              <p
                className={`text-center text-sm ${affiliateCode ? 'text-green-600' : 'text-muted-foreground'}`}
              >
                7-day free trial, then $
                {affiliateCode ? discountedPrice.toFixed(2) : PRO_PRICE}/month
              </p>
              {/* dLocal option for supported countries */}
              {isDLocalCountry && userTier !== 'PRO' && (
                <Link
                  href={`/checkout?country=${detectedCountry}&plan=MONTHLY${affiliateCode ? `&ref=${affiliateCode}` : ''}`}
                  className="mt-2 flex items-center justify-center gap-2 text-sm text-purple-600 hover:underline"
                >
                  <Globe className="h-4 w-4" />
                  Pay with local payment methods
                </Link>
              )}
            </CardFooter>
          </Card>

          {/* dLocal Monthly Card for supported countries */}
          {isDLocalCountry && (
            <Card className="flex flex-col border-2 border-purple-300">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge className="w-fit bg-purple-600 text-white">LOCAL PAYMENTS</Badge>
                  <Globe className="h-4 w-4 text-purple-600" />
                </div>
                <CardTitle className="flex items-baseline gap-2 mt-4">
                  <span className="text-4xl font-bold text-purple-600">${PRO_PRICE}</span>
                  <span className="text-lg text-muted-foreground">/month</span>
                </CardTitle>
                <p className="text-muted-foreground">
                  Pay in {COUNTRY_NAMES[detectedCountry]} with local methods
                </p>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="mb-4 text-sm text-muted-foreground">
                  All PRO features, paid with:
                </p>
                <ul className="space-y-2 text-sm">
                  {detectedCountry === 'IN' && (
                    <>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-purple-600" /> UPI
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-purple-600" /> Paytm
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-purple-600" /> PhonePe
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-purple-600" /> Net Banking
                      </li>
                    </>
                  )}
                  {detectedCountry === 'NG' && (
                    <>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-purple-600" /> Bank Transfer
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-purple-600" /> USSD
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-purple-600" /> Paystack
                      </li>
                    </>
                  )}
                  {detectedCountry === 'ID' && (
                    <>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-purple-600" /> GoPay
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-purple-600" /> OVO
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-purple-600" /> Dana
                      </li>
                    </>
                  )}
                  {!['IN', 'NG', 'ID'].includes(detectedCountry) && (
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-purple-600" /> Local payment methods
                    </li>
                  )}
                </ul>
                <p className="mt-4 text-xs text-muted-foreground">
                  Powered by dLocal. No international card fees.
                </p>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Link
                  href={`/checkout?country=${detectedCountry}&plan=MONTHLY`}
                  className="w-full"
                >
                  <Button
                    className="w-full py-6 text-lg bg-purple-600 hover:bg-purple-700"
                    disabled={userTier === 'PRO'}
                  >
                    {userTier === 'PRO' ? 'Current Plan' : 'Pay with Local Methods'}
                  </Button>
                </Link>
                <p className="text-center text-sm text-muted-foreground">
                  Manual renewal each month
                </p>
              </CardFooter>
            </Card>
          )}
        </div>

        {/* Affiliate Program Banner */}
        <div className="border-2 border-green-300 bg-green-50 rounded-xl p-6 mb-12 max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <span className="text-3xl">🤝</span>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl font-bold mb-2">
                Have an affiliate code?
              </h3>
              <p className="text-foreground/80 mb-4">
                Get {DISCOUNT_PERCENT}% off your PRO subscription payment with a
                referral code from our partners.
              </p>
              <a
                href="/affiliate"
                className="font-medium text-blue-600 hover:underline"
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
                {COMPARISON_FEATURES.map((feature, index) => (
                  <tr
                    key={feature.name}
                    className={`border-b hover:bg-muted/50 transition-colors ${
                      index % 2 === 1 ? 'bg-muted/30' : ''
                    }`}
                  >
                    <td className="p-4">{feature.name}</td>
                    <td className="p-4 text-center">
                      {typeof feature.free === 'boolean' ? (
                        feature.free ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-red-500 mx-auto" />
                        )
                      ) : (
                        feature.free
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {typeof feature.pro === 'boolean' ? (
                        feature.pro ? (
                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-red-500 mx-auto" />
                        )
                      ) : (
                        feature.pro
                      )}
                    </td>
                  </tr>
                ))}
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
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.question}
                className="group rounded-lg bg-muted/30 overflow-hidden"
              >
                <summary className="flex cursor-pointer items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <h3 className="font-medium">{item.question}</h3>
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
                <p className="px-4 pb-4 text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="rounded-xl bg-muted/50 p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of traders using our platform
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button
              className="px-8 py-6 text-lg bg-green-600 hover:bg-green-700"
              onClick={handleFreeSignup}
            >
              Start Free
            </Button>
            <Button
              variant="outline"
              className="border-2 border-blue-600 px-8 py-6 text-lg"
              onClick={handleUpgrade}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Start PRO Trial'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN EXPORT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Pricing Page Component
 *
 * Wrapped in Suspense for useSearchParams support
 */
export default function PricingPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
            <p className="mt-4 text-muted-foreground">Loading pricing...</p>
          </div>
        </div>
      }
    >
      <PricingPageContent />
    </Suspense>
  );
}
