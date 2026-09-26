'use client';

/**
 * Unified Checkout Page
 *
 * Single checkout page that supports both Stripe and dLocal:
 * - Stripe is the PRIMARY payment method (cards, Apple Pay, Google Pay, PayPal)
 * - dLocal is shown as ALTERNATIVE for local payment methods
 * - Auto-detects user country to filter local payment options
 * - Shows 3-day trial plan for eligible dLocal users
 * - Supports discount codes for monthly plan
 *
 * Flow B: Unified Payment Flow
 * - Both payment options on same page
 * - Country detection filters dLocal payment methods
 * - User chooses between international payments (Stripe) or local methods (dLocal)
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
  DLOCAL_SUPPORTED_COUNTRIES,
} from '@/lib/dlocal/constants';
import { formatChargedAmount } from '@/lib/billing/invoice-amounts';
import { useLocale } from '@/lib/context/locale-context';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CHECKOUT CONTENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CheckoutContent(): React.ReactElement {
  const {
    t,
    formatCurrency,
    currency: displayCurrency,
    language,
  } = useLocale();
  // PRO and 3-day prices from SystemConfig (admin-editable), as charged.
  const { regularPrice, threeDayPrice, annualPrice, annualSavingsPercent } =
    useAffiliateConfig();
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Form state
  const [country, setCountry] = useState<DLocalCountry | null>(null);
  const [planType, setPlanType] = useState<PlanType>('MONTHLY');
  // Card (Stripe) billing period: monthly or the annual plan
  const [stripeBilling, setStripeBilling] = useState<'monthly' | 'yearly'>(
    'monthly'
  );
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

    if (
      paramPlan === 'THREE_DAY' ||
      paramPlan === 'MONTHLY' ||
      paramPlan === 'YEARLY'
    ) {
      setPlanType(paramPlan);
    }

    // ?billing=yearly (from /pricing's annual view) preselects the annual plan
    if (searchParams.get('billing') === 'yearly') {
      setStripeBilling('yearly');
      if (!paramPlan) setPlanType('YEARLY');
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
      setError(
        t(
          'checkout.error_required_fields',
          'Please complete all required fields'
        )
      );
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
        throw new Error(
          errorData.error ||
            t('checkout.error_create_payment', 'Failed to create payment')
        );
      }

      const data = await res.json();

      // Redirect to dLocal payment page
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        throw new Error(
          t('checkout.error_no_payment_url', 'No payment URL received')
        );
      }
    } catch (err) {
      console.error('Payment creation error:', err);
      setError(
        err instanceof Error
          ? err.message
          : t('checkout.error_create_payment', 'Failed to create payment')
      );
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
          billingPeriod: stripeBilling,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          errorData.error ||
            t('checkout.error_create_checkout', 'Failed to create checkout')
        );
      }

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(
          t('checkout.error_no_checkout_url', 'No checkout URL received')
        );
      }
    } catch (err) {
      console.error('Stripe checkout error:', err);
      setError(
        err instanceof Error
          ? err.message
          : t('checkout.error_create_checkout', 'Failed to create checkout')
      );
    }
  };

  // Calculate prices
  const getUsdAmount = (): number => {
    let baseAmount =
      planType === 'THREE_DAY'
        ? threeDayPrice
        : planType === 'YEARLY'
          ? annualPrice
          : regularPrice;

    // Affiliate discounts apply to the monthly and annual plans
    if (discountPercent && planType !== 'THREE_DAY') {
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
          <p className="text-muted-foreground">
            {t('Loading...', 'Loading...')}
          </p>
        </div>
      </div>
    );
  }

  // Auth check
  if (!session) {
    router.push('/login?callbackUrl=/checkout');
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">
          {t('checkout.redirecting_login', 'Redirecting to login...')}
        </p>
      </div>
    );
  }

  // Already PRO tier notification
  if (session.user.tier === 'PRO') {
    return (
      <div className="bg-muted/30 min-h-screen py-8">
        <div className="container mx-auto max-w-2xl px-4">
          <Link
            href="/dashboard"
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('checkout.back_to_dashboard', 'Back to Dashboard')}
          </Link>

          <Card className="p-8 text-center shadow-lg">
            <div className="bg-primary/10 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-primary">
              <CreditCard className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              {t('checkout.already_pro_title', "You're Already a PRO Member")}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              {t(
                'checkout.already_pro_desc',
                'Your account currently has active access to all PRO features, trading strategies, and real-time alerts.'
              )}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild variant="outline">
                <Link href="/settings/billing">
                  {t('checkout.manage_subscription', 'Manage Subscription')}
                </Link>
              </Button>
              <Button asChild>
                <Link href="/dashboard">
                  {t('checkout.go_to_dashboard', 'Go to Dashboard')}
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const currency = country ? getCurrency(country) : ('INR' as DLocalCurrency);
  const usdAmount = getUsdAmount();
  const isFormComplete = country && paymentMethod;

  return (
    <div className="bg-muted/30 min-h-screen py-8">
      <div className="container mx-auto max-w-2xl px-4">
        {/* Back link */}
        <Link
          href="/pricing"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('checkout.back_to_pricing', 'Back to Pricing')}
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            {t('checkout.complete_purchase', 'Complete Your Purchase')}
          </h1>
          <p className="text-muted-foreground">
            {t(
              'checkout.choose_payment_method',
              'Choose your preferred payment method'
            )}
          </p>
        </div>

        {/* Primary: Stripe International Payments */}
        <Card className="mb-6 shadow-lg">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <CreditCard className="h-5 w-5" />
                {t('checkout.international_payment', 'International Payment')}
              </CardTitle>
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                {t('checkout.stripe_powered', 'Stripe Powered')}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 p-6">
            <div className="space-y-4">
              <p className="text-muted-foreground">
                {t(
                  'checkout.pay_with_card',
                  'Pay with card, Apple Pay, Google Pay, or PayPal'
                )}
              </p>

              {/* Billing period */}
              <div
                className="grid grid-cols-2 gap-2"
                role="radiogroup"
                aria-label={t('checkout.billing_period', 'Billing period')}
              >
                {(['monthly', 'yearly'] as const).map((period) => (
                  <button
                    key={period}
                    type="button"
                    role="radio"
                    aria-checked={stripeBilling === period}
                    onClick={() => setStripeBilling(period)}
                    className={`rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-all ${
                      stripeBilling === period
                        ? 'bg-primary/10 border-primary text-foreground'
                        : 'hover:border-primary/40 border-border text-muted-foreground'
                    }`}
                  >
                    {period === 'monthly'
                      ? t('checkout.monthly', 'Monthly')
                      : t('checkout.annual', 'Annual')}
                    {period === 'yearly' && annualSavingsPercent > 0 && (
                      <span className="ml-1 text-xs font-normal text-emerald-600 dark:text-emerald-400">
                        {t('pricing.save_percent', 'Save {percent}%').replace(
                          '{percent}',
                          String(annualSavingsPercent)
                        )}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Price display */}
              <div className="bg-muted/30 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-foreground">
                    {stripeBilling === 'yearly'
                      ? t('checkout.pro_annual', 'PRO Annual')
                      : t('checkout.pro_monthly', 'PRO Monthly')}
                  </span>
                  <span className="text-2xl font-bold text-foreground">
                    {stripeBilling === 'yearly' ? (
                      <>
                        {formatCurrency(annualPrice)}/
                        {t('checkout.year_abbr', 'yr')}
                      </>
                    ) : (
                      <>
                        {formatCurrency(regularPrice)}/
                        {t('checkout.month_abbr', 'mo')}
                      </>
                    )}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t(
                    'checkout.full_pro_access',
                    'Full access to all PRO features'
                  )}
                </p>
              </div>

              {/* The card charge is in USD; the local figure is approximate */}
              {displayCurrency && displayCurrency !== 'USD' && (
                <p className="text-xs text-muted-foreground">
                  {t(
                    'checkout.card_charged_usd',
                    'You will be charged {usdPrice} in USD. The {currency} amount shown is approximate, converted at a recent market rate; your card issuer converts the charge at its own rate.'
                  )
                    .replace(
                      '{usdPrice}',
                      `${formatChargedAmount(
                        stripeBilling === 'yearly' ? annualPrice : regularPrice,
                        'USD',
                        language
                      )}/${
                        stripeBilling === 'yearly'
                          ? t('checkout.year', 'year')
                          : t('checkout.month', 'month')
                      }`
                    )
                    .replace('{currency}', displayCurrency)}
                </p>
              )}

              {/* Discount code for Stripe */}
              {discountCode && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  {t('checkout.affiliate_code', 'Affiliate code')}:{' '}
                  {discountCode}
                </p>
              )}

              {/* Error display */}
              {error && (
                <div className="border-destructive/50 bg-destructive/10 rounded-lg border p-4">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {/* Stripe checkout button */}
              <Button
                onClick={handleStripeCheckout}
                className="w-full"
                size="lg"
              >
                <CreditCard className="mr-2 h-5 w-5" />
                {t('checkout.continue_to_payment', 'Continue to Payment')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Secondary: dLocal Local Payment Methods */}
        <Card className="mb-6 border-2 border-dashed border-border">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Globe className="h-5 w-5" />
                {t('checkout.local_payment_methods', 'Local Payment Methods')}
              </CardTitle>
              <Badge
                variant="secondary"
                className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              >
                {t('checkout.dlocal_powered', 'dLocal Powered')}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {t(
                'checkout.pay_with_local',
                'Pay with UPI, bank transfer, e-wallets, and more in your local currency'
              )}
            </p>
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
                <div className="bg-muted/30 rounded-lg border border-border p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-lg font-semibold text-foreground">
                      {t('checkout.total', 'Total')}
                    </span>
                    <PriceDisplay
                      usdAmount={usdAmount}
                      currency={currency}
                      compact
                      showRefresh={false}
                    />
                  </div>

                  {discountPercent && planType !== 'THREE_DAY' && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">
                      {t(
                        'checkout.discount_applied',
                        '{percent}% discount will be applied!'
                      ).replace('{percent}', String(discountPercent))}
                    </p>
                  )}
                </div>

                {/* Error display */}
                {error && (
                  <div className="border-destructive/50 bg-destructive/10 rounded-lg border p-4">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                {/* Payment Button */}
                <PaymentButton
                  onClick={handleCreatePayment}
                  disabled={!isFormComplete}
                >
                  {t('checkout.pay_with_local_method', 'Pay with Local Method')}
                </PaymentButton>
              </>
            )}
          </CardContent>
        </Card>

        {/* Trust badges */}
        <div className="mt-8 text-center">
          <p className="mb-2 text-xs text-muted-foreground">
            {t(
              'checkout.secure_processing',
              'Secure payment processing by Stripe and dLocal'
            )}
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span>{t('checkout.ssl', '256-bit SSL')}</span>
            <span>•</span>
            <span>{t('checkout.pci_compliant', 'PCI Compliant')}</span>
            <span>•</span>
            <span>{t('checkout.encrypted', 'Encrypted')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN EXPORT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CheckoutFallback(): React.ReactElement {
  const { t } = useLocale();
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
        <p className="text-muted-foreground">
          {t('checkout.loading_checkout', 'Loading checkout...')}
        </p>
      </div>
    </div>
  );
}

export default function CheckoutPage(): React.ReactElement {
  return (
    <Suspense fallback={<CheckoutFallback />}>
      <CheckoutContent />
    </Suspense>
  );
}
