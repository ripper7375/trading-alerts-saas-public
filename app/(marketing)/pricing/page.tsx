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
import {
  DLOCAL_SUPPORTED_COUNTRIES,
  COUNTRY_NAMES,
  PRICING,
} from '@/lib/dlocal/constants';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';
import type { DLocalCountry } from '@/types/dlocal';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Note: PRO_PRICE and DISCOUNT_PERCENT are now fetched from SystemConfig via useAffiliateConfig hook

const FREE_TIER = {
  name: 'FREE',
  price: 0,
  description: 'Perfect for getting started',
  features: [
    { name: 'XAUUSD (Gold)', detail: 'The only symbol you need' },
    { name: 'M5 & M15 Timeframes', detail: 'Scalping and intraday' },
    { name: 'Full Market Data', detail: 'Same indicator data as PRO' },
    { name: '60 API Requests/hour', detail: null },
  ],
  buttonText: 'Start Free',
  popular: false,
};

const PRO_TIER = {
  name: 'PRO',
  description: 'For serious traders',
  features: [
    { name: '100 Active Alerts', detail: 'Price alerts on XAUUSD M5/M15' },
    {
      name: 'Drawing Engine Line Alerts',
      detail: 'Draw a line, get alerted when price touches it',
    },
    {
      name: 'Multi-Timeframe Visualization',
      detail: 'Overlay M5 structure on M15 charts',
    },
    { name: 'All Notification Types', detail: 'Email, Push, SMS' },
    { name: '300 API Requests/hour', detail: null },
    { name: 'Priority Chart Updates', detail: '30s refresh rate' },
    { name: 'Priority Support', detail: null },
  ],
  buttonText: 'Start 7-Day Trial',
  popular: true,
};

const COMPARISON_FEATURES = [
  { name: 'Symbol', free: 'XAUUSD', pro: 'XAUUSD' },
  { name: 'Timeframes', free: 'M5, M15', pro: 'M5, M15' },
  { name: 'Market Data & Indicators', free: 'Full access', pro: 'Full access' },
  { name: 'Active Alerts', free: '0', pro: '100' },
  { name: 'Drawing Engine Line Alerts', free: false, pro: true },
  { name: 'Multi-Timeframe Visualization', free: false, pro: true },
  { name: 'API Requests/hour', free: '60', pro: '300' },
  { name: 'Chart Updates', free: '60 seconds', pro: '30 seconds' },
  { name: 'Email Notifications', free: false, pro: true },
  { name: 'Push Notifications', free: false, pro: true },
  { name: 'SMS Notifications', free: false, pro: true },
  { name: 'Priority Support', free: false, pro: true },
];

