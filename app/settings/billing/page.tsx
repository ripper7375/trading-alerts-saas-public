'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  AlertTriangle,
  Clock,
  CreditCard,
  CheckCircle,
  Loader2,
  ArrowUpRight,
} from 'lucide-react';

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
} from '@/components/ui/alert-dialog';
import { useUserViewAs } from '@/components/admin/user-view-as/user-view-as-context';
import { InvoiceList, type Invoice } from '@/components/billing/invoice-list';
import { withViewAsQuery } from '@/lib/admin/user-view-as-paths';
import { formatChargedAmount } from '@/lib/billing/invoice-amounts';
import { renewCheckoutHref } from '@/lib/billing/renew';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';
import type {
  SubscriptionAction,
  SubscriptionDisplayState,
} from '@/lib/stripe/subscription-actions';
import { TIER_CONFIG, type Tier } from '@/types/tier';
import { useLocale } from '@/lib/context/locale-context';

/**
 * Billing Settings Page (Row 75)
 *
 * This page IS the Manage Subscription page (plan v2.1, §8; there is no
 * separate hub). Manage Subscription S1 added:
 * - a status banner for a failed payment (PAST_DUE / UNPAID) with "Pay now"
 *   (Stripe's hosted invoice) and "Update card" (Stripe's portal, card form
 *   only, via POST /api/subscription/payment-method-session);
 * - an action row and an "Update card" button drawn from the server's
 *   `allowedActions`, so the page never offers what the server would refuse;
 * - removal of the old "Manage Subscription" button, which linked to this page.
 *
 * Manage Subscription S2 (plan v2.1, workflows W3 and W4):
 * - "Cancel Plan" is a link to the three-step page /settings/billing/cancel.
 *   Cancelling no longer ends PRO at once: the subscription is cancelled at the
 *   end of the paid period, and this page then shows a "PRO ends on {date}"
 *   banner with "Resume subscription" (a confirm dialog, no extra page;
 *   POST /api/subscription/resume). dLocal plans are prepaid and have no
 *   cancel (D8), so they get a note instead of a button.
 * - Every flow returns here with `?done=<action>`; the marker only triggers
 *   the notice, the data is always read fresh from the API.
 *
 * Manage Subscription S3 (plan v2.1, workflows W5a and W5b):
 * - "Change billing period" (from `allowedActions`) links to the page
 *   /settings/billing/change-plan, where the upgrade to yearly is quoted and
 *   confirmed and the switch to monthly is scheduled.
 * - A switch to monthly that waits for the renewal date shows a status banner
 *   ("Your plan switches to monthly billing on {date}") with "Keep yearly",
 *   a confirm dialog that withdraws it (DELETE /api/subscription/change-plan).
 *   It charges nothing, so it needs no page of its own.
 *
 * Manage Subscription S4 (plan v2.1, workflow W6, dLocal):
 * - A dLocal plan within three days of its end shows a status banner ("Your
 *   plan expires on {date}") and "Renew now" (from `allowedActions`), which
 *   opens /checkout with the period preselected and a renew marker. The days
 *   left are added to the new period (D6). `?done=renewed` brings the user
 *   back after paying and says so, once the fresh data agrees.
 *
 * - Current subscription card (FREE/PRO), driven by GET /api/subscription
 * - Invoice history table, driven by GET /api/invoices (via `InvoiceList`)
 * - Usage statistics (alerts, from GET /api/alerts)
 * - Admin "view as user" (lib/admin/user-view-as.ts): every GET adds
 *   `?view_as=user` so it reads the viewed user, and the plan actions
 *   (cancel, manage, upgrade) are hidden -- they would act on the admin.
 */

/** Invoice history is revealed this many rows at a time. */
const INVOICE_PAGE_SIZE = 12;

