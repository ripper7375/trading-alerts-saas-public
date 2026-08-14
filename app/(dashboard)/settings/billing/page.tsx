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

/**
 * Billing Settings Page
 *
 * Features:
 * - Current subscription card (FREE/PRO), driven by GET /api/subscription
 * - Trial-status banner, driven by the same endpoint's `trial` field
 * - Upgrade/Cancel actions (cancel wired to POST /api/subscription/cancel)
 * - Payment method display
 * - Invoice history table, driven by GET /api/invoices (via `InvoiceList`)
 * - Usage statistics (alerts, from GET /api/alerts)
 * - Affiliate discount display
 */

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'open' | 'failed';
  description: string;
  invoicePdfUrl: string | null;
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
            }) => ({
              id: invoice.id,
              date: invoice.date,
              amount: invoice.amount,
              status: invoice.status,
              description: invoice.description,
              invoicePdfUrl: invoice.invoicePdfUrl,
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
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const trial = subscriptionData?.trial;
  const subscription = subscriptionData?.subscription ?? null;

  return (
    <div className="animate-fade-in">
      <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Billing & Subscription
      </h2>

      {/* Affiliate Partner Notice */}
      {(session?.user as { role?: string })?.role === 'AFFILIATE' && (
        <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-900/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-indigo-900 dark:text-indigo-200">
                Affiliate Partner Account
              </p>
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                Your account is enrolled in the Affiliate Partner Program.
                Manage your commission earnings and disbursement bank details in
                the partner portal.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="border-indigo-300 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:text-indigo-200"
              >
                <Link href="/affiliate/dashboard/payouts">View Payouts</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/affiliate/settings/payout">Payout Settings</Link>
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

      {/* Trial Status Banner */}
      {trial && trial.status === 'ACTIVE' && subscription?.trialEnd && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-900/20">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Free Trial Active:</strong> ends{' '}
            {new Date(subscription.trialEnd).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      )}
      {trial && trial.status === 'CANCELLED' && trial.cancelledAt && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Your free trial was cancelled on{' '}
            {new Date(trial.cancelledAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
            .
          </p>
        </div>
      )}

      {/* Current Plan Card */}
      <Card
        className={`mb-8 ${
          userTier === 'PRO'
            ? 'border-2 border-blue-600 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20'
            : 'border-2 border-gray-200 dark:border-gray-700'
        }`}
      >
        <CardContent className="p-6">
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge
              className={
                userTier === 'PRO'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
              }
            >
              {userTier === 'PRO' ? 'PRO TIER' : 'FREE TIER'}
            </Badge>
            <Badge className="bg-green-100 text-green-800">Active</Badge>
          </div>

          <h3 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
            {userTier === 'PRO' ? 'Pro Plan' : 'Free Plan'}
          </h3>

          {/* Pricing */}
          <div className="mb-4 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-gray-900 dark:text-white">
              ${userTier === 'PRO' ? regularPrice.toFixed(2) : '0'}
            </span>
            <span className="text-gray-600 dark:text-gray-400">/month</span>
          </div>

          {/* Features */}
          <ul className="mb-6 space-y-2">
            <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <CheckCircle className="h-4 w-4 text-green-600" />
              XAUUSD (Gold) — M5 &amp; M15
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Full market data &amp; indicators
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <CheckCircle className="h-4 w-4 text-green-600" />
              {userTier === 'PRO'
                ? `${tierConfig.maxAlerts} Price Alerts`
                : 'No Alerts (PRO feature)'}
            </li>
            {userTier === 'PRO' && (
              <>
                <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Drawing Engine Line Alerts
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Multi-Timeframe Visualization
                </li>
              </>
            )}
          </ul>

          {/* Action Buttons */}
          {userTier === 'FREE' ? (
            <Link href="/pricing">
              <Button className="bg-blue-600 hover:bg-blue-700">
                Upgrade to PRO
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <div className="flex gap-3">
              <Button variant="outline">Manage Subscription</Button>
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
                    Cancel Plan
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to cancel your PRO subscription? You
                      will lose access to premium features at the end of your
                      billing period.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="py-4">
                    <label
                      htmlFor="cancellation-reason"
                      className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Reason for cancellation (optional)
                    </label>
                    <select
                      id="cancellation-reason"
                      value={cancellationReason}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        setCancellationReason(e.target.value)
                      }
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                    >
                      <option value="">Select a reason...</option>
                      <option value="too_expensive">Too expensive</option>
                      <option value="not_using">Not using enough</option>
                      <option value="missing_features">Missing features</option>
                      <option value="switching">Switching to competitor</option>
                      <option value="other">Other</option>
                    </select>
                    {cancelError && (
                      <p className="mt-3 text-sm text-red-600">{cancelError}</p>
                    )}
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={cancelling}>
                      Keep Subscription
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700"
                      disabled={cancelling}
                      onClick={(e) => {
                        e.preventDefault();
                        void handleConfirmCancellation();
                      }}
                    >
                      {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {userTier === 'PRO' && subscription?.currentPeriodEnd && (
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              Next billing date:{' '}
              {new Date(subscription.currentPeriodEnd).toLocaleDateString(
                'en-US',
                { year: 'numeric', month: 'long', day: 'numeric' }
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Payment Method */}
      {userTier === 'PRO' && subscription && (
        <>
          <section className="mb-8">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
              <CreditCard className="h-5 w-5" />
              Payment Method
            </h3>
            <Card>
              <CardContent className="flex flex-col items-start justify-between gap-4 p-4 sm:flex-row sm:items-center">
                {subscription.provider === 'DLOCAL' ? (
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      Paid via dLocal
                      {subscription.dLocalPaymentMethod
                        ? ` (${subscription.dLocalPaymentMethod})`
                        : ''}
                    </p>
                    {subscription.dLocalCountry && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Country: {subscription.dLocalCountry}
                      </p>
                    )}
                  </div>
                ) : subscription.paymentMethod ? (
                  <div className="flex items-center gap-4">
                    <div className="flex h-8 w-12 items-center justify-center rounded bg-gray-100 dark:bg-gray-700">
                      <CreditCard className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {subscription.paymentMethod.brand
                          .charAt(0)
                          .toUpperCase() +
                          subscription.paymentMethod.brand.slice(1)}{' '}
                        ending in ****{subscription.paymentMethod.last4}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Expires: {subscription.paymentMethod.expiryMonth}/
                        {subscription.paymentMethod.expiryYear}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    No payment method on file.
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
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Usage This Month
        </h3>
        {usageError ? (
          <p className="text-sm text-red-600">{usageError}</p>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Active Alerts
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
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
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Invoice History
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
        <Card className="border-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <div className="text-4xl">🚀</div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="mb-2 text-xl font-bold">Unlock More with PRO</h3>
                <p className="mb-4 text-white/90">
                  Get 100 price alerts, drawing engine line alerts,
                  multi-timeframe visualization, and priority support for just $
                  {regularPrice}/month.
                </p>
                <Link href="/pricing">
                  <Button className="bg-white font-semibold text-blue-600 hover:bg-white/90">
                    View Pricing Plans
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
