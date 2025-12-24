'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

export default function LandingPageContent(): React.ReactElement {
  const searchParams = useSearchParams();
  const affiliateCode = searchParams.get('ref');

  // Get dynamic affiliate config from SystemConfig
  const { discountPercent, commissionPercent, regularPrice, calculateDiscountedPrice } = useAffiliateConfig();

  // Pricing calculation using SystemConfig values
  const discountedPrice = calculateDiscountedPrice(regularPrice);
  const proPriceDisplay = affiliateCode ? `$${discountedPrice.toFixed(2)}` : `$${regularPrice}`;
  const discount = affiliateCode ? `${discountPercent}% OFF` : null;
  const commissionAmount = discountedPrice * (commissionPercent / 100);

  return (
    <div className="flex flex-col">
      {/* Affiliate banner if code present */}
      {affiliateCode && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-4 text-center">
          <p className="text-sm">
            <span className="font-semibold">Special Offer!</span> Sign up with
            code{' '}
            <code className="bg-white/20 px-2 py-0.5 rounded font-mono text-xs">
              {affiliateCode}
            </code>{' '}
            and get <span className="font-bold">{discountPercent}% off your first month!</span>
          </p>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-20 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground mb-6 text-balance">
            Never Miss a{' '}
            <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
              Trading Setup
            </span>{' '}
            Again
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Get real-time alerts when price touches key support and resistance
            levels. Advanced fractal analysis for Gold, Forex, Crypto, and
            Indices.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-8 py-4 text-lg font-medium text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
            >
              Get Started Free
            </Link>
            <Link
              href="#pricing"
              className="inline-flex items-center justify-center rounded-lg border-2 border-border bg-background px-8 py-4 text-lg font-medium text-foreground transition-colors hover:bg-accent"
            >
              View Pricing
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            Trusted by 10,000+ traders worldwide
          </p>

          {/* Trading symbols preview */}
          <div className="mt-12 flex flex-wrap justify-center gap-4 text-muted-foreground">
            <span className="px-3 py-1 rounded-full border bg-card text-sm font-mono">
              XAUUSD
            </span>
            <span className="px-3 py-1 rounded-full border bg-card text-sm font-mono">
              EURUSD
            </span>
            <span className="px-3 py-1 rounded-full border bg-card text-sm font-mono">
              BTCUSD
            </span>
            <span className="px-3 py-1 rounded-full border bg-card text-sm font-mono">
              NDX100
            </span>
            <span className="px-3 py-1 rounded-full border bg-card text-sm font-mono">
              +6 more
            </span>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Professional Trading Tools
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to stay ahead of the market
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-card rounded-xl border p-8 shadow-sm transition-shadow hover:shadow-md">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Real-time Fractal Analysis
              </h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Horizontal Support/Resistance
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Diagonal Trendlines
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Multi-point Validation
                </li>
              </ul>
            </div>

            {/* Feature 2 */}
            <div className="bg-card rounded-xl border p-8 shadow-sm transition-shadow hover:shadow-md">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Smart Alert System
              </h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Price Proximity Alerts
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Email & Push Notifications
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Customizable Conditions
                </li>
              </ul>
            </div>

            {/* Feature 3 */}
            <div className="bg-card rounded-xl border p-8 shadow-sm transition-shadow hover:shadow-md">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Multiple Markets
              </h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  10 Major Symbols
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>7 Timeframe Options
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Watchlist Management
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Start free, upgrade when you need more
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Tier */}
            <div className="bg-card rounded-xl border p-8">
              <div className="mb-4">
                <span className="inline-block px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-medium">
                  FREE
                </span>
              </div>
              <div className="mb-6">
                <span className="text-5xl font-bold text-foreground">$0</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-muted-foreground">
                  <svg
                    className="w-5 h-5 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  1 Symbol (XAUUSD)
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <svg
                    className="w-5 h-5 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  All 7 Timeframes
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <svg
                    className="w-5 h-5 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  5 Alerts
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <svg
                    className="w-5 h-5 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  3 Watchlists
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <svg
                    className="w-5 h-5 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Email Alerts
                </li>
              </ul>
              <Link
                href="/register"
                className="block w-full text-center rounded-lg border-2 border-border px-4 py-3 font-medium text-foreground transition-colors hover:bg-accent"
              >
                Start Free
              </Link>
            </div>

            {/* Pro Tier */}
            <div className="bg-card rounded-xl border-2 border-primary p-8 relative">
              <div className="absolute -top-3 right-4">
                <span className="inline-block px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                  Most Popular
                </span>
              </div>
              {discount && (
                <div className="absolute -top-3 left-4">
                  <span className="inline-block px-3 py-1 rounded-full bg-green-500 text-white text-xs font-bold animate-pulse">
                    {discount}
                  </span>
                </div>
              )}
              <div className="mb-4 mt-2">
                <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  PRO
                </span>
              </div>
              <div className="mb-6">
                <span className="text-5xl font-bold text-foreground">
                  {proPriceDisplay}
                </span>
                <span className="text-muted-foreground">/month</span>
                {affiliateCode && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Regular price: ${regularPrice}/month
                  </p>
                )}
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-muted-foreground">
                  <svg
                    className="w-5 h-5 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  All 10 Symbols
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <svg
                    className="w-5 h-5 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  All 7 Timeframes
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <svg
                    className="w-5 h-5 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  20 Alerts
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <svg
                    className="w-5 h-5 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  10 Watchlists (50 items each)
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <svg
                    className="w-5 h-5 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Push Notifications
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <svg
                    className="w-5 h-5 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Priority Support
                </li>
              </ul>
              <Link
                href={
                  affiliateCode ? `/register?ref=${affiliateCode}` : '/register'
                }
                className="block w-full text-center rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Start 7-Day Free Trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Affiliate Section */}
      <section
        id="affiliate"
        className="py-20 px-4 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5"
      >
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Become an Affiliate Partner
          </h2>
          <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
            Earn {commissionPercent}% commission for every PRO subscriber you refer. No approval
            required.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💰</span>
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                Generous Commissions
              </h3>
              <p className="text-sm text-muted-foreground">
                Earn ${commissionAmount.toFixed(2)} per month for each referral
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔗</span>
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                Easy Sharing
              </h3>
              <p className="text-sm text-muted-foreground">
                Get your unique code and share anywhere
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                Track Performance
              </h3>
              <p className="text-sm text-muted-foreground">
                Real-time dashboard for your earnings
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-8 mb-12 text-center">
            <div>
              <div className="text-3xl font-bold text-primary">500+</div>
              <div className="text-sm text-muted-foreground">
                Active Affiliates
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-500">$50K+</div>
              <div className="text-sm text-muted-foreground">Paid Out</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary">Monthly</div>
              <div className="text-sm text-muted-foreground">Payouts</div>
            </div>
          </div>

          <Link
            href="/affiliate/register"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-8 py-4 text-lg font-medium text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
          >
            Join Affiliate Program
          </Link>
        </div>
      </section>
    </div>
  );
}
