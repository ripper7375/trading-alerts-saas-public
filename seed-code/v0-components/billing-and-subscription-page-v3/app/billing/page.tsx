'use client';

import { useState } from 'react';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';

interface BillingPageProps {
  tier?: 'FREE' | 'PRO';
  subscriptionStatus?: 'active' | 'trial' | 'canceled';
  currentDiscount?: {
    active: boolean;
    code: string;
    totalSaved: number;
    cyclesSaved: number;
  } | null;
  nextBillingCodeScheduled?: {
    code: string;
    appliesOn: string;
  } | null;
}

export default function BillingPage({
  tier = 'PRO',
  subscriptionStatus = 'active',
  currentDiscount = {
    active: true,
    code: 'SMITH-ABC123',
    totalSaved: 17.4,
    cyclesSaved: 3,
  },
  nextBillingCodeScheduled = null,
}: BillingPageProps) {
  // ✅ CRITICAL: Use SystemConfig hook for dynamic percentages
  const {
    discountPercent,
    commissionPercent,
    calculateDiscountedPrice,
    config,
    isLoading,
  } = useAffiliateConfig();

  const [discountCode, setDiscountCode] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  // Price constants
  const baseMonthlyPrice = 29.0;

  // Calculate prices using helper
  const discountedPrice = calculateDiscountedPrice(baseMonthlyPrice);
  const monthlySavings = baseMonthlyPrice - discountedPrice;

  // Mock next billing date
  const nextBillingDate = 'March 15, 2025';

  // Handle discount code application
  const handleApplyCode = async () => {
    setIsApplying(true);
    console.log('Applying discount code for next billing:', discountCode);

    // API call would go here
    // POST /api/user/billing/apply-code
    // Body: { code: discountCode }

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    alert(`Code "${discountCode}" will be applied on ${nextBillingDate}!`);
    setDiscountCode('');
    setIsApplying(false);
  };

  // Billing history with dynamic prices
  const billingHistory = [
    {
      date: 'Feb 15, 2025',
      description: currentDiscount?.active
        ? `Pro Plan - Monthly (${discountPercent}% off)`
        : 'Pro Plan - Monthly',
      amount: currentDiscount?.active ? discountedPrice : baseMonthlyPrice,
      status: 'Paid',
      hasDiscount: currentDiscount?.active,
    },
    {
      date: 'Jan 15, 2025',
      description: currentDiscount?.active
        ? `Pro Plan - Monthly (${discountPercent}% off)`
        : 'Pro Plan - Monthly',
      amount: currentDiscount?.active ? discountedPrice : baseMonthlyPrice,
      status: 'Paid',
      hasDiscount: currentDiscount?.active,
    },
    {
      date: 'Dec 15, 2024',
      description: 'Pro Plan - Monthly',
      amount: baseMonthlyPrice,
      status: 'Paid',
      hasDiscount: false,
    },
  ];

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold mb-2">
            Loading billing information...
          </div>
          <div className="text-gray-600">Please wait</div>
        </div>
      </div>
    );
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
              <Badge className="bg-white/20 text-white hover:bg-white/30">
                PRO TIER ⭐
              </Badge>
              <Badge className="bg-white/20 text-white hover:bg-white/30">
                ✓ ACTIVE
              </Badge>
              {currentDiscount?.active && (
                <Badge className="bg-green-400/30 text-white hover:bg-green-400/40">
                  🎉 {discountPercent}% AFFILIATE DISCOUNT
                </Badge>
              )}
            </div>

            <h2 className="text-4xl font-bold mt-4">Pro Plan</h2>

            {/* Pricing - conditional */}
            <div className="flex items-baseline gap-3 mt-2">
              {currentDiscount?.active && (
                <span className="text-3xl text-white/60 line-through">
                  ${baseMonthlyPrice}
                </span>
              )}
              <span className="text-5xl font-bold">
                $
                {currentDiscount?.active
                  ? discountedPrice.toFixed(2)
                  : baseMonthlyPrice}
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
                Use a new affiliate code at renewal to get {discountPercent}%
                off again!
              </div>
            )}

            <div className="text-lg text-white/80 mt-2">
              Member since Jan 15, 2025
            </div>

            {/* Affiliate discount details */}
            {currentDiscount?.active && (
              <div className="bg-white/20 rounded-lg p-3 mt-4 mb-4 border border-white/30">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎉</span>
                  <div className="flex-1">
                    <div className="font-semibold text-lg">
                      Affiliate Discount Active
                    </div>
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
                <span className="text-white/90">
                  Email & Push Notifications
                </span>
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
          <h2 className="text-2xl font-bold mb-6">
            💰 Maintain Your Discount (Optional)
          </h2>
          <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200">
            <CardContent className="p-6">
              <div className="text-3xl mb-3">🎫</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Enter Discount Code for Next Payment
              </h3>
              <p className="text-gray-700 mb-4">
                Find a new affiliate code from our partners and enter it here
                BEFORE your next renewal date to continue receiving{' '}
                {discountPercent}% off your PRO subscription.
              </p>

              {/* Current Status Display */}
              {nextBillingCodeScheduled ? (
                <div className="bg-white rounded-lg p-4 mb-4 border-2 border-green-500">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">✅</span>
                    <span className="font-semibold text-green-700">
                      Code Ready for Next Payment
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 font-mono">
                    Code: {nextBillingCodeScheduled.code}
                  </p>
                  <p className="text-sm text-green-600 mt-1">
                    You'll save ${monthlySavings.toFixed(2)} on{' '}
                    {nextBillingCodeScheduled.appliesOn}
                  </p>
                  <button
                    onClick={() => console.log('Update code clicked')}
                    className="text-blue-600 text-sm underline mt-2"
                  >
                    Update Code
                  </button>
                </div>
              ) : (
                <div className="bg-yellow-50 rounded-lg p-4 mb-4 border-2 border-yellow-400">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">⚠️</span>
                    <span className="font-semibold text-yellow-800">
                      No Code Scheduled
                    </span>
                  </div>
                  <p className="text-sm text-yellow-700">
                    Your next payment ({nextBillingDate}) will be $
                    {baseMonthlyPrice.toFixed(2)} without a code
                  </p>
                </div>
              )}

              {/* Input Form */}
              <div>
                <Label
                  htmlFor="discount-code"
                  className="text-sm font-medium text-gray-700 mb-2"
                >
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
                  {isApplying ? 'Applying...' : 'Apply Code for Next Payment'}
                </Button>
              </div>

              {/* Reminder Schedule */}
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  📅 Automatic Reminders
                </h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• 10 days before renewal: First reminder email</li>
                  <li>• 7 days before renewal: Second reminder email</li>
                  <li>
                    • 3 days before renewal: Final reminder email + in-app
                    notification
                  </li>
                </ul>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mt-4 rounded">
                <p className="text-sm text-gray-700">
                  <span className="inline-block mr-1">ℹ️</span>
                  Codes are one-time use. Each month, affiliates post new codes
                  on social media. We'll remind you before each renewal to find
                  and enter a new code!
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Payment Method Section */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-6">💳 Payment Method</h2>
          <Card>
            <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="text-3xl">💳</div>
                <div>
                  <div className="text-xl font-semibold">
                    Visa ending in ****4242
                  </div>
                  <div className="text-sm text-gray-600">Expires: 12/2026</div>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => console.log('Update card clicked')}
              >
                Update Card
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Affiliate Discount Summary (conditional) */}
        {currentDiscount?.active && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold mb-6">
              🎁 Your Current Discount
            </h2>
            <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200">
              <CardContent className="p-6">
                <div>
                  <div className="text-4xl mb-3">🤝</div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {discountPercent}% Discount This Month
                  </h3>
                  <p className="text-gray-700 mb-4">
                    You're saving ${monthlySavings.toFixed(2)} this month with
                    your affiliate code. Find new codes monthly to keep saving!
                  </p>
                  <div>
                    <div className="text-sm text-gray-600">
                      Your current code:
                    </div>
                    <div className="bg-white px-4 py-2 rounded-lg font-mono text-lg border-2 border-gray-300 mt-1">
                      {currentDiscount.code}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <p className="text-sm text-gray-600 italic mt-4">
              ℹ️ Your discount code is valid for one payment only. At renewal,
              enter a new code in the box above to get {discountPercent}% off
              again. Affiliates post fresh codes on social media monthly!
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
                    <span className="text-orange-600 text-xs">
                      ⚠️ High usage
                    </span>
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
                      <tr
                        key={idx}
                        className={`border-b ${idx % 2 === 0 ? 'bg-gray-50' : ''} hover:bg-blue-50 transition-colors`}
                      >
                        <td className="p-3">{item.date}</td>
                        <td className="p-3">
                          {item.description}
                          {item.hasDiscount && (
                            <span
                              className="ml-1 cursor-help"
                              title={`Original: $${baseMonthlyPrice.toFixed(2)} | Discount: -$${monthlySavings.toFixed(2)} | Paid: $${discountedPrice.toFixed(2)}`}
                            >
                              ℹ️
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right font-semibold">
                          ${item.amount.toFixed(2)}
                        </td>
                        <td className="p-3 text-center text-green-600">
                          {item.status} ✓
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() =>
                              console.log('Download PDF for', item.date)
                            }
                          >
                            Download PDF
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => console.log('Previous page')}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">Page 1 of 3</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => console.log('Next page')}
                >
                  Next
                </Button>
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
                  <h3 className="text-lg font-semibold mb-2">
                    Pause Subscription
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Take a break for up to 3 months
                  </p>
                  <Button
                    variant="outline"
                    className="w-full hover:border-yellow-500"
                    onClick={() => console.log('Pause subscription clicked')}
                  >
                    Pause
                  </Button>
                </div>

                {/* Notification Settings */}
                <div className="text-center p-4">
                  <div className="text-4xl mb-3">🔔</div>
                  <h3 className="text-lg font-semibold mb-2">
                    Notification Settings
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Manage billing and renewal reminders
                  </p>
                  <Button
                    variant="outline"
                    className="w-full hover:border-blue-500"
                    onClick={() =>
                      console.log('Configure notifications clicked')
                    }
                  >
                    Configure
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Downgrade Section */}
        <Card className="bg-gray-50 border-2 border-gray-300 mt-12">
          <CardContent className="p-6">
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              Want to downgrade?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Switch to FREE tier anytime. You'll keep your data but lose PRO
              features.
            </p>
            <ul className="text-sm space-y-2 mb-6">
              <li className="text-orange-600">
                ⚠️ Limited to 5 symbols (currently: 15)
              </li>
              <li className="text-orange-600">
                ⚠️ Only 3 timeframes (currently: 9)
              </li>
              <li className="text-orange-600">
                ⚠️ Only 5 alerts (currently: 20)
              </li>
              {currentDiscount?.active && (
                <li className="text-orange-600">
                  ⚠️ FREE tier is not eligible for affiliate discount codes
                </li>
              )}
            </ul>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                className="flex-1"
                onClick={() => console.log('Keep PRO plan clicked')}
              >
                Keep PRO Plan
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-gray-300 hover:border-red-500 hover:text-red-600"
                onClick={() => console.log('Downgrade to FREE clicked')}
              >
                Downgrade to FREE
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
