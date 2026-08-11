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
import type { WiseRecipientSummary } from '@/lib/money-service/wise-types';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  PENDING_DETAILS: 'bg-yellow-100 text-yellow-800',
  DRAFT: 'bg-gray-100 text-gray-800',
  INVALID: 'bg-red-100 text-red-800',
  ARCHIVED: 'bg-gray-100 text-gray-500',
};

export default function AffiliatePayoutSettingsPage(): React.ReactElement {
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
          'Could not re-verify these details with our payment provider right now. Please try again shortly.'
        );
      }
    } catch {
      setRevalidateError(
        'Could not re-verify these details with our payment provider right now. Please try again shortly.'
      );
    } finally {
      setRevalidating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payout Settings</h1>
        <p className="text-gray-600">
          Manage the bank details your commissions are paid out to. This is the
          single place to configure how you get paid — see your{' '}
          <a
            href="/affiliate/dashboard/payouts"
            className="text-blue-600 underline hover:text-blue-800"
          >
            payout history
          </a>{' '}
          for past transfers.
        </p>
      </div>

      {recipient && (
        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="mb-3 text-lg font-semibold text-gray-900">
                Current Payout Details
              </h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <dt className="text-gray-500">Account holder</dt>
                  <dd className="font-medium">{recipient.accountHolderName}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Currency</dt>
                  <dd className="font-medium">{recipient.targetCurrency}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Country</dt>
                  <dd className="font-medium">{recipient.recipientCountry}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Account</dt>
                  <dd className="font-medium">
                    {recipient.accountTail
                      ? `•••• ${recipient.accountTail}`
                      : 'N/A'}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Status</dt>
                  <dd>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLES[recipient.status] ??
                        'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {recipient.status}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <button
                onClick={handleRevalidate}
                disabled={revalidating}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {revalidating ? 'Re-verifying…' : 'Re-verify with provider'}
              </button>
              <button
                onClick={() => setShowForm((v) => !v)}
                className="rounded-md bg-gray-100 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-200"
              >
                {showForm ? 'Cancel' : 'Change payout details'}
              </button>
            </div>
          </div>
          {revalidateError && (
            <p className="mt-3 text-sm text-red-600">{revalidateError}</p>
          )}
        </div>
      )}

      {!recipient && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          You haven&apos;t set up payout details yet. Fill in the form below to
          get paid.
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
