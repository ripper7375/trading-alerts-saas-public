'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Loader2, Minus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useUserViewAs } from '@/components/admin/user-view-as/user-view-as-context';
import { useLocale } from '@/lib/context/locale-context';
import {
  CANCELLATION_REASON_MAX,
  type SubscriptionAction,
  type SubscriptionDisplayState,
} from '@/lib/stripe/subscription-actions';

/**
 * Cancel subscription (Manage Subscription S2, workflow W3).
 *
 * Three steps, because cancelling is the one irreversible-feeling money action
 * of the page and the user should see what they keep before they decide:
 *   1. what happens: PRO continues until the end of the paid period (the trial
 *      ends then, with no charge) and which features pause after it;
 *   2. why (optional): the reason is sent with the request (B6);
 *   3. confirm.
 * Nothing is cancelled until step 3 posts to POST /api/subscription/cancel,
 * which cancels at the END of the period (D1); the user can resume until then
 * from /settings/billing. Whether the user may cancel at all is decided by the
 * server's `allowedActions`, so a dLocal plan (D8), a failed payment or an
 * already scheduled cancellation get an explanation instead of the steps.
 */

/** The reason codes the form offers; the labels reuse the billing keys. */
const REASONS = [
  ['too_expensive', 'billing.reason.too_expensive', 'Too expensive'],
  ['not_using', 'billing.reason.not_using', 'Not using enough'],
  ['missing_features', 'billing.reason.missing_features', 'Missing features'],
  ['switching', 'billing.reason.switching', 'Switching to competitor'],
  ['other', 'billing.reason.other', 'Other'],
] as const;

/** "other: " plus the user's words must fit the server's limit. */
const OTHER_PREFIX = 'other: ';
const OTHER_TEXT_MAX = CANCELLATION_REASON_MAX - OTHER_PREFIX.length;

const TOTAL_STEPS = 3;

/** Answers that mean "the situation changed; look again". */
const STATE_CHANGED_CODES = new Set([
  'ALREADY_SCHEDULED',
  'ACTION_NOT_ALLOWED',
  'NO_SUBSCRIPTION',
  'DLOCAL_NO_CANCEL',
]);

interface SubscriptionData {
  tier: 'FREE' | 'PRO';
  allowedActions?: SubscriptionAction[];
  displayState?: SubscriptionDisplayState;
  subscription: {
    provider: 'STRIPE' | 'DLOCAL' | null;
    currentPeriodEnd: string | null;
    expiresAt: string | null;
    trialEnd: string | null;
  } | null;
  trial: { status: string };
}

