'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useUserViewAs } from '@/components/admin/user-view-as/user-view-as-context';
import { formatChargedAmount } from '@/lib/billing/invoice-amounts';
import { useLocale } from '@/lib/context/locale-context';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';
import type {
  SubscriptionAction,
  SubscriptionDisplayState,
} from '@/lib/stripe/subscription-actions';

/**
 * Change billing period (Manage Subscription S3, workflows W5a and W5b).
 *
 * The only multi-step money confirmation besides cancelling, so it has a page
 * of its own (plan §8):
 * - Monthly to yearly happens NOW, with proration (D2). The page asks the server
 *   for a quote (GET /api/subscription/change-plan/preview), shows the
 *   calculation, and confirms with the quote's time so the charge equals the
 *   amount shown. A declined card or a 3-D Secure request means the switch is
 *   not made and nothing is charged (E2); in a free trial nothing is charged
 *   now at all (E3).
 * - Yearly to monthly happens at the RENEWAL, with no refund and no credit.
 *   Nothing is charged or refunded when it is scheduled; it can be undone with
 *   "Keep yearly" on /settings/billing.
 * Which of the two is offered is the server's `allowedActions`, so a failed
 * payment, a scheduled cancellation, a pending switch and a dLocal plan get an
 * explanation instead. Prices are the SystemConfig prices (D3), never typed in.
 */

/** Answers that mean "the situation changed; look again". */
const STATE_CHANGED_CODES = new Set([
  'ACTION_NOT_ALLOWED',
  'ALREADY_PENDING',
  'NO_SUBSCRIPTION',
  'NO_STRIPE_SUBSCRIPTION',
  'DLOCAL_NO_CHANGE',
  'UNSUPPORTED_SUBSCRIPTION',
]);

/** Answers that mean "the quote is out of date; fetch it again". */
const QUOTE_STALE_CODES = new Set([
  'PRORATION_EXPIRED',
  'INVALID_PRORATION_DATE',
  'PRICE_CHANGED',
]);

interface SubscriptionData {
  tier: 'FREE' | 'PRO';
  allowedActions?: SubscriptionAction[];
  displayState?: SubscriptionDisplayState;
  subscription: {
    provider: 'STRIPE' | 'DLOCAL' | null;
    planType: string | null;
    currentPeriodEnd: string | null;
    expiresAt: string | null;
    pendingPlanChange?: {
      planType: 'MONTHLY';
      effectiveAt: string | null;
    } | null;
  } | null;
}

interface Quote {
  amountDueNowUsd: number;
  prorationDate: number;
  renewsOn: string | null;
  yearlyPriceUsd: number;
  creditUsd: number;
  taxUsd: number;
  inTrial: boolean;
}

type Panel = 'none' | 'upgrade' | 'downgrade';

