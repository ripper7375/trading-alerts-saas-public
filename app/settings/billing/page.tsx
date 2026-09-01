'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { CreditCard, CheckCircle, Loader2, ArrowUpRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { InvoiceList } from '@/components/billing/invoice-list';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';
import { TIER_CONFIG, type Tier } from '@/types/tier';
import { useLocale } from '@/lib/context/locale-context';

/**
 * Billing Settings Page (Row 75)
 *
 * - Current subscription card (FREE/PRO), driven by GET /api/subscription
 * - Cancel wired to the real POST /api/subscription/cancel (Closes F64's
 *   UI-binding scope for this session) -- this endpoint cancels the Stripe
 *   subscription and downgrades to FREE immediately, it does not set
 *   cancelAtPeriodEnd, so there is no "Undo" grace window here (the
 *   confirm-before-cancel dialog below IS the safeguard). Once cancelled,
 *   the FREE-tier branch further down automatically shows the
 *   Upgrade-to-PRO / pricing CTAs, satisfying the "re-subscribe link to
 *   /pricing" requirement without any extra wiring. Full Stripe
 *   reactivation flow is deferred to Session 9-6 per Decision 2 --
 *   components/billing/subscription-card.tsx (named in the order) is NOT
 *   used here: it is unmounted dead code with F64's original broken-Undo
 *   bug still in it; this page's own inline cancel flow (below) is what
 *   is actually live and does not have that bug. See Deviations.
 * - Invoice history table, driven by GET /api/invoices (via `InvoiceList`)
 * - Usage statistics (alerts, from GET /api/alerts)
 */

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'open' | 'failed';
  description: string;
  invoicePdfUrl: string | null;
  // davintrade-vat-stack: tax breakdown, additive to the API response.
  // `amount` above is always the tax-inclusive total actually charged;
  // `taxAmount` is how much of that total is tax, not an extra charge.
  hostedInvoiceUrl: string | null;
  taxAmount: number;
  taxRate: number;
  taxCountry: string | null;
  reverseCharge: boolean;
}

interface SubscriptionData {
  tier: 'FREE' | 'PRO';
  status: string;
  subscription: {
    id: string;
    status: string;
    provider: 'STRIPE' | 'DLOCAL' | null;
    planType: string | null;
    currentPeriodEnd: string | null;
    expiresAt: string | null;
    cancelAtPeriodEnd: boolean;
    trialEnd: string | null;
    paymentMethod: {
      brand: string;
      last4: string;
      expiryMonth: number;
      expiryYear: number;
    } | null;
    dLocalPaymentMethod: string | null;
    dLocalCountry: string | null;
  } | null;
  trial: {
    status: 'NOT_STARTED' | 'ACTIVE' | 'EXPIRED' | 'CONVERTED' | 'CANCELLED';
    convertedAt: string | null;
    cancelledAt: string | null;
    hasUsedFreeTrial: boolean;
  };
}

interface UsageStats {
  alerts: { current: number; max: number };
}