export default function CancelSubscriptionPage(): React.ReactElement {
  const router = useRouter();
  const viewing = useUserViewAs() !== null;
  const { t, formatDate } = useLocale();

  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [step, setStep] = useState(1);
  const [reasonCode, setReasonCode] = useState('');
  const [otherText, setOtherText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);

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

  // Moving between steps replaces the content under the same heading, so put
  // keyboard and screen-reader focus on the new step's heading.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const goTo = (next: number): void => {
    setSubmitError(null);
    setStep(next);
  };

  const reasonLabel = (code: string): string => {
    const row = REASONS.find(([value]) => value === code);
    return row ? t(row[1], row[2]) : '';
  };

  /** The reason sent with the request, or null when none was given. */
  const reasonToSend = (): string | null => {
    if (reasonCode === '') return null;
    if (reasonCode === 'other') {
      const text = otherText.trim();
      return text ? `${OTHER_PREFIX}${text}` : 'other';
    }
    return reasonCode;
  };

  const handleConfirm = async (): Promise<void> => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const reason = reasonToSend();
      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reason === null ? {} : { reason }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (STATE_CHANGED_CODES.has(body?.code)) {
          // Cancelled in another tab, or the payment state changed: show what is
          // true now instead of an error about a step that no longer applies.
          setStep(1);
          await load();
          return;
        }
        throw new Error('Could not schedule the cancellation');
      }
      router.push('/settings/billing?done=cancel');
    } catch {
      setSubmitError(
        t(
          'billing.cancel_flow.error',
          'We could not schedule your cancellation. Please try again.'
        )
      );
      setSubmitting(false);
    }
  };

  const backToBilling = (
    <Button asChild variant="outline">
      <Link href="/settings/billing">
        {t('billing.cancel_flow.back_to_billing', 'Back to billing')}
      </Link>
    </Button>
  );

  const title = (
    <h2 className="mb-6 text-2xl font-bold text-foreground">
      {t('billing.cancel_flow.title', 'Cancel your subscription')}
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
    // belt to its braces, because cancelling would act on the admin's account.
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
          {t(
            'billing.cancel_flow.error',
            'We could not schedule your cancellation. Please try again.'
          )}
        </p>
        {backToBilling}
      </div>
    );
  }

  const subscription = data.subscription;
  const periodEnd = subscription?.currentPeriodEnd
    ? formatDate(subscription.currentPeriodEnd)
    : '';
  const inTrial =
    data.trial.status === 'ACTIVE' && Boolean(subscription?.trialEnd);
  const canCancel = (data.allowedActions ?? []).includes('cancel');

  if (!canCancel) {
    const state = data.displayState ?? 'FREE';
    let reason: string;
    if (state === 'CANCEL_SCHEDULED') {
      reason = t(
        'billing.cancel_flow.already_scheduled',
        'Your cancellation is already scheduled. PRO ends on {date}.'
      ).replace('{date}', periodEnd);
    } else if (state === 'PAST_DUE' || state === 'UNPAID') {
      reason = t(
        'billing.cancel_flow.payment_first',
        'Your last payment needs attention first. Pay the open invoice or update your card on the billing page, then you can cancel.'
      );
    } else if (subscription?.provider === 'DLOCAL' && subscription.expiresAt) {
      reason = t(
        'billing.cancel_flow.prepaid',
        'Your plan is prepaid and ends on {date}. It does not renew automatically, so there is nothing to cancel.'
      ).replace('{date}', formatDate(subscription.expiresAt));
    } else {
      reason = t(
        'billing.cancel_flow.no_subscription',
        'You do not have a PRO subscription to cancel.'
      );
    }
    return (
      <div className="animate-fade-in">
        {title}
        <Card className="mb-6 border-2 border-border">
          <CardContent className="p-6">
            <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-foreground">
              <AlertTriangle
                className="h-5 w-5 text-amber-600"
                aria-hidden="true"
              />
              {t(
                'billing.cancel_flow.unavailable_title',
                'Cancellation is not available right now'
              )}
            </h3>
            <p className="text-sm text-muted-foreground">{reason}</p>
          </CardContent>
        </Card>
        {backToBilling}
      </div>
    );
  }

  const keepPlan = (
    <Button asChild variant="outline">
      <Link href="/settings/billing">
        {t('billing.keep_subscription', 'Keep Subscription')}
      </Link>
    </Button>
  );

  const stepTitles = [
    t('billing.cancel_flow.step1_title', 'What happens when you cancel'),
    t('billing.cancel_flow.step2_title', 'Why are you cancelling?'),
    t('billing.cancel_flow.step3_title', 'Confirm your cancellation'),
  ];

  const paused = [
    t('billing.price_alerts', 'Price Alerts'),
    t('billing.feature.drawing_engine', 'Drawing Engine Line Alerts'),
    t('billing.feature.multi_timeframe', 'Multi-Timeframe Visualization'),
  ];

  return (
    <div className="animate-fade-in">
      {title}

      <p className="mb-6 text-sm text-muted-foreground" aria-live="polite">
        {t('billing.cancel_flow.step_label', 'Step {current} of {total}')
          .replace('{current}', String(step))
          .replace('{total}', String(TOTAL_STEPS))}
      </p>
      <ol className="mb-8 flex gap-2" aria-hidden="true">
        {stepTitles.map((label, index) => (
          <li
            key={label}
            className={
              index + 1 <= step
                ? 'h-1.5 flex-1 rounded-full bg-primary'
                : 'h-1.5 flex-1 rounded-full bg-muted'
            }
          />
        ))}
      </ol>

      <Card className="mb-6 border-2 border-border">
        <CardContent className="p-6">
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="mb-4 text-xl font-semibold text-foreground outline-none"
          >
            {stepTitles[step - 1]}
          </h3>

          {step === 1 && (
            <div className="space-y-4">
              <p className="font-medium text-foreground">
                {inTrial
                  ? t(
                      'billing.cancel_flow.keep_until_trial',
                      'Your free trial ends on {date}. You will not be charged.'
                    ).replace('{date}', periodEnd)
                  : t(
                      'billing.cancel_flow.keep_until',
                      'You keep PRO until {date}.'
                    ).replace('{date}', periodEnd)}
              </p>
              {!inTrial && (
                <p className="text-sm text-muted-foreground">
                  {t(
                    'billing.cancel_flow.keep_until_detail',
                    'Your plan stays fully active until then. You will not be charged again, and you can resume at any time before {date}.'
                  ).replace('{date}', periodEnd)}
                </p>
              )}
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">
                  {t(
                    'billing.cancel_flow.pauses_heading',
                    'After {date}, these PRO features pause:'
                  ).replace('{date}', periodEnd)}
                </p>
                <ul className="space-y-2">
                  {paused.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-sm text-foreground"
                    >
                      <Minus
                        className="h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-sm text-muted-foreground">
                {t(
                  'billing.cancel_flow.free_after',
                  'Your account then moves to the FREE plan. You can subscribe again at any time from the Pricing page.'
                )}
              </p>
            </div>
          )}

          {step === 2 && (
            <fieldset>
              <legend className="mb-1 text-sm text-muted-foreground">
                {t(
                  'billing.cancel_flow.step2_hint',
                  'This is optional and helps us improve.'
                )}
              </legend>
              <div className="mt-3 space-y-2">
                {[
                  [
                    '',
                    t(
                      'billing.cancel_flow.reason_none',
                      'I would rather not say'
                    ),
                  ],
                  ...REASONS.map(
                    ([value, key, fallback]) =>
                      [value, t(key, fallback)] as const
                  ),
                ].map(([value, label]) => (
                  <label
                    key={value || 'none'}
                    className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-accent/50"
                  >
                    <input
                      type="radio"
                      name="cancellation-reason"
                      value={value}
                      checked={reasonCode === value}
                      onChange={() => setReasonCode(value)}
                      className="h-4 w-4 accent-primary"
                    />
                    {label}
                  </label>
                ))}
              </div>
              {reasonCode === 'other' && (
                <div className="mt-4">
                  <label
                    htmlFor="cancellation-other"
                    className="mb-2 block text-sm font-medium text-foreground"
                  >
                    {t(
                      'billing.cancel_flow.other_label',
                      'Tell us more (optional)'
                    )}
                  </label>
                  <textarea
                    id="cancellation-other"
                    value={otherText}
                    maxLength={OTHER_TEXT_MAX}
                    rows={3}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setOtherText(e.target.value)
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              )}
            </fieldset>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-foreground">
                {t(
                  'billing.cancel_flow.confirm_summary',
                  'Your PRO subscription will end on {date}. Until then, nothing changes.'
                ).replace('{date}', periodEnd)}
              </p>
              {reasonCode !== '' && (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {t('billing.cancel_flow.confirm_reason', 'Your reason:')}{' '}
                    {reasonLabel(reasonCode)}
                    {reasonCode === 'other' && otherText.trim()
                      ? ` — ${otherText.trim()}`
                      : ''}
                  </span>
                </p>
              )}
              {submitError && (
                <p role="alert" className="text-sm text-destructive">
                  {submitError}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        {step === 1 && (
          <>
            {keepPlan}
            <Button onClick={() => goTo(2)}>
              {t('billing.cancel_flow.continue', 'Continue')}
            </Button>
          </>
        )}
        {step === 2 && (
          <>
            <Button variant="outline" onClick={() => goTo(1)}>
              {t('billing.cancel_flow.back', 'Back')}
            </Button>
            <Button onClick={() => goTo(3)}>
              {t('billing.cancel_flow.continue', 'Continue')}
            </Button>
          </>
        )}
        {step === 3 && (
          <>
            <Button
              variant="outline"
              disabled={submitting}
              onClick={() => goTo(2)}
            >
              {t('billing.cancel_flow.back', 'Back')}
            </Button>
            {keepPlan}
            <Button
              variant="destructive"
              disabled={submitting}
              onClick={() => void handleConfirm()}
            >
              {submitting
                ? t('billing.cancelling', 'Cancelling...')
                : t('billing.confirm_cancellation', 'Confirm Cancellation')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