export default function ChangePlanPage(): React.ReactElement {
  const router = useRouter();
  const viewing = useUserViewAs() !== null;
  const { t, formatDate, formatCurrency, language, currency } = useLocale();
  const displayCurrency = (currency || 'GBP').toUpperCase();
  const {
    regularPrice,
    annualPrice,
    isLoading: pricesLoading,
    config,
  } = useAffiliateConfig();

  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [panel, setPanel] = useState<Panel>('none');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const panelHeadingRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/subscription');
      if (!response.ok) throw new Error('Failed to fetch subscription');
      setData((await response.json()) as SubscriptionData);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Opening a panel puts keyboard and screen-reader focus on its heading,
  // which also brings it into view below the plan cards.
  useEffect(() => {
    if (panel !== 'none') panelHeadingRef.current?.focus();
  }, [panel]);

  /** The situation changed under the user: show what is true now. */
  const resetToCurrentState = useCallback(async (): Promise<void> => {
    setPanel('none');
    setQuote(null);
    setSubmitError(null);
    setNotice(null);
    await load();
  }, [load]);

  const fetchQuote = useCallback(async (): Promise<void> => {
    setQuoteLoading(true);
    setQuoteError(false);
    try {
      const response = await fetch(
        '/api/subscription/change-plan/preview?billingPeriod=yearly'
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (STATE_CHANGED_CODES.has(body?.code)) {
          await resetToCurrentState();
          return;
        }
        throw new Error('Could not get the quote');
      }
      setQuote((await response.json()) as Quote);
    } catch {
      setQuote(null);
      setQuoteError(true);
    } finally {
      setQuoteLoading(false);
    }
  }, [resetToCurrentState]);

  const openUpgrade = (): void => {
    setSubmitError(null);
    setNotice(null);
    setQuote(null);
    setPanel('upgrade');
    void fetchQuote();
  };

  const openDowngrade = (): void => {
    setSubmitError(null);
    setNotice(null);
    setPanel('downgrade');
  };

  const closePanel = (): void => {
    setPanel('none');
    setQuote(null);
    setQuoteError(false);
    setSubmitError(null);
    setNotice(null);
  };

  const genericError = (): string =>
    t(
      'billing.change_plan.error.generic',
      'We could not change your plan. Nothing was charged. Please try again.'
    );

  const confirmUpgrade = async (): Promise<void> => {
    if (!quote) return;
    setSubmitting(true);
    setSubmitError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/subscription/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingPeriod: 'yearly',
          prorationDate: quote.prorationDate,
          expectedYearlyPriceUsd: quote.yearlyPriceUsd,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const code = body?.code as string | undefined;
        if (code === 'PAYMENT_FAILED') {
          // E2: the switch was not made and nothing was charged.
          setSubmitError(
            t(
              'billing.change_plan.error.payment_failed',
              'Your card was not charged and you are still on the monthly plan. Update your card or try another one.'
            )
          );
          // The quote's time is part of the charge's idempotency key, so Stripe
          // would replay this same refusal for the same quote: a fresh quote
          // makes the next attempt a new one.
          await fetchQuote();
          return;
        }
        if (code && QUOTE_STALE_CODES.has(code)) {
          setNotice(
            code === 'PRICE_CHANGED'
              ? t(
                  'billing.change_plan.error.price_changed',
                  'The price has changed, so we updated the amounts. Please check them and confirm again.'
                )
              : t(
                  'billing.change_plan.error.expired',
                  'The quote was out of date, so we updated it. Please check the amount and confirm again.'
                )
          );
          await fetchQuote();
          return;
        }
        if (code && STATE_CHANGED_CODES.has(code)) {
          await resetToCurrentState();
          return;
        }
        throw new Error('Could not change the plan');
      }
      router.push('/settings/billing?done=upgraded');
    } catch {
      setSubmitError(genericError());
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDowngrade = async (): Promise<void> => {
    setSubmitting(true);
    setSubmitError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/subscription/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingPeriod: 'monthly',
          // Only when the price shown came from the server's configuration.
          ...(config ? { expectedMonthlyPriceUsd: regularPrice } : {}),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const code = body?.code as string | undefined;
        if (code === 'PRICE_CHANGED') {
          setNotice(
            t(
              'billing.change_plan.error.price_changed',
              'The price has changed, so we updated the amounts. Please check them and confirm again.'
            )
          );
          return;
        }
        if (code && STATE_CHANGED_CODES.has(code)) {
          await resetToCurrentState();
          return;
        }
        throw new Error('Could not schedule the switch');
      }
      router.push('/settings/billing?done=switch');
    } catch {
      setSubmitError(genericError());
    } finally {
      setSubmitting(false);
    }
  };

  const backToBilling = (
    <Button asChild variant="outline">
      <Link href="/settings/billing">
        {t('billing.change_plan.back', 'Back to billing')}
      </Link>
    </Button>
  );

  const title = (
    <h2 className="mb-2 text-2xl font-bold text-foreground">
      {t('billing.change_plan.title', 'Change billing period')}
    </h2>
  );

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (viewing) {
    // The settings layout already replaces this page in admin view; this is the
    // belt to its braces, because changing the plan would act on the admin's
    // own account.
    return (
      <div className="animate-fade-in">
        {title}
        <p className="mb-6 text-sm italic text-muted-foreground">
          {t(
            'admin.user_view_as.billing_actions_hidden',
            'Plan actions are hidden in admin view. They would apply to your own account, not this user.'
          )}
        </p>
        {backToBilling}
      </div>
    );
  }

  if (loadError || data === null) {
    return (
      <div className="animate-fade-in">
        {title}
        <p role="alert" className="mb-6 text-sm text-destructive">
          {genericError()}
        </p>
        {backToBilling}
      </div>
    );
  }

  const subscription = data.subscription;
  const allowed = data.allowedActions ?? [];
  const canUpgrade = allowed.includes('upgrade_to_yearly');
  const canDowngrade = allowed.includes('switch_to_monthly');
  const pending = subscription?.pendingPlanChange ?? null;

  if (!canUpgrade && !canDowngrade) {
    const state = data.displayState ?? 'FREE';
    let reason: string;
    if (state === 'PAST_DUE' || state === 'UNPAID') {
      reason = t(
        'billing.change_plan.unavailable.payment_first',
        'Your last payment needs attention first. Pay the open invoice or update your card on the billing page, then you can change your billing period.'
      );
    } else if (state === 'CANCEL_SCHEDULED') {
      reason = t(
        'billing.change_plan.unavailable.cancel_scheduled',
        'Your cancellation is scheduled. Resume your subscription on the billing page first, then you can change your billing period.'
      );
    } else if (state === 'DOWNGRADE_PENDING' && pending) {
      reason = t(
        'billing.change_plan.unavailable.pending',
        'Your plan is already set to switch to monthly billing on {date}. To stay on yearly billing, use "Keep yearly" on the billing page.'
      ).replace(
        '{date}',
        pending.effectiveAt
          ? formatDate(pending.effectiveAt)
          : subscription?.currentPeriodEnd
            ? formatDate(subscription.currentPeriodEnd)
            : ''
      );
    } else if (subscription?.provider === 'DLOCAL') {
      reason = t(
        'billing.change_plan.unavailable.prepaid',
        'Your plan is prepaid. You choose the billing period each time you renew it.'
      );
    } else {
      reason = t(
        'billing.change_plan.unavailable.generic',
        'You do not have a PRO subscription whose billing period can be changed.'
      );
    }
    return (
      <div className="animate-fade-in">
        {title}
        <Card className="mb-6 mt-4 border-2 border-border">
          <CardContent className="p-6">
            <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-foreground">
              <AlertTriangle
                className="h-5 w-5 text-amber-600"
                aria-hidden="true"
              />
              {t(
                'billing.change_plan.unavailable_title',
                'Changing the billing period is not available right now'
              )}
            </h3>
            <p className="text-sm text-muted-foreground">{reason}</p>
          </CardContent>
        </Card>
        {backToBilling}
      </div>
    );
  }

  const isYearlyNow = subscription?.planType === 'YEARLY';
  const yearlySavings =
    Math.round((regularPrice * 12 - annualPrice) * 100) / 100;
  const usd = (amount: number): string =>
    formatChargedAmount(amount, 'USD', language);
  const notUsd = displayCurrency !== 'USD';

  const planCard = (
    which: 'monthly' | 'yearly',
    cta: { label: string; onClick: () => void } | null
  ): React.ReactElement => {
    const current = (which === 'yearly') === isYearlyNow;
    const price = which === 'yearly' ? annualPrice : regularPrice;
    return (
      <Card
        className={
          current
            ? 'border-2 border-primary/40 bg-primary/5'
            : 'border-2 border-border'
        }
        data-testid={`plan-card-${which}`}
      >
        <CardContent className="flex h-full flex-col p-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-foreground">
              {which === 'yearly'
                ? t('billing.change_plan.yearly_plan', 'Yearly')
                : t('billing.change_plan.monthly_plan', 'Monthly')}
            </h3>
            {current && (
              <Badge className="bg-primary text-primary-foreground">
                {t('billing.change_plan.current_badge', 'Current plan')}
              </Badge>
            )}
          </div>
          <div className="mb-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">
              {pricesLoading ? '…' : formatCurrency(price)}
            </span>
            <span className="text-muted-foreground">
              /
              {which === 'yearly'
                ? t('billing.year', 'year')
                : t('billing.month', 'month')}
            </span>
          </div>
          {which === 'yearly' && yearlySavings > 0 && !pricesLoading && (
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <Check className="h-4 w-4" aria-hidden="true" />
              {t(
                'billing.change_plan.save',
                'Save {amount} a year compared with paying monthly'
              ).replace('{amount}', formatCurrency(yearlySavings))}
            </p>
          )}
          {notUsd && !pricesLoading && (
            <p className="mb-2 text-xs text-muted-foreground">
              {t(
                'billing.price_indicative_note',
                'Approximate price in {currency}. The plan is priced at {usdPrice} USD; the amount you pay depends on the exchange rate of your payment method.'
              )
                .replace('{currency}', displayCurrency)
                .replace('{usdPrice}', usd(price))}
            </p>
          )}
          <div className="mt-auto pt-4">
            {cta && (
              <Button
                onClick={cta.onClick}
                disabled={pricesLoading || submitting}
                variant={which === 'yearly' ? 'default' : 'outline'}
              >
                {cta.label}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renewalText = (iso: string | null): string =>
    iso
      ? formatDate(iso)
      : subscription?.currentPeriodEnd
        ? formatDate(subscription.currentPeriodEnd)
        : '';

  const upgradePanel = (
    <Card
      className="mt-6 border-2 border-primary/40"
      data-testid="upgrade-panel"
    >
      <CardContent className="p-6">
        <h3
          ref={panelHeadingRef}
          tabIndex={-1}
          className="mb-4 text-xl font-semibold text-foreground outline-none"
        >
          {t('billing.change_plan.upgrade.title', 'Upgrade to yearly billing')}
        </h3>

        {quoteLoading && (
          <p
            className="flex items-center gap-2 text-sm text-muted-foreground"
            role="status"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t(
              'billing.change_plan.upgrade.loading',
              'Calculating your charge...'
            )}
          </p>
        )}

        {!quoteLoading && quoteError && (
          <div>
            <p role="alert" className="mb-4 text-sm text-destructive">
              {t(
                'billing.change_plan.upgrade.error',
                'We could not calculate the charge. Please try again.'
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void fetchQuote()}>
                {t('billing.change_plan.try_again', 'Try again')}
              </Button>
              <Button variant="ghost" onClick={closePanel}>
                {t('billing.change_plan.not_now', 'Not now')}
              </Button>
            </div>
          </div>
        )}

        {!quoteLoading && quote && (
          <div>
            {quote.inTrial ? (
              <p className="mb-4 text-sm text-foreground">
                {t(
                  'billing.change_plan.upgrade.trial',
                  'Your free trial continues and nothing is charged today. Your first charge, at the yearly price of {price}, is on {date}.'
                )
                  .replace('{price}', usd(quote.yearlyPriceUsd))
                  .replace('{date}', renewalText(quote.renewsOn))}
              </p>
            ) : (
              <>
                <p className="mb-4 text-sm text-muted-foreground">
                  {t(
                    'billing.change_plan.upgrade.explain',
                    'Your yearly plan starts today. You pay the yearly price minus a credit for the days of your current month that you have not used.'
                  )}
                </p>
                <dl className="mb-4 divide-y divide-border rounded-lg border border-border text-sm">
                  <div className="flex items-center justify-between gap-4 p-3">
                    <dt className="text-foreground">
                      {t('billing.change_plan.upgrade.row_plan', 'Yearly plan')}
                    </dt>
                    <dd className="font-medium text-foreground">
                      {usd(quote.yearlyPriceUsd)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 p-3">
                    <dt className="text-foreground">
                      {t(
                        'billing.change_plan.upgrade.row_credit',
                        'Credit for the unused part of your monthly plan'
                      )}
                    </dt>
                    <dd className="font-medium text-emerald-700 dark:text-emerald-400">
                      {`−${usd(quote.creditUsd)}`}
                    </dd>
                  </div>
                  {quote.taxUsd > 0 && (
                    <div className="flex items-center justify-between gap-4 p-3">
                      <dt className="text-foreground">
                        {t('billing.change_plan.upgrade.row_tax', 'Tax')}
                      </dt>
                      <dd className="font-medium text-foreground">
                        {usd(quote.taxUsd)}
                      </dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-4 bg-muted/40 p-3">
                    <dt className="font-semibold text-foreground">
                      {t(
                        'billing.change_plan.upgrade.row_due',
                        'Charged today'
                      )}
                    </dt>
                    <dd
                      className="text-lg font-bold text-foreground"
                      data-testid="amount-due"
                    >
                      {usd(quote.amountDueNowUsd)}
                    </dd>
                  </div>
                </dl>
                <p className="mb-2 text-sm text-foreground">
                  {t(
                    'billing.change_plan.upgrade.renews',
                    'Your plan then renews yearly on {date}.'
                  ).replace('{date}', renewalText(quote.renewsOn))}
                </p>
              </>
            )}
            <p className="mb-2 text-xs text-muted-foreground">
              {t(
                'billing.change_plan.upgrade.card_note',
                'If your card is declined or needs extra verification, the switch is not made and you are not charged.'
              )}
            </p>
            <p className="mb-4 text-xs text-muted-foreground">
              {t(
                'billing.change_plan.upgrade.usd_note',
                'You are charged in US dollars. Your bank converts the amount at its own exchange rate.'
              )}
            </p>

            {notice && (
              <p role="status" className="mb-4 text-sm text-foreground">
                {notice}
              </p>
            )}
            {submitError && (
              <p role="alert" className="mb-4 text-sm text-destructive">
                {submitError}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void confirmUpgrade()}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    {t(
                      'billing.change_plan.upgrade.confirming',
                      'Processing...'
                    )}
                  </>
                ) : quote.inTrial ? (
                  t(
                    'billing.change_plan.upgrade.confirm_trial',
                    'Confirm upgrade'
                  )
                ) : (
                  t(
                    'billing.change_plan.upgrade.confirm',
                    'Confirm and pay {amount}'
                  ).replace('{amount}', usd(quote.amountDueNowUsd))
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={closePanel}
                disabled={submitting}
              >
                {t('billing.change_plan.not_now', 'Not now')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const downgradePanel = (
    <Card
      className="mt-6 border-2 border-primary/40"
      data-testid="downgrade-panel"
    >
      <CardContent className="p-6">
        <h3
          ref={panelHeadingRef}
          tabIndex={-1}
          className="mb-4 text-xl font-semibold text-foreground outline-none"
        >
          {t(
            'billing.change_plan.downgrade.title',
            'Switch to monthly billing'
          )}
        </h3>
        <p className="mb-2 text-sm text-foreground">
          {t(
            'billing.change_plan.downgrade.body',
            'From {date} you will be billed {price} a month. You keep your yearly PRO access until then.'
          )
            .replace('{date}', renewalText(null))
            .replace('{price}', usd(regularPrice))}
        </p>
        <p className="mb-2 text-sm text-muted-foreground">
          {t(
            'billing.change_plan.downgrade.no_refund',
            'There is no refund and no credit for the current year, and nothing is charged now.'
          )}
        </p>
        <p className="mb-4 text-sm text-muted-foreground">
          {t(
            'billing.change_plan.downgrade.undo',
            'You can keep yearly billing any time before {date}.'
          ).replace('{date}', renewalText(null))}
        </p>

        {notice && (
          <p role="status" className="mb-4 text-sm text-foreground">
            {notice}
          </p>
        )}
        {submitError && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {submitError}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void confirmDowngrade()} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                {t('billing.change_plan.downgrade.confirming', 'Scheduling...')}
              </>
            ) : (
              t(
                'billing.change_plan.downgrade.confirm',
                'Confirm switch to monthly'
              )
            )}
          </Button>
          <Button variant="ghost" onClick={closePanel} disabled={submitting}>
            {t('billing.change_plan.not_now', 'Not now')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="animate-fade-in">
      {title}
      <p className="mb-6 text-sm text-muted-foreground">
        {t(
          'billing.change_plan.subtitle',
          'Pick how you pay for PRO. Your PRO features stay the same.'
        )}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {planCard(
          'monthly',
          canDowngrade
            ? {
                label: t(
                  'billing.change_plan.downgrade_cta',
                  'Switch to monthly'
                ),
                onClick: openDowngrade,
              }
            : null
        )}
        {planCard(
          'yearly',
          canUpgrade
            ? {
                label: t(
                  'billing.change_plan.upgrade_cta',
                  'Upgrade to yearly'
                ),
                onClick: openUpgrade,
              }
            : null
        )}
      </div>

      {panel === 'upgrade' && upgradePanel}
      {panel === 'downgrade' && downgradePanel}

      <div className="mt-6">{backToBilling}</div>
    </div>
  );
}