export default function BillingSettingsPage(): React.ReactElement {
  const { data: session } = useSession();
  const { t, formatDate, formatCurrency } = useLocale();

  const [subscriptionData, setSubscriptionData] =
    useState<SubscriptionData | null>(null);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(
    null
  );

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);

  const [usageStats, setUsageStats] = useState<UsageStats>({
    alerts: { current: 0, max: 100 },
  });
  const [usageError, setUsageError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const userTier = (subscriptionData?.tier ??
    session?.user?.tier ??
    'FREE') as Tier;
  const tierConfig = TIER_CONFIG[userTier] ?? TIER_CONFIG.FREE;
  const { regularPrice } = useAffiliateConfig();

  const fetchSubscription = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/subscription');
      if (!response.ok) {
        throw new Error('Failed to fetch subscription');
      }
      const data: SubscriptionData = await response.json();
      setSubscriptionData(data);
      setSubscriptionError(null);
    } catch (error) {
      setSubscriptionError(
        error instanceof Error ? error.message : 'Failed to fetch subscription'
      );
    }
  }, []);

  useEffect(() => {
    async function fetchInvoices(): Promise<void> {
      try {
        const response = await fetch('/api/invoices');
        if (!response.ok) {
          throw new Error('Failed to fetch invoices');
        }
        const data = await response.json();
        setInvoices(
          data.invoices.map(
            (invoice: {
              id: string;
              date: string;
              amount: number;
              status: 'paid' | 'open' | 'failed';
              description: string;
              invoicePdfUrl: string | null;
              hostedInvoiceUrl: string | null;
              taxAmount: number;
              taxRate: number;
              taxCountry: string | null;
              reverseCharge: boolean;
            }) => ({
              id: invoice.id,
              date: invoice.date,
              amount: invoice.amount,
              status: invoice.status,
              description: invoice.description,
              invoicePdfUrl: invoice.invoicePdfUrl,
              hostedInvoiceUrl: invoice.hostedInvoiceUrl,
              taxAmount: invoice.taxAmount,
              taxRate: invoice.taxRate,
              taxCountry: invoice.taxCountry,
              reverseCharge: invoice.reverseCharge,
            })
          )
        );
        setInvoicesError(null);
      } catch (error) {
        setInvoicesError(
          error instanceof Error ? error.message : 'Failed to fetch invoices'
        );
      } finally {
        setInvoicesLoading(false);
      }
    }

    async function fetchAlertUsage(): Promise<void> {
      try {
        const response = await fetch('/api/alerts');
        if (!response.ok) {
          throw new Error('Failed to fetch alert usage');
        }
        const data = await response.json();
        setUsageStats({
          alerts: {
            current: Array.isArray(data.alerts) ? data.alerts.length : 0,
            max: 100,
          },
        });
        setUsageError(null);
      } catch (error) {
        setUsageError(
          error instanceof Error ? error.message : 'Failed to fetch alert usage'
        );
      }
    }

    async function loadAll(): Promise<void> {
      await Promise.all([
        fetchSubscription(),
        fetchInvoices(),
        fetchAlertUsage(),
      ]);
      setIsLoading(false);
    }

    void loadAll();
  }, [fetchSubscription]);

  const handleConfirmCancellation = async (): Promise<void> => {
    setCancelling(true);
    setCancelError(null);
    try {
      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          data.message || data.error || 'Failed to cancel subscription'
        );
      }
      setCancelDialogOpen(false);
      setCancellationReason('');
      // Reflect the FREE downgrade without a page reload.
      await fetchSubscription();
    } catch (error) {
      setCancelError(
        error instanceof Error ? error.message : 'Failed to cancel subscription'
      );
    } finally {
      setCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const trial = subscriptionData?.trial;
  const subscription = subscriptionData?.subscription ?? null;

  return (
    <div className="animate-fade-in">
      <h2 className="mb-6 text-2xl font-bold text-foreground">
        {t('billing.title', 'Billing & Subscription')}
      </h2>

      {(session?.user as { role?: string })?.role === 'AFFILIATE' && (
        <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-900/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-indigo-900 dark:text-indigo-200">
                {t('billing.affiliate_account', 'Affiliate Partner Account')}
              </p>
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                {t(
                  'billing.affiliate_account_subtitle',
                  'Your account is enrolled in the Affiliate Partner Program. Manage your commission earnings and disbursement bank details in the partner portal.'
                )}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="border-indigo-300 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:text-indigo-200"
              >
                <Link href="/affiliate/dashboard/payouts">
                  {t('billing.view_payouts', 'View Payouts')}
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/affiliate/settings/payout">
                  {t('billing.payout_settings', 'Payout Settings')}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {subscriptionError && (
        <div className="border-destructive/50 bg-destructive/10 mb-6 rounded-lg border p-4 text-sm text-destructive">
          {subscriptionError}
        </div>
      )}

      {trial && trial.status === 'ACTIVE' && subscription?.trialEnd && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-900/20">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>
              {t('billing.free_trial_active', 'Free Trial Active:')}
            </strong>{' '}
            {t('billing.ends', 'ends')} {formatDate(subscription.trialEnd)}
          </p>
        </div>
      )}
      {trial && trial.status === 'CANCELLED' && trial.cancelledAt && (
        <div className="bg-muted/40 mb-6 rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">
            {t(
              'billing.trial_cancelled_on',
              'Your free trial was cancelled on'
            )}{' '}
            {formatDate(trial.cancelledAt)}.
          </p>
        </div>
      )}

      {/* Current Plan Card */}
      <Card
        className={
          userTier === 'PRO'
            ? 'border-primary/40 bg-primary/5 mb-8 border-2'
            : 'mb-8 border-2 border-border'
        }
      >
        <CardContent className="p-6">
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge
              className={
                userTier === 'PRO'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }
            >
              {userTier === 'PRO'
                ? t('billing.pro_tier', 'PRO TIER')
                : t('billing.free_tier', 'FREE TIER')}
            </Badge>
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
              {t('Active')}
            </Badge>
          </div>

          <h3 className="mb-2 text-2xl font-bold text-foreground">
            {userTier === 'PRO'
              ? t('billing.pro_plan', 'Pro Plan')
              : t('billing.free_plan', 'Free Plan')}
          </h3>

          <div className="mb-4 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-foreground">
              {userTier === 'PRO'
                ? formatCurrency(regularPrice)
                : formatCurrency(0)}
            </span>
            <span className="text-muted-foreground">
              /{t('billing.month', 'month')}
            </span>
          </div>

          <ul className="mb-6 space-y-2">
            <li className="flex items-center gap-2 text-sm text-foreground">
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              {t('billing.feature.xauusd', 'XAUUSD (Gold) — M5 & M15')}
            </li>
            <li className="flex items-center gap-2 text-sm text-foreground">
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              {t(
                'billing.feature.market_data',
                'Full market data & indicators'
              )}
            </li>
            <li className="flex items-center gap-2 text-sm text-foreground">
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              {userTier === 'PRO'
                ? `${tierConfig.maxAlerts} ${t('billing.price_alerts', 'Price Alerts')}`
                : t('billing.no_alerts', 'No Alerts (PRO feature)')}
            </li>
            {userTier === 'PRO' && (
              <>
                <li className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  {t(
                    'billing.feature.drawing_engine',
                    'Drawing Engine Line Alerts'
                  )}
                </li>
                <li className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  {t(
                    'billing.feature.multi_timeframe',
                    'Multi-Timeframe Visualization'
                  )}
                </li>
              </>
            )}
          </ul>

          {/* Action Buttons -- FREE tier always shows a real re-subscribe
              path to /pricing, including immediately after a cancel below */}
          {userTier === 'FREE' ? (
            <Link href="/pricing">
              <Button>
                {t('billing.upgrade_to_pro', 'Upgrade to PRO')}
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <div className="flex gap-3">
              <Button variant="outline" asChild>
                <Link href="/settings/billing">
                  {t('billing.manage_subscription', 'Manage Subscription')}
                </Link>
              </Button>
              <AlertDialog
                open={cancelDialogOpen}
                onOpenChange={(open) => {
                  setCancelDialogOpen(open);
                  if (!open) {
                    setCancelError(null);
                  }
                }}
              >
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                  >
                    {t('billing.cancel_plan', 'Cancel Plan')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t('billing.cancel_subscription', 'Cancel Subscription')}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t(
                        'billing.cancel_confirm_body',
                        'Are you sure you want to cancel your PRO subscription? Your subscription will be cancelled immediately and you will be downgraded to the FREE tier. You can re-subscribe any time from the Pricing page.'
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="py-4">
                    <label
                      htmlFor="cancellation-reason"
                      className="mb-2 block text-sm font-medium text-foreground"
                    >
                      {t(
                        'billing.cancellation_reason_label',
                        'Reason for cancellation (optional)'
                      )}
                    </label>
                    <select
                      id="cancellation-reason"
                      value={cancellationReason}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        setCancellationReason(e.target.value)
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="">
                        {t('billing.select_a_reason', 'Select a reason...')}
                      </option>
                      <option value="too_expensive">
                        {t('billing.reason.too_expensive', 'Too expensive')}
                      </option>
                      <option value="not_using">
                        {t('billing.reason.not_using', 'Not using enough')}
                      </option>
                      <option value="missing_features">
                        {t(
                          'billing.reason.missing_features',
                          'Missing features'
                        )}
                      </option>
                      <option value="switching">
                        {t(
                          'billing.reason.switching',
                          'Switching to competitor'
                        )}
                      </option>
                      <option value="other">
                        {t('billing.reason.other', 'Other')}
                      </option>
                    </select>
                    {cancelError && (
                      <p className="mt-3 text-sm text-red-600">{cancelError}</p>
                    )}
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={cancelling}>
                      {t('billing.keep_subscription', 'Keep Subscription')}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700"
                      disabled={cancelling}
                      onClick={(e) => {
                        e.preventDefault();
                        void handleConfirmCancellation();
                      }}
                    >
                      {cancelling
                        ? t('billing.cancelling', 'Cancelling...')
                        : t(
                            'billing.confirm_cancellation',
                            'Confirm Cancellation'
                          )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {userTier === 'PRO' && subscription?.currentPeriodEnd && (
            <p className="mt-4 text-sm text-muted-foreground">
              {t('billing.next_billing_date', 'Next billing date:')}{' '}
              {formatDate(subscription.currentPeriodEnd)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Payment Method */}
      {userTier === 'PRO' && subscription && (
        <>
          <section className="mb-8">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
              <CreditCard className="h-5 w-5" />
              {t('billing.payment_method', 'Payment Method')}
            </h3>
            <Card>
              <CardContent className="flex flex-col items-start justify-between gap-4 p-4 sm:flex-row sm:items-center">
                {subscription.provider === 'DLOCAL' ? (
                  <div>
                    <p className="font-semibold text-foreground">
                      {t('billing.paid_via_dlocal', 'Paid via dLocal')}
                      {subscription.dLocalPaymentMethod
                        ? ` (${subscription.dLocalPaymentMethod})`
                        : ''}
                    </p>
                    {subscription.dLocalCountry && (
                      <p className="text-sm text-muted-foreground">
                        {t('Country')}: {subscription.dLocalCountry}
                      </p>
                    )}
                  </div>
                ) : subscription.paymentMethod ? (
                  <div className="flex items-center gap-4">
                    <div className="flex h-8 w-12 items-center justify-center rounded bg-muted">
                      <CreditCard className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {subscription.paymentMethod.brand
                          .charAt(0)
                          .toUpperCase() +
                          subscription.paymentMethod.brand.slice(1)}{' '}
                        {t('billing.ending_in', 'ending in')} ****
                        {subscription.paymentMethod.last4}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t('billing.expires', 'Expires:')}{' '}
                        {subscription.paymentMethod.expiryMonth}/
                        {subscription.paymentMethod.expiryYear}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t(
                      'billing.no_payment_method',
                      'No payment method on file.'
                    )}
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          <Separator className="my-8" />
        </>
      )}

      {/* Usage Statistics */}
      <section className="mb-8">
        <h3 className="mb-4 text-lg font-semibold text-foreground">
          {t('billing.usage_this_month', 'Usage This Month')}
        </h3>
        {usageError ? (
          <p className="text-sm text-red-600">{usageError}</p>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex justify-between">
                <span className="text-sm font-medium text-foreground">
                  {t('billing.active_alerts', 'Active Alerts')}
                </span>
                <span className="text-sm text-muted-foreground">
                  {usageStats.alerts.current}/{usageStats.alerts.max}
                </span>
              </div>
              <Progress
                value={
                  (usageStats.alerts.current / usageStats.alerts.max) * 100
                }
                className="h-2"
              />
            </div>
          </div>
        )}
      </section>

      <Separator className="my-8" />

      {/* Invoice History */}
      {userTier === 'PRO' && (
        <section>
          <h3 className="mb-4 text-lg font-semibold text-foreground">
            {t('billing.invoice_history', 'Invoice History')}
          </h3>
          {invoicesError ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-red-600">
                {invoicesError}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <InvoiceList invoices={invoices} isLoading={invoicesLoading} />
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* Upgrade Prompt for FREE users */}
      {userTier === 'FREE' && (
        <Card className="border-0 bg-gradient-to-r from-primary to-amber-600 text-primary-foreground">
          <CardContent className="p-6">
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <div className="text-4xl">🚀</div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="mb-2 text-xl font-bold">
                  {t('billing.unlock_more_with_pro', 'Unlock More with PRO')}
                </h3>
                <p className="text-primary-foreground/90 mb-4">
                  {t(
                    'billing.upgrade_prompt',
                    'Get 100 price alerts, drawing engine line alerts, multi-timeframe visualization, and priority support for just {price}/month.'
                  ).replace('{price}', formatCurrency(regularPrice))}
                </p>
                <Link href="/pricing">
                  <Button className="bg-white font-semibold text-foreground hover:bg-white/90">
                    {t('billing.view_pricing_plans', 'View Pricing Plans')}
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
