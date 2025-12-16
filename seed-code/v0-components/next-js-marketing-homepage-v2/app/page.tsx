'use client';

import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Menu, X } from 'lucide-react';
import { useState, Suspense } from 'react';

function HomePageContent() {
  const searchParams = useSearchParams();
  const affiliateCode = searchParams.get('ref');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Pricing calculation
  const proPriceMonthly = affiliateCode ? 23.2 : 29.0;
  const proPriceDisplay = affiliateCode ? '$23.20' : 'from $23.20';

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Affiliate banner if code present */}
      {affiliateCode && (
        <div className="bg-green-500 text-white py-3 px-4 text-center">
          <p className="text-sm">
            🎉 <strong>Special Offer!</strong> Sign up now with code{' '}
            <code className="bg-white/20 px-2 py-1 rounded font-mono">
              {affiliateCode}
            </code>{' '}
            and get <strong>20% off your first month!</strong>
          </p>
        </div>
      )}

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-blue-600">
                📊 Trading Alerts
              </span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <button
                onClick={() => scrollToSection('features')}
                className="text-gray-700 hover:text-blue-600 transition"
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection('pricing')}
                className="text-gray-700 hover:text-blue-600 transition"
              >
                Pricing
              </button>
              <button
                onClick={() => scrollToSection('affiliate')}
                className="text-blue-600 font-medium hover:underline transition"
              >
                Affiliates
              </button>
              <Button variant="ghost" className="text-gray-700">
                Login
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                Sign Up
              </Button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-200">
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => scrollToSection('features')}
                  className="text-gray-700 hover:text-blue-600 transition text-left"
                >
                  Features
                </button>
                <button
                  onClick={() => scrollToSection('pricing')}
                  className="text-gray-700 hover:text-blue-600 transition text-left"
                >
                  Pricing
                </button>
                <button
                  onClick={() => scrollToSection('affiliate')}
                  className="text-blue-600 font-medium hover:underline transition text-left"
                >
                  Become an Affiliate
                </button>
                <Button variant="ghost" className="justify-start">
                  Login
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  Sign Up
                </Button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-blue-50 to-white flex items-center justify-center px-4 py-16">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6 text-balance">
            Never Miss a Trading Setup Again
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto mb-8 text-pretty">
            Get alerts when price touches key support/resistance levels based on
            fractal analysis
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 py-6 text-lg shadow-lg">
              Get Started Free
            </Button>
            <Button
              variant="outline"
              onClick={() => scrollToSection('pricing')}
              className="border-2 border-gray-300 text-gray-700 rounded-xl px-8 py-6 text-lg hover:border-blue-600"
            >
              See Pricing
            </Button>
          </div>
          <p className="text-sm text-gray-600 text-center mt-6">
            ✨ Trusted by 10,000+ traders • 🤝{' '}
            <button
              onClick={() => scrollToSection('affiliate')}
              className="text-blue-600 hover:underline"
            >
              Join our affiliate program
            </button>{' '}
            and earn
          </p>
          <div className="mt-12 flex justify-center">
            <div className="text-8xl">📈</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12 text-gray-900">
            Professional Trading Tools
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature Card 1 */}
            <Card className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-shadow p-8">
              <CardHeader>
                <div className="text-6xl mb-4">📊</div>
                <CardTitle className="text-2xl font-semibold text-gray-900">
                  Real-time Fractal Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Horizontal Support/Resistance Lines</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Diagonal Trendline Detection</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Multi-point Validation System</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Feature Card 2 */}
            <Card className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-shadow p-8">
              <CardHeader>
                <div className="text-6xl mb-4">🔔</div>
                <CardTitle className="text-2xl font-semibold text-gray-900">
                  Smart Alert System
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Price proximity alerts</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Email & Push notifications</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Customizable tolerance levels</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Feature Card 3 */}
            <Card className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-shadow p-8">
              <CardHeader>
                <div className="text-6xl mb-4">📈</div>
                <CardTitle className="text-2xl font-semibold text-gray-900">
                  Professional Tools
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>15 Major trading symbols</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>9 Timeframe options</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Watchlist management</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12 text-gray-900">
            Simple, Transparent Pricing
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Tier */}
            <Card className="bg-white rounded-xl shadow-lg">
              <CardHeader>
                <div className="mb-4">
                  <span className="bg-green-500 text-white rounded-full px-4 py-1 text-sm font-semibold inline-block">
                    FREE TIER 🆓
                  </span>
                </div>
                <CardTitle className="text-5xl font-bold text-gray-900 mb-4">
                  $0<span className="text-xl text-gray-500">/month</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-gray-600 mb-6">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>5 Symbols</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>3 Timeframes (H1, H4, D1)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>5 Alerts</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>5 Watchlist items</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full text-lg py-6">
                  Start Free
                </Button>
              </CardFooter>
            </Card>

            {/* Pro Tier */}
            <Card className="bg-white rounded-xl shadow-lg relative border-2 border-blue-600">
              {/* Most Popular Badge */}
              <div className="absolute -top-3 right-4">
                <span className="bg-blue-600 text-white rounded-full px-4 py-1 text-xs font-semibold">
                  Most Popular
                </span>
              </div>

              {/* Discount Badge if affiliate code present */}
              {affiliateCode && (
                <div className="absolute -top-3 left-4">
                  <span className="bg-green-500 text-white rounded-full px-3 py-1 text-xs font-bold shadow-lg animate-pulse">
                    20% OFF FIRST MONTH
                  </span>
                </div>
              )}

              <CardHeader>
                <div className="mb-4 mt-2">
                  <span className="bg-blue-600 text-white rounded-full px-4 py-1 text-sm font-semibold inline-block">
                    PRO TIER ⭐
                  </span>
                </div>

                {/* Discount hint banner */}
                {!affiliateCode && (
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-lg mb-4">
                    <p className="text-sm font-medium text-yellow-800">
                      💡 Have a referral code? Get 20% off this month!
                    </p>
                    <button
                      onClick={() => scrollToSection('affiliate')}
                      className="text-yellow-600 text-xs underline hover:text-yellow-700"
                    >
                      Apply code →
                    </button>
                  </div>
                )}

                <div className="mb-2">
                  <p className="text-sm text-gray-500 uppercase font-semibold mb-1">
                    Starting at
                  </p>
                  <CardTitle className="text-5xl font-bold text-gray-900">
                    {proPriceDisplay}
                    <span className="text-xl text-gray-500">/month</span>
                  </CardTitle>
                  {!affiliateCode && (
                    <p className="text-sm text-gray-500 mt-2">
                      ($29/month without referral code)
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-gray-600 mb-6">
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">✓</span>
                    <span>15 Symbols</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">✓</span>
                    <span>9 Timeframes (M5-D1)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">✓</span>
                    <span>20 Alerts</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">✓</span>
                    <span>50 Watchlist items</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">✓</span>
                    <span>Priority updates</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg py-6">
                  Start 7-Day Trial
                </Button>
                <button
                  onClick={() => scrollToSection('affiliate')}
                  className="text-blue-600 text-sm hover:underline"
                >
                  Have a referral code? Apply here →
                </button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      {/* Affiliate Program Section */}
      <section
        id="affiliate"
        className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 py-16 px-4"
      >
        <div className="max-w-6xl mx-auto text-center">
          <div className="text-6xl mb-4">🤝</div>
          <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Become an Affiliate Partner
          </h2>
          <p className="text-lg sm:text-xl text-gray-700 mb-10">
            Earn 20% commission for every PRO subscriber you refer
          </p>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div>
              <div className="text-4xl mb-2">💰</div>
              <h3 className="font-semibold text-lg mb-1 text-gray-900">
                Generous Commissions
              </h3>
              <p className="text-sm text-gray-600">
                Earn 20% of every subscription ($5.80/month per referral)
              </p>
            </div>
            <div>
              <div className="text-4xl mb-2">🔗</div>
              <h3 className="font-semibold text-lg mb-1 text-gray-900">
                Easy to Share
              </h3>
              <p className="text-sm text-gray-600">
                Get your unique referral code and share it anywhere
              </p>
            </div>
            <div>
              <div className="text-4xl mb-2">📊</div>
              <h3 className="font-semibold text-lg mb-1 text-gray-900">
                Track Performance
              </h3>
              <p className="text-sm text-gray-600">
                Real-time dashboard to monitor your earnings
              </p>
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex flex-col sm:flex-row justify-center gap-8 sm:gap-12 mb-8">
            <div>
              <div className="text-3xl font-bold text-blue-600">500+</div>
              <div className="text-sm text-gray-600">Active Affiliates</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600">$50K+</div>
              <div className="text-sm text-gray-600">Paid Out</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-600">
                No Approval
              </div>
              <div className="text-sm text-gray-600">Required</div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-6">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg rounded-xl shadow-lg">
              Join Affiliate Program
            </Button>
            <Button
              variant="outline"
              className="border-2 border-blue-600 text-blue-600 px-8 py-6 text-lg rounded-xl hover:bg-blue-50"
            >
              Learn More →
            </Button>
          </div>

          {/* Fine print */}
          <p className="text-sm text-gray-500 mt-6">
            Quick signup • No minimum sales • Monthly payouts
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Left column */}
            <div className="md:col-span-2">
              <div className="text-xl font-bold mb-4">Trading Alerts</div>
              <p className="text-gray-400 text-sm">
                © 2025 Trading Alerts. All rights reserved.
              </p>
            </div>

            {/* Product column */}
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>
                  <button
                    onClick={() => scrollToSection('pricing')}
                    className="hover:text-white transition"
                  >
                    Pricing
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection('features')}
                    className="hover:text-white transition"
                  >
                    Features
                  </button>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            {/* Partners column */}
            <div>
              <h3 className="font-semibold mb-4">Partners</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>
                  <button
                    onClick={() => scrollToSection('affiliate')}
                    className="hover:text-white transition"
                  >
                    Affiliate Program
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection('affiliate')}
                    className="hover:text-white transition"
                  >
                    Become a Partner
                  </button>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-2xl">Loading...</div>
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