interface SubscriptionData {
  tier: 'FREE' | 'PRO';
  status: string;
  /** What the server will accept for this user; empty in admin view. */
  allowedActions?: SubscriptionAction[];
  displayState?: SubscriptionDisplayState;
  subscription: {
    id: string;
    status: string;
    provider: 'STRIPE' | 'DLOCAL' | null;
    planType: string | null;
    /** The subscriber's own price per billing period (USD), as charged */
    amountUsd?: number | null;
    currentPeriodEnd: string | null;
    expiresAt: string | null;
    /** False for a dLocal plan: it is prepaid and ends at `expiresAt`. */
    renewsAutomatically?: boolean;
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
    /** Stripe's hosted page for the open invoice ("Pay now"). */
    openInvoiceUrl?: string | null;
    /** A switch to monthly billing waiting for the renewal date (W5b). */
    pendingPlanChange?: {
      planType: 'MONTHLY';
      effectiveAt: string | null;
    } | null;
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
  const viewAs = useUserViewAs();
  const viewing = viewAs !== null;
  const { t, formatDate, formatCurrency, language, currency } = useLocale();
  const displayCurrency = (currency || 'GBP').toUpperCase();

  const [subscriptionData, setSubscriptionData] =
    useState<SubscriptionData | null>(null);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(
    null
  );

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [visibleInvoiceCount, setVisibleInvoiceCount] =
    useState(INVOICE_PAGE_SIZE);

  const [usageStats, setUsageStats] = useState<UsageStats>({
    alerts: { current: 0, max: 100 },
  });
  const [usageError, setUsageError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [keepDialogOpen, setKeepDialogOpen] = useState(false);
  const [keeping, setKeeping] = useState(false);
  const [keepError, setKeepError] = useState<string | null>(null);
  const [openingCard, setOpeningCard] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  // Set when another page sends the user back with ?done=card (Stripe's card
  // form) or ?done=cancel (the cancel page), and after a resume here. It
  // proves nothing (the user may have closed the form); the page re-fetches
  // either way and a notice is drawn only when the fresh data agrees.
  const [returnedFrom, setReturnedFrom] = useState<
    | 'card'
    | 'cancel'
    | 'resumed'
    | 'upgraded'
    | 'switch'
    | 'kept'
    | 'renewed'
    | null
  >(null);

  const userTier = (subscriptionData?.tier ??
    (viewAs ? viewAs.tier : session?.user?.tier) ??
    'FREE') as Tier;
  const userRole = viewAs
    ? viewAs.role
    : (session?.user as { role?: string } | undefined)?.role;
  const tierConfig = TIER_CONFIG[userTier] ?? TIER_CONFIG.FREE;
  const { regularPrice, annualPrice } = useAffiliateConfig();

  const displayState: SubscriptionDisplayState =
    subscriptionData?.displayState ?? 'FREE';
  const paymentProblem =
    displayState === 'PAST_DUE' || displayState === 'UNPAID';
  const cancelScheduled = displayState === 'CANCEL_SCHEDULED';
  const downgradePending = displayState === 'DOWNGRADE_PENDING';
  const expiring = displayState === 'EXPIRING';
  // The server decides what is offered (plan §6); admin view-as hides every
  // action whatever the server sent, because it would act on the admin.
  const allowedActions: SubscriptionAction[] = viewing
    ? []
    : (subscriptionData?.allowedActions ?? []);
  const can = (action: SubscriptionAction): boolean =>
    allowedActions.includes(action);

  const fetchSubscription = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(
        withViewAsQuery('/api/subscription', viewing)
      );
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
  }, [viewing]);