// FAQ items - discountPercent will be injected dynamically in the component
const FAQ_ITEMS_TEMPLATE = [
  {
    question: 'Can I switch plans at any time?',
    answer:
      "Yes! You can upgrade from Free to Pro at any time. If you're on the Pro plan, you can cancel at the end of your billing period to downgrade to Free.",
  },
  {
    question: 'What happens after the 7-day trial?',
    answerTemplate: (proPrice: number) =>
      `After your 7-day Pro trial ends, you'll be automatically charged $${proPrice}/month unless you cancel before the trial period expires. You can cancel anytime during the trial with no charges.`,
  },
  {
    question: 'Do you offer refunds?',
    answer:
      "Yes, we offer a 30-day money-back guarantee for all Pro subscriptions. If you're not satisfied with the service, contact our support team within 30 days of your purchase for a full refund.",
  },
  {
    question: 'What is the affiliate discount?',
    answerTemplate: (discountPercent: number) =>
      `When you use an affiliate referral code during checkout, you'll receive ${discountPercent}% off your PRO subscription payment. This is applied automatically when you use a valid referral link.`,
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
  const [detectedCountry, setDetectedCountry] = useState<DLocalCountry | null>(
    null
  );
  const [canUseThreeDayPlan, setCanUseThreeDayPlan] = useState(false);
  const [threeDayEligibilityChecked, setThreeDayEligibilityChecked] =
    useState(false);

  // Get dynamic affiliate config from SystemConfig
  const {
    discountPercent,
    regularPrice: PRO_PRICE,
    calculateDiscountedPrice,
  } = useAffiliateConfig();

  // Get affiliate code from URL
  const affiliateCode = searchParams.get('ref');

  // Detect user country for dLocal support
  useEffect(() => {
    const detectCountry = async (): Promise<void> => {
      try {
        const res = await fetch('/api/geo/detect');
        if (res.ok) {
          const data = await res.json();
          if (
            data.country &&
            DLOCAL_SUPPORTED_COUNTRIES.includes(data.country)
          ) {
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
        const res = await fetch(
          '/api/payments/dlocal/check-three-day-eligibility'
        );
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

  // Calculate discounted price if affiliate code exists using SystemConfig values
  const discountedPrice = affiliateCode
    ? calculateDiscountedPrice(PRO_PRICE)
    : PRO_PRICE;
  const savings = PRO_PRICE - discountedPrice;

  // Build FAQ items with dynamic values
  const FAQ_ITEMS = FAQ_ITEMS_TEMPLATE.map((item) => ({
    question: item.question,
    answer:
      'answerTemplate' in item
        ? (item.answerTemplate as (val: number) => string)(
            item.question.includes('affiliate') ? discountPercent : PRO_PRICE
          )
        : item.answer,
  }));

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

  // Already PRO / Admin notification
  if (userTier === 'PRO' || session?.user?.role === 'ADMIN') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-lg">
          <Card className="p-8 text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <Check className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              You&apos;re Already a PRO Member
            </h1>
            <p className="mt-2 text-muted-foreground">
              Your account currently has active access to all PRO features,
              indicators, drawing engine alerts, and real-time streams.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild variant="outline">
                <Link href="/settings/billing">Manage Subscription</Link>
              </Button>
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <Link
                  href={
                    session?.user?.role === 'ADMIN' ? '/admin' : '/dashboard'
                  }
                >
                  Go to Dashboard
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Breadcrumb */}
        <nav className="mb-8 text-sm text-muted-foreground">
          Home &gt; Pricing
        </nav>

        {/* Header */}
        <div className="mb-16 text-center">
          <h1 className="mb-4 text-5xl font-bold text-foreground">
            Choose Your Plan
          </h1>
          <p className="text-xl text-muted-foreground">
            Start free, upgrade when you need more
          </p>
        </div>

        {/* dLocal 3-Day Trial Banner for supported countries */}
        {isDLocalCountry &&
          canUseThreeDayPlan &&
          threeDayEligibilityChecked && (
            <div className="mx-auto mb-8 max-w-4xl">
              <Card className="border-2 border-purple-500 bg-gradient-to-r from-purple-50 to-blue-50">
                <CardContent className="p-6">
                  <div className="flex flex-col items-center gap-6 md:flex-row">
                    <div className="flex-shrink-0">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
                        <Clock className="h-8 w-8 text-purple-600" />
                      </div>
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <Badge className="mb-2 bg-purple-600 text-white">
                        One-Time Offer for {COUNTRY_NAMES[detectedCountry]}
                      </Badge>
                      <h3 className="mb-2 text-2xl font-bold">
                        Try PRO for Just ${PRICING.THREE_DAY_USD}
                      </h3>
                      <p className="mb-4 text-muted-foreground">
                        Get 3 days of full PRO access to test all features
                        before committing. Pay with local payment methods like{' '}
                        {detectedCountry === 'IN' && 'UPI, Paytm, PhonePe'}
                        {detectedCountry === 'NG' && 'Bank Transfer, Paystack'}
                        {detectedCountry === 'ID' && 'GoPay, OVO, Dana'}
                        {detectedCountry === 'TH' && 'TrueMoney, Thai QR'}
                        {!['IN', 'NG', 'ID', 'TH'].includes(detectedCountry) &&
                          'local wallets'}
                        .
                      </p>
                      <Link
                        href={`/checkout?country=${detectedCountry}&plan=THREE_DAY`}
                      >
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
        <div
          className={`mx-auto mb-16 grid max-w-5xl gap-8 ${isDLocalCountry ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}
        >
          {/* FREE TIER */}
          <Card className="flex flex-col">
            <CardHeader>
              <Badge className="w-fit bg-green-500 text-white">FREE TIER</Badge>
              <CardTitle className="mt-4 flex items-baseline gap-2">
                <span className="text-6xl font-bold">$0</span>
                <span className="text-xl text-muted-foreground">/month</span>
              </CardTitle>
              <p className="text-muted-foreground">{FREE_TIER.description}</p>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-3">
                {FREE_TIER.features.map((feature) => (
                  <li key={feature.name} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
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
                className="w-full bg-green-600 py-6 text-lg hover:bg-green-700"
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
            <div className="absolute right-0 top-0 rounded-bl-lg bg-blue-600 px-4 py-1 text-sm font-medium text-white">
              MOST POPULAR
            </div>

            <CardHeader className="pt-12">
              <Badge className="w-fit bg-blue-600 text-white">PRO TIER</Badge>

              {/* Affiliate Discount Banner */}
              {affiliateCode && (
                <div className="mt-4 rounded-lg border-l-4 border-yellow-400 bg-yellow-50 p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-xl">🎉</span>
                    <div className="flex-1">
                      <div className="font-semibold text-yellow-800">
                        Affiliate Discount Active!
                      </div>
                      <div className="text-sm text-yellow-700">
                        {discountPercent}% off applied with code:{' '}
                        <span className="font-mono font-bold">
                          {affiliateCode}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Price Display */}
              <CardTitle className="mt-4 flex flex-wrap items-baseline gap-2">
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
                <p className="mt-2 text-sm font-medium text-green-600">
                  Save ${savings.toFixed(2)}/month with affiliate code!
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  {PRO_TIER.description}
                </p>
              )}
            </CardHeader>

            <CardContent className="flex-1">
              <ul className="space-y-3">
                {PRO_TIER.features.map((feature) => (
                  <li key={feature.name} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
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
                className="w-full bg-blue-600 py-6 text-lg hover:bg-blue-700"
                onClick={handleUpgrade}
                disabled={isLoading}
              >
                {isLoading
                  ? 'Loading...'
                  : `${PRO_TIER.buttonText}${affiliateCode ? ` (${discountPercent}% Off)` : ''}`}
              </Button>
              <p
                className={`text-center text-sm ${affiliateCode ? 'text-green-600' : 'text-muted-foreground'}`}
              >
                7-day free trial, then $
                {affiliateCode ? discountedPrice.toFixed(2) : PRO_PRICE}/month
              </p>
              {/* dLocal option for supported countries */}
              {isDLocalCountry && (
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
                  <Badge className="w-fit bg-purple-600 text-white">
                    LOCAL PAYMENTS
                  </Badge>
                  <Globe className="h-4 w-4 text-purple-600" />
                </div>
                <CardTitle className="mt-4 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-purple-600">
                    ${PRO_PRICE}
                  </span>
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
                        <Check className="h-4 w-4 text-purple-600" /> Net
                        Banking
                      </li>
                    </>
                  )}
                  {detectedCountry === 'NG' && (
                    <>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-purple-600" /> Bank
                        Transfer
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
                      <Check className="h-4 w-4 text-purple-600" /> Local
                      payment methods
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
                  <Button className="w-full bg-purple-600 py-6 text-lg hover:bg-purple-700">
                    Pay with Local Methods
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
        <div className="mx-auto mb-12 max-w-4xl rounded-xl border-2 border-green-300 bg-green-50 p-6">
          <div className="flex flex-col items-center gap-4 md:flex-row">
            <span className="text-3xl">🤝</span>
            <div className="flex-1 text-center md:text-left">
              <h3 className="mb-2 text-2xl font-bold">
                Have an affiliate code?
              </h3>
              <p className="text-foreground/80 mb-4">
                Get {discountPercent}% off your PRO subscription payment with a
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
          <h2 className="mb-8 text-center text-3xl font-bold">
            Detailed Feature Comparison
          </h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b-2">
                  <th className="p-4 text-left font-semibold">Feature</th>
                  <th className="p-4 text-center font-semibold">FREE</th>
                  <th className="p-4 text-center font-semibold">PRO</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_FEATURES.map((feature, index) => (
                  <tr
                    key={feature.name}
                    className={`hover:bg-muted/50 border-b transition-colors ${
                      index % 2 === 1 ? 'bg-muted/30' : ''
                    }`}
                  >
                    <td className="p-4">{feature.name}</td>
                    <td className="p-4 text-center">
                      {typeof feature.free === 'boolean' ? (
                        feature.free ? (
                          <Check className="mx-auto h-5 w-5 text-green-600" />
                        ) : (
                          <X className="mx-auto h-5 w-5 text-red-500" />
                        )
                      ) : (
                        feature.free
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {typeof feature.pro === 'boolean' ? (
                        feature.pro ? (
                          <Check className="mx-auto h-5 w-5 text-green-600" />
                        ) : (
                          <X className="mx-auto h-5 w-5 text-red-500" />
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
        <div className="mx-auto mb-16 max-w-3xl">
          <h2 className="mb-8 text-center text-3xl font-bold">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.question}
                className="bg-muted/30 group overflow-hidden rounded-lg"
              >
                <summary className="hover:bg-muted/50 flex cursor-pointer items-center justify-between p-4 transition-colors">
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
        <div className="bg-muted/50 rounded-xl p-12 text-center">
          <h2 className="mb-4 text-3xl font-bold">Ready to get started?</h2>
          <p className="mb-8 text-xl text-muted-foreground">
            Join thousands of traders using our platform
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              className="bg-green-600 px-8 py-6 text-lg hover:bg-green-700"
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
        <div className="flex min-h-screen items-center justify-center">
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
