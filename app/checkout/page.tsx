'use client';

/**
 * Unified Checkout Page
 *
 * Single checkout page that supports both Stripe and dLocal:
 * - Auto-detects user country
 * - Shows dLocal options for supported countries
 * - Shows 3-day plan for eligible users
 * - Falls back to Stripe for non-dLocal countries
 * - Supports discount codes for monthly plan
 *
 * @module app/checkout/page
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CreditCard, Globe } from 'lucide-react';
import Link from 'next/link';

import {
  CountrySelector,
  PlanSelector,
  PaymentMethodSelector,
  PriceDisplay,
  DiscountCodeInput,
  PaymentButton,
} from '@/components/payments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { DLocalCountry, DLocalCurrency, PlanType } from '@/types/dlocal';
import {
  getCurrency,
  PRICING,
  DLOCAL_SUPPORTED_COUNTRIES,
} from '@/lib/dlocal/constants';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CHECKOUT CONTENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CheckoutContent(): React.ReactElement {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Form state
  const [country, setCountry] = useState<DLocalCountry | null>(null);
  const [planType, setPlanType] = useState<PlanType>('MONTHLY');
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [discountCode, setDiscountCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number | null>(null);

  // UI state
  const [canUseThreeDayPlan, setCanUseThreeDayPlan] = useState(false);
  const [eligibilityLoading, setEligibilityLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check 3-day plan eligibility
  useEffect(() => {
    const checkEligibility = async (): Promise<void> => {
      if (!session?.user?.id) {
        setEligibilityLoading(false);
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
      } catch (err) {
        console.error('Failed to check eligibility:', err);
      } finally {
        setEligibilityLoading(false);
      }
    };

    checkEligibility();
  }, [session?.user?.id]);

  // Handle URL params for deep linking
  useEffect(() => {
    const paramCountry = searchParams.get('country');
    const paramPlan = searchParams.get('plan');
    const paramRef = searchParams.get('ref');

    if (
      paramCountry &&
      DLOCAL_SUPPORTED_COUNTRIES.includes(paramCountry as DLocalCountry)
    ) {
      setCountry(paramCountry as DLocalCountry);
    }

    if (paramPlan === 'THREE_DAY' || paramPlan === 'MONTHLY') {
      setPlanType(paramPlan);
    }

    if (paramRef) {
      setDiscountCode(paramRef);
    }
  }, [searchParams]);

  // Reset payment method when country changes
  useEffect(() => {
    setPaymentMethod(null);
  }, [country]);

  // Handle discount validation result
  const handleDiscountValidation = useCallback(
    (isValid: boolean, percent?: number) => {
      setDiscountPercent(isValid && percent ? percent : null);
    },
    []
  );

  // Handle payment submission
  const handleCreatePayment = async (): Promise<void> => {
    if (!country || !paymentMethod || !session?.user?.id) {
      setError('Please complete all required fields');
      return;
    }

    setError(null);

    const currency = getCurrency(country);

    try {
      const res = await fetch('/api/payments/dlocal/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country,
          paymentMethod,
          planType,
          currency,
          discountCode: discountCode || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create payment');
      }

      const data = await res.json();

      // Redirect to dLocal payment page
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        throw new Error('No payment URL received');
      }
    } catch (err) {
      console.error('Payment creation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create payment');
    }
  };

  // Handle Stripe checkout redirect
  const handleStripeCheckout = async (): Promise<void> => {
    setError(null);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affiliateCode: discountCode || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create checkout');
      }

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      console.error('Stripe checkout error:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to create checkout'
      );
    }
  };

  // Calculate prices
  const getUsdAmount = (): number => {
    let baseAmount =
      planType === 'THREE_DAY' ? PRICING.THREE_DAY_USD : PRICING.MONTHLY_USD;

    if (discountPercent && planType === 'MONTHLY') {
      baseAmount = baseAmount * (1 - discountPercent / 100);
    }

    return baseAmount;
  };

  // Loading state
  if (status === 'loading' || eligibilityLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Auth check
  if (!session) {
    router.push('/login?callbackUrl=/checkout');
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }

  const currency = country ? getCurrency(country) : ('INR' as DLocalCurrency);
  const usdAmount = getUsdAmount();
  const isFormComplete = country && paymentMethod;

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="container mx-auto max-w-2xl px-4">
        {/* Back link */}
        <Link
          href="/pricing"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Pricing
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Complete Your Purchase</h1>
          <p className="text-muted-foreground">
            Secure payment with local payment methods
          </p>
        </div>

        {/* Main checkout card */}
        <Card className="mb-6 shadow-lg">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Local Payment
              </CardTitle>
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-700"
              >
                dLocal Powered
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 p-6">
            {/* Country Selection */}
            <CountrySelector
              value={country}
              onChange={setCountry}
              autoDetect={!country}
            />

            {country && (
              <>
                {/* Plan Selection */}
                <PlanSelector
                  value={planType}
                  onChange={setPlanType}
                  canUseThreeDayPlan={canUseThreeDayPlan}
                  showThreeDayPlan={true}
                />

                {/* Payment Method */}
                <PaymentMethodSelector
                  country={country}
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                />

                {/* Discount Code (monthly only) */}
                <DiscountCodeInput
                  value={discountCode}
                  onChange={setDiscountCode}
                  planType={planType}
                  onValidationChange={handleDiscountValidation}
                />

                {/* Price Summary */}
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-lg font-semibold">Total</span>
                    <PriceDisplay
                      usdAmount={usdAmount}
                      currency={currency}
                      compact
                      showRefresh={false}
                    />
                  </div>

                  {discountPercent && planType === 'MONTHLY' && (
                    <p className="text-sm text-green-600">
                      {discountPercent}% discount applied!
                    </p>
                  )}
                </div>

                {/* Error display */}
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                {/* Payment Button */}
                <PaymentButton
                  onClick={handleCreatePayment}
                  disabled={!isFormComplete}
                >
                  Proceed to Payment
                </PaymentButton>
              </>
            )}
          </CardContent>
        </Card>

        {/* Stripe alternative */}
        <Card className="border-dashed">
          <CardContent className="p-6">
            <div className="text-center">
              <div className="mb-4 flex items-center justify-center gap-2">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Prefer credit card?</span>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Pay with Visa, Mastercard, or American Express via Stripe
              </p>
              <Button
                variant="outline"
                onClick={handleStripeCheckout}
                className="border-blue-300 text-blue-600 hover:bg-blue-50"
              >
                Use Stripe Checkout
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Trust badges */}
        <div className="mt-8 text-center">
          <p className="mb-2 text-xs text-muted-foreground">
            Secure payment processing by dLocal and Stripe
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span>256-bit SSL</span>
            <span>•</span>
            <span>PCI Compliant</span>
            <span>•</span>
            <span>Encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN EXPORT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function CheckoutPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
            <p className="text-muted-foreground">Loading checkout...</p>
          </div>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