  useEffect(() => {
    async function fetchInvoices(): Promise<void> {
      try {
        const response = await fetch(withViewAsQuery('/api/invoices', viewing));
        if (!response.ok) {
          throw new Error('Failed to fetch invoices');
        }
        const data = await response.json();
        setInvoices(
          data.invoices.map((invoice: Invoice & { currency?: string }) => ({
            id: invoice.id,
            date: invoice.date,
            amount: invoice.amount,
            currency: invoice.currency ?? 'USD',
            amountUsd: invoice.amountUsd ?? null,
            provider: invoice.provider,
            status: invoice.status,
            description: invoice.description,
            invoicePdfUrl: invoice.invoicePdfUrl,
            hostedInvoiceUrl: invoice.hostedInvoiceUrl,
            taxAmount: invoice.taxAmount,
            taxRate: invoice.taxRate,
            taxCountry: invoice.taxCountry,
            reverseCharge: invoice.reverseCharge,
          }))
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
        const response = await fetch(withViewAsQuery('/api/alerts', viewing));
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
  }, [fetchSubscription, viewing]);

  // Back from Stripe's card form (/settings/billing?done=card), from the
  // cancel page (?done=cancel) or from the change-plan page (?done=upgraded or
  // ?done=switch) or from the dLocal renewal (?done=renewed). Arriving here is
  // a full page load, so the fetch above
  // already re-read the subscription; this only says so and drops the marker
  // from the address bar.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const done = params.get('done');
    if (
      done !== 'card' &&
      done !== 'cancel' &&
      done !== 'upgraded' &&
      done !== 'switch' &&
      done !== 'renewed'
    ) {
      return;
    }
    setReturnedFrom(done);
    params.delete('done');
    const query = params.toString();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}`
    );
  }, []);

  // "Pay now" opens Stripe in another tab: look again when the user returns,
  // so a paid invoice clears the banner without a manual reload.
  useEffect(() => {
    if (!paymentProblem) return;
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') {
        void fetchSubscription();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [paymentProblem, fetchSubscription]);

  // W1: open Stripe's card form (and nothing else of Stripe's portal).
  const handleUpdateCard = async (): Promise<void> => {
    setOpeningCard(true);
    setCardError(null);
    try {
      const response = await fetch('/api/subscription/payment-method-session', {
        method: 'POST',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.url !== 'string') {
        throw new Error('Could not create the card update session');
      }
      const target = new URL(data.url);
      if (target.protocol !== 'https:') {
        throw new Error('Unexpected card update address');
      }
      // The button keeps its "opening" state: this page is about to be left.
      window.location.assign(target.toString());
    } catch {
      setCardError(
        t(
          'billing.error.card_session',
          'We could not open the card update page. Please try again.'
        )
      );
      setOpeningCard(false);
    }
  };

  // W4: withdraw a scheduled cancellation. One step that charges nothing, so a
  // confirm dialog and no page of its own.
  const handleResume = async (): Promise<void> => {
    setResuming(true);
    setResumeError(null);
    try {
      const response = await fetch('/api/subscription/resume', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Could not resume the subscription');
      }
      setResumeDialogOpen(false);
      setReturnedFrom('resumed');
      await fetchSubscription();
    } catch {
      setResumeError(
        t(
          'billing.error.resume',
          'We could not resume your subscription. Please try again.'
        )
      );
    } finally {
      setResuming(false);
    }
  };

  // W5b undo: withdraw the switch to monthly. One step that charges nothing, so
  // a confirm dialog and no page of its own.
  const handleKeepYearly = async (): Promise<void> => {
    setKeeping(true);
    setKeepError(null);
    try {
      const response = await fetch('/api/subscription/change-plan', {
        method: 'DELETE',
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        // Nothing left to withdraw (done in another tab, or the renewal
        // passed): the fresh read below shows what is true now.
        if (body?.code !== 'NOT_PENDING') {
          throw new Error('Could not keep the yearly plan');
        }
      }
      setKeepDialogOpen(false);
      setReturnedFrom('kept');
      await fetchSubscription();
    } catch {
      setKeepError(
        t(
          'billing.error.keep_yearly',
          'We could not keep your yearly plan. Please try again.'
        )
      );
    } finally {
      setKeeping(false);
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
  // The subscriber's own plan: its period and the price it was bought at
  // (existing subscribers keep theirs), else today's SystemConfig price.
  const isYearlyPlan = subscription?.planType === 'YEARLY';
  const planPriceUsd =
    subscription?.amountUsd ?? (isYearlyPlan ? annualPrice : regularPrice);
  // When a cancellation is scheduled: the date PRO ends (the end of the paid
  // period, or of the trial). The server sends Stripe's own date.
  const periodEndText = subscription?.currentPeriodEnd
    ? formatDate(subscription.currentPeriodEnd)
    : '';
  // When a switch to monthly is waiting: the renewal date it takes effect on.
  const pendingEffectiveAt =
    subscription?.pendingPlanChange?.effectiveAt ??
    subscription?.currentPeriodEnd ??
    null;
  const pendingText = pendingEffectiveAt ? formatDate(pendingEffectiveAt) : '';
  // A dLocal plan is prepaid (D8): no cancel, it just ends. Shown with the date.
  const prepaidEndsOn =
    userTier === 'PRO' && subscription?.provider === 'DLOCAL'
      ? (subscription.expiresAt ?? null)
      : null;
  const inTrial = trial?.status === 'ACTIVE' && Boolean(subscription?.trialEnd);
  // W6: where "Renew now" goes, and the date the dLocal plan ends.
  const renewHref = renewCheckoutHref(
    subscription?.planType,
    subscription?.dLocalCountry
  );
  const expiresText = subscription?.expiresAt
    ? formatDate(subscription.expiresAt)
    : '';

  return (
    <div className="animate-fade-in">
      <h2 className="mb-6 text-2xl font-bold text-foreground">
        {t('billing.title', 'Billing & Subscription')}
      </h2>

      {userRole === 'AFFILIATE' && (
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
            {!viewing && (
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
            )}
          </div>
        </div>
      )}

      {subscriptionError && (
        <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {subscriptionError}
        </div>
      )}

      {/* Status banner, first because a failed payment outranks everything
          else on this page (plan §8). PAST_DUE keeps PRO while Stripe retries;
          UNPAID has paused it. Both end the same way: pay the invoice, or fix
          the card. Buttons come from allowedActions, so they are absent in
          admin view. */}
      {paymentProblem && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">
                {displayState === 'UNPAID'
                  ? t('billing.banner.unpaid_title', 'Your PRO plan is paused')
                  : t(
                      'billing.banner.past_due_title',
                      'Your last payment failed'
                    )}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {displayState === 'UNPAID'
                  ? t(
                      'billing.banner.unpaid_body',
                      'We could not collect your last payment, so PRO is paused. Pay the open invoice to restore PRO right away, or update your card first.'
                    )
                  : t(
                      'billing.banner.past_due_body',
                      'Your PRO access continues while we retry the charge, but it ends if the payment is not completed. Pay the invoice now or update your card.'
                    )}
              </p>
              {(can('pay_now') || can('update_card')) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {can('pay_now') && subscription?.openInvoiceUrl && (
                    <Button asChild size="sm" variant="destructive">
                      <a
                        href={subscription.openInvoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t('billing.action.pay_now', 'Pay now')}
                      </a>
                    </Button>
                  )}
                  {can('update_card') && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={openingCard}
                      onClick={() => void handleUpdateCard()}
                    >
                      {openingCard ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t(
                            'billing.action.opening_stripe',
                            'Opening Stripe...'
                          )}
                        </>
                      ) : (
                        t('billing.action.update_card', 'Update card')
                      )}
                    </Button>
                  )}
                </div>
              )}
              {cardError && (
                <p className="mt-3 text-sm text-destructive">{cardError}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status banner for a scheduled cancellation (W3). PRO continues until
          the date shown; "Resume" is drawn from allowedActions, so it is
          absent in admin view and after the period has ended. */}
      {cancelScheduled && (
        <div
          role="status"
          className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20"
        >
          <div className="flex items-start gap-3">
            <Clock
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-amber-900 dark:text-amber-100">
                {t(
                  'billing.banner.cancel_scheduled_title',
                  'Your PRO plan ends on {date}'
                ).replace('{date}', periodEndText)}
              </p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                {inTrial
                  ? t(
                      'billing.banner.cancel_scheduled_trial_body',
                      'Your free trial ends then and you will not be charged. Changed your mind? Resume your subscription and it continues as planned.'
                    )
                  : t(
                      'billing.banner.cancel_scheduled_body',
                      'You keep full PRO access until then and you will not be charged again. Changed your mind? Resume your subscription and nothing changes.'
                    )}
              </p>
              {can('resume') && (
                <div className="mt-3">
                  <Button size="sm" onClick={() => setResumeDialogOpen(true)}>
                    {t('billing.action.resume', 'Resume subscription')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status banner for a switch to monthly billing waiting for the renewal
          date (W5b). The yearly plan carries on until then; "Keep yearly" is
          drawn from allowedActions, so it is absent in admin view. */}
      {downgradePending && (
        <div
          role="status"
          className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-900/20"
        >
          <div className="flex items-start gap-3">
            <Clock
              className="mt-0.5 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-300"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-blue-900 dark:text-blue-100">
                {t(
                  'billing.banner.switch_pending_title',
                  'Your plan switches to monthly billing on {date}'
                ).replace('{date}', pendingText)}
              </p>
              <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">
                {t(
                  'billing.banner.switch_pending_body',
                  'You keep your yearly PRO access until then. Nothing is charged or refunded now, and from {date} you pay the monthly price.'
                ).replace('{date}', pendingText)}
              </p>
              {can('keep_yearly') && (
                <div className="mt-3">
                  <Button size="sm" onClick={() => setKeepDialogOpen(true)}>
                    {t('billing.action.keep_yearly', 'Keep yearly')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status banner for a dLocal plan close to its end (W6). Nothing renews
          by itself, so the way to keep PRO is to pay again; "Renew now" is
          drawn from allowedActions, so it is absent in admin view. */}
      {expiring && (
        <div
          role="status"
          className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20"
        >
          <div className="flex items-start gap-3">
            <Clock
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-amber-900 dark:text-amber-100">
                {t(
                  'billing.banner.expiring_title',
                  'Your plan expires on {date}'
                ).replace('{date}', expiresText)}
              </p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                {t(
                  'billing.banner.expiring_body',
                  'Renew now to keep your PRO features. The days you have left are added to the new period.'
                )}
              </p>
              {can('renew_now') && (
                <div className="mt-3">
                  <Button asChild size="sm">
                    <Link href={renewHref}>
                      {t('billing.action.renew_now', 'Renew now')}
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {returnedFrom === 'card' && (
        <div
          role="status"
          className="mb-6 rounded-lg border border-border bg-muted/40 p-4 text-sm text-foreground"
        >
          {paymentProblem
            ? t(
                'billing.notice.card_done_overdue',
                'Back from Stripe. Your latest card details are shown below. The overdue payment is retried automatically, or you can pay it now.'
              )
            : t(
                'billing.notice.card_done',
                'Back from Stripe. Your latest card details are shown below.'
              )}
        </div>
      )}

      {/* Said only when the fresh data agrees, so a hand-typed ?done=cancel
          cannot claim a cancellation that does not exist. */}
      {returnedFrom === 'cancel' && cancelScheduled && (
        <div
          role="status"
          className="mb-6 rounded-lg border border-border bg-muted/40 p-4 text-sm text-foreground"
        >
          {t(
            'billing.notice.cancel_scheduled',
            'Your cancellation is scheduled. You keep PRO until {date}, and you can resume before then.'
          ).replace('{date}', periodEndText)}
        </div>
      )}

      {returnedFrom === 'resumed' && !cancelScheduled && (
        <div
          role="status"
          className="mb-6 rounded-lg border border-border bg-muted/40 p-4 text-sm text-foreground"
        >
          {t(
            'billing.notice.resumed',
            'Your subscription will continue. PRO renews as normal.'
          )}
        </div>
      )}

      {/* Said only when the fresh data agrees, so a hand-typed marker cannot
          claim a change that did not happen. */}
      {returnedFrom === 'upgraded' && isYearlyPlan && (
        <div
          role="status"
          className="mb-6 rounded-lg border border-border bg-muted/40 p-4 text-sm text-foreground"
        >
          {t(
            'billing.notice.upgraded',
            'You are now on the yearly plan. Thank you!'
          )}
        </div>
      )}

      {returnedFrom === 'switch' && downgradePending && (
        <div
          role="status"
          className="mb-6 rounded-lg border border-border bg-muted/40 p-4 text-sm text-foreground"
        >
          {t(
            'billing.notice.switch_scheduled',
            'Your plan will switch to monthly billing on {date}. You keep yearly PRO access until then.'
          ).replace('{date}', pendingText)}
        </div>
      )}

      {/* Said only when the fresh data agrees: a dLocal plan that is PRO and
          no longer close to its end. */}
      {returnedFrom === 'renewed' && prepaidEndsOn && !expiring && (
        <div
          role="status"
          className="mb-6 rounded-lg border border-border bg-muted/40 p-4 text-sm text-foreground"
        >
          {t(
            'billing.notice.renewed',
            'Your plan has been renewed. PRO now runs until {date}.'
          ).replace('{date}', formatDate(prepaidEndsOn))}
        </div>
      )}

      {returnedFrom === 'kept' && !downgradePending && (
        <div
          role="status"
          className="mb-6 rounded-lg border border-border bg-muted/40 p-4 text-sm text-foreground"
        >
          {t(
            'billing.notice.keep_yearly_done',
            'Your plan stays yearly. The scheduled switch was withdrawn.'
          )}
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
        <div className="mb-6 rounded-lg border border-border bg-muted/40 p-4">
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
            ? 'mb-8 border-2 border-primary/40 bg-primary/5'
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
            {paymentProblem ? (
              <Badge variant="destructive">
                {displayState === 'UNPAID'
                  ? t('billing.status.unpaid', 'PRO paused')
                  : t('billing.status.past_due', 'Payment overdue')}
              </Badge>
            ) : cancelScheduled ? (
              <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                {t('billing.status.cancel_scheduled', 'Cancellation scheduled')}
              </Badge>
            ) : downgradePending ? (
              <Badge className="bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200">
                {t('billing.status.switch_pending', 'Switching to monthly')}
              </Badge>
            ) : expiring ? (
              <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                {t('billing.status.expiring', 'Expires soon')}
              </Badge>
            ) : (
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                {t('Active')}
              </Badge>
            )}
          </div>

          <h3 className="mb-2 text-2xl font-bold text-foreground">
            {userTier === 'PRO'
              ? t('billing.pro_plan', 'Pro Plan')
              : t('billing.free_plan', 'Free Plan')}
          </h3>

          <div className="mb-4 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-foreground">
              {userTier === 'PRO'
                ? formatCurrency(planPriceUsd)
                : formatCurrency(0)}
            </span>
            <span className="text-muted-foreground">
              /
              {userTier === 'PRO' && isYearlyPlan
                ? t('billing.year', 'year')
                : t('billing.month', 'month')}
            </span>
          </div>
          {userTier === 'PRO' && displayCurrency !== 'USD' && (
            <p className="-mt-2 mb-4 text-xs text-muted-foreground">
              {t(
                'billing.price_indicative_note',
                'Approximate price in {currency}. The plan is priced at {usdPrice} USD; the amount you pay depends on the exchange rate of your payment method.'
              )
                .replace('{currency}', displayCurrency)
                .replace(
                  '{usdPrice}',
                  formatChargedAmount(planPriceUsd, 'USD', language)
                )}
            </p>
          )}

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

          {/* Action row -- drawn from the server's allowedActions. FREE tier
              shows a real re-subscribe path to /pricing, including
              immediately after a cancel below, EXCEPT while a failed payment
              is waiting: that user must pay the open invoice (the banner
              above), not start a second subscription. */}
          {viewing ? (
            <p className="text-sm italic text-muted-foreground">
              {t(
                'admin.user_view_as.billing_actions_hidden',
                'Plan actions are hidden in admin view. They would apply to your own account, not this user.'
              )}
            </p>
          ) : userTier === 'FREE' ? (
            paymentProblem ? null : (
              <Link href="/pricing">
                <Button>
                  {t('billing.upgrade_to_pro', 'Upgrade to PRO')}
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )
          ) : can('cancel') ||
            can('resume') ||
            can('keep_yearly') ||
            can('upgrade_to_yearly') ||
            can('switch_to_monthly') ||
            can('renew_now') ||
            prepaidEndsOn ? (
            <div className="flex flex-wrap items-center gap-3">
              {can('resume') && (
                <Button onClick={() => setResumeDialogOpen(true)}>
                  {t('billing.action.resume', 'Resume subscription')}
                </Button>
              )}
              {can('keep_yearly') && (
                <Button onClick={() => setKeepDialogOpen(true)}>
                  {t('billing.action.keep_yearly', 'Keep yearly')}
                </Button>
              )}
              {can('renew_now') && (
                <Button asChild>
                  <Link href={renewHref}>
                    {t('billing.action.renew_now', 'Renew now')}
                  </Link>
                </Button>
              )}
              {(can('upgrade_to_yearly') || can('switch_to_monthly')) && (
                <Button asChild variant="outline">
                  <Link href="/settings/billing/change-plan">
                    {t('billing.action.change_period', 'Change billing period')}
                  </Link>
                </Button>
              )}
              {can('cancel') && (
                <Button
                  asChild
                  variant="ghost"
                  className="text-red-600 hover:text-red-700"
                >
                  <Link href="/settings/billing/cancel">
                    {t('billing.cancel_plan', 'Cancel Plan')}
                  </Link>
                </Button>
              )}
              {prepaidEndsOn && (
                <p className="text-sm text-muted-foreground">
                  {t(
                    'billing.dlocal_prepaid_note',
                    'This plan is prepaid. It ends on {date} and does not renew automatically.'
                  ).replace('{date}', formatDate(prepaidEndsOn))}
                </p>
              )}
            </div>
          ) : null}

          {userTier === 'PRO' && subscription?.currentPeriodEnd && (
            <p className="mt-4 text-sm text-muted-foreground">
              {cancelScheduled
                ? t('billing.ends_on', 'PRO ends on:')
                : t('billing.next_billing_date', 'Next billing date:')}{' '}
              {formatDate(subscription.currentPeriodEnd)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* W4: confirm before withdrawing the cancellation. Opened from the
          banner and from the plan card; nothing is charged by resuming. */}
      <AlertDialog
        open={resumeDialogOpen}
        onOpenChange={(open) => {
          setResumeDialogOpen(open);
          if (!open) setResumeError(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('billing.resume.title', 'Resume your subscription?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'billing.resume.body',
                'Your cancellation will be withdrawn and your PRO subscription will continue. Next billing date: {date}.'
              ).replace('{date}', periodEndText)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {resumeError && (
            <p role="alert" className="text-sm text-destructive">
              {resumeError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resuming}>
              {t('billing.resume.dismiss', 'Not now')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={resuming}
              onClick={(e) => {
                e.preventDefault();
                void handleResume();
              }}
            >
              {resuming
                ? t('billing.action.resuming', 'Resuming...')
                : t('billing.resume.confirm', 'Yes, resume')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* W5b undo: confirm before withdrawing the switch to monthly. Opened
          from the banner and from the plan card; nothing is charged by it. */}
      <AlertDialog
        open={keepDialogOpen}
        onOpenChange={(open) => {
          setKeepDialogOpen(open);
          if (!open) setKeepError(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('billing.keep_yearly.title', 'Keep yearly billing?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'billing.keep_yearly.body',
                'The switch to monthly billing will be withdrawn and your plan will renew yearly on {date}.'
              ).replace('{date}', pendingText)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {keepError && (
            <p role="alert" className="text-sm text-destructive">
              {keepError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={keeping}>
              {t('billing.keep_yearly.dismiss', 'Not now')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={keeping}
              onClick={(e) => {
                e.preventDefault();
                void handleKeepYearly();
              }}
            >
              {keeping
                ? t('billing.action.keeping_yearly', 'Keeping yearly...')
                : t('billing.keep_yearly.confirm', 'Yes, keep yearly')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Method -- also for UNPAID (tier FREE), where the card is
          exactly what has to be fixed; the API sends `subscription` only for
          PRO or a failed payment. */}
      {subscription && (
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
                {subscription.provider === 'STRIPE' && can('update_card') && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={openingCard}
                    onClick={() => void handleUpdateCard()}
                  >
                    {openingCard ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t(
                          'billing.action.opening_stripe',
                          'Opening Stripe...'
                        )}
                      </>
                    ) : (
                      t('billing.action.update_card', 'Update card')
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
            {/* The banner shows this error while a payment is failed. */}
            {cardError && !paymentProblem && (
              <p className="mt-2 text-sm text-destructive">{cardError}</p>
            )}
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

      {/* Invoice History -- also shown to a FREE user who has paid before
          (e.g. after cancelling), so past receipts stay downloadable. */}
      {(userTier === 'PRO' || invoices.length > 0) && (
        <section className="mb-8">
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
                <InvoiceList
                  invoices={invoices.slice(0, visibleInvoiceCount)}
                  isLoading={invoicesLoading}
                  totalCount={invoices.length}
                  hasMore={visibleInvoiceCount < invoices.length}
                  onLoadMore={() =>
                    setVisibleInvoiceCount((n) => n + INVOICE_PAGE_SIZE)
                  }
                  onShowAll={() => setVisibleInvoiceCount(invoices.length)}
                />
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* Upgrade Prompt for FREE users (not in admin view: marketing only) */}
      {userTier === 'FREE' && !viewing && !paymentProblem && (
        <Card className="border-0 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
          <CardContent className="p-6">
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <div className="text-4xl">🚀</div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="mb-2 text-xl font-bold">
                  {t('billing.unlock_more_with_pro', 'Unlock More with PRO')}
                </h3>
                <p className="mb-4 opacity-90">
                  {t(
                    'billing.upgrade_prompt',
                    'Get 100 price alerts, drawing engine line alerts, multi-timeframe visualization, and priority support for just {price}/month.'
                  ).replace('{price}', formatCurrency(regularPrice))}
                </p>
                <Link href="/pricing">
                  <Button className="bg-white font-semibold text-zinc-900 hover:bg-white/90">
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
