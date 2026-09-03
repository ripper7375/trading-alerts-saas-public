/**
 * Affiliate Payout Settings Page (Session 4A-W3b, File 2/5)
 *
 * /affiliate/settings/payout — recorded URL per F39's resolution
 * (DECISION-LOG.md). Shows the affiliate's current Wise recipient status
 * (a real GET /api/wise/recipients/me call) and embeds WiseRecipientForm
 * for onboarding / updating payout details. Also exposes a self-service
 * "Revalidate" action — the live backend's POST
 * /v1/wise/recipients/:id/revalidate is AffiliateGuard-scoped (derives the
 * recipient from the caller's own token), so this belongs here, not on the
 * admin page (confirmed with Davin live at this session's build time).
 *
 * @module app/affiliate/settings/payout/page
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

import WiseRecipientForm from '@/components/affiliate/wise-recipient-form';
import { useLocale } from '@/lib/context/locale-context';
import type { WiseRecipientSummary } from '@/lib/money-service/wise-types';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:
    'bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30',
  PENDING_DETAILS:
    'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30',
  DRAFT: 'bg-muted text-muted-foreground border border-border',
  INVALID:
    'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30',
  ARCHIVED: 'bg-muted text-muted-foreground border border-border',
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  ACTIVE: 'affiliate.payouts.recipient_status_active',
  PENDING_DETAILS: 'affiliate.payouts.recipient_status_pending_details',
  DRAFT: 'affiliate.payouts.recipient_status_draft',
  INVALID: 'affiliate.payouts.recipient_status_invalid',
  ARCHIVED: 'affiliate.payouts.recipient_status_archived',
};

export default function AffiliatePayoutSettingsPage(): React.ReactElement {
  const { t } = useLocale();
  const [recipient, setRecipient] = useState<WiseRecipientSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [revalidating, setRevalidating] = useState(false);
  const [revalidateError, setRevalidateError] = useState<string | null>(null);

  const fetchRecipient = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wise/recipients/me');
      if (res.status === 204) {
        setRecipient(null);
        setShowForm(true);
      } else if (res.ok) {
        const data: WiseRecipientSummary = await res.json();
        setRecipient(data);
        setShowForm(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRecipient();
  }, [fetchRecipient]);

  async function handleRevalidate(): Promise<void> {
    if (!recipient) return;
    setRevalidating(true);
    setRevalidateError(null);
    try {
      const res = await fetch(
        `/api/wise/recipients/${recipient.id}/revalidate`,
        { method: 'POST' }
      );
      if (res.ok) {
        const data: WiseRecipientSummary = await res.json();
        setRecipient(data);
      } else {
        setRevalidateError(
          t(
            'affiliate.payouts.revalidate_error',
            'Could not re-verify these details with our payment provider right now. Please try again shortly.'
          )
        );
      }
    } catch {
      setRevalidateError(
        t(
          'affiliate.payouts.revalidate_error',
          'Could not re-verify these details with our payment provider right now. Please try again shortly.'
        )
      );
    } finally {
      setRevalidating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t('affiliate.payouts.payout_settings', 'Payout Settings')}
        </h1>
        <p className="text-muted-foreground">
          {t(
            'affiliate.payouts.settings_desc_prefix',
            'Manage the bank details your commissions are paid out to. This is the single place to configure how you get paid — see your'
          )}{' '}
          <a
            href="/affiliate/dashboard/payouts"
            className="text-amber-600 underline hover:text-amber-700 dark:text-amber-400"
          >
            {t('affiliate.payouts.payout_history_link', 'payout history')}
          </a>{' '}
          {t('affiliate.payouts.settings_desc_suffix', 'for past transfers.')}
        </p>
      </div>

      {recipient && (
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="mb-3 text-lg font-semibold text-foreground">
                {t(
                  'affiliate.payouts.current_payout_details',
                  'Current Payout Details'
                )}
              </h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">
                    {t('affiliate.payouts.account_holder', 'Account holder')}
                  </dt>
                  <dd className="font-medium text-foreground">
                    {recipient.accountHolderName}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {t('admin.disbursement.currency', 'Currency')}
                  </dt>
                  <dd className="font-medium text-foreground">
                    {recipient.targetCurrency}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {t('affiliate.profile.country', 'Country')}
                  </dt>
                  <dd className="font-medium text-foreground">
                    {recipient.recipientCountry}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {t('affiliate.payouts.account', 'Account')}
                  </dt>
                  <dd className="font-medium text-foreground">
                    {recipient.accountTail
                      ? `•••• ${recipient.accountTail}`
                      : t('affiliate.profile.not_available', 'N/A')}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {t('admin.disbursement.status', 'Status')}
                  </dt>
                  <dd>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLES[recipient.status] ??
                        'border border-border bg-muted text-muted-foreground'
                      }`}
                    >
                      {t(
                        STATUS_LABEL_KEYS[recipient.status] ?? '',
                        recipient.status
                      )}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <button
                onClick={handleRevalidate}
                disabled={revalidating}
                className="rounded-md border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-50"
              >
                {revalidating
                  ? t('affiliate.payouts.reverifying_ellipsis', 'Re-verifying…')
                  : t(
                      'affiliate.payouts.reverify_with_provider',
                      'Re-verify with provider'
                    )}
              </button>
              <button
                onClick={() => setShowForm((v) => !v)}
                className="rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent"
              >
                {showForm
                  ? t('Cancel', 'Cancel')
                  : t(
                      'affiliate.payouts.change_payout_details',
                      'Change payout details'
                    )}
              </button>
            </div>
          </div>
          {revalidateError && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {revalidateError}
            </p>
          )}
        </div>
      )}

      {!recipient && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">
          {t(
            'affiliate.payouts.no_payout_details_yet',
            "You haven't set up payout details yet. Fill in the form below to get paid."
          )}
        </div>
      )}

      {showForm && (
        <WiseRecipientForm
          onSubmitted={(newRecipient) => {
            setRecipient(newRecipient);
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}
