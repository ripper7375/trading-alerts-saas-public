/**
 * Affiliate Payout History Page (Session 6-7, A2-11)
 *
 * Real payout-batch history for the signed-in affiliate — each row is a
 * PaymentBatch this affiliate has at least one DisbursementTransaction in,
 * badged with the real `PaymentBatchStatus` enum (PENDING, QUEUED,
 * PROCESSING, COMPLETED, FAILED, CANCELLED — distinct from the
 * per-commission `CommissionStatus` shown on /affiliate/dashboard/commissions,
 * per Davin's live CONFIRM-time scoping).
 *
 * Server component, direct Prisma read (mirrors the established
 * `/alerts/[id]/edit`, `/settings/account`, `/admin/users/[id]` precedent —
 * no self-service REST endpoint exists for this data yet, and the
 * `AffiliateDashboardLayout` above already gates this route to
 * authenticated affiliates, so no re-auth is needed here). Only this
 * affiliate's own DisbursementTransaction rows within a batch are ever
 * queried or shown — a PaymentBatch commonly spans many affiliates, and
 * their data must never leak into this view.
 *
 * @module app/affiliate/dashboard/payouts/page
 */

import { redirect } from 'next/navigation';

import { getAffiliateProfile } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { getServerLocalePreferences } from '@/lib/i18n/server-locale';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getCountryByCode, formatCurrencyAmount } from '@/lib/country-config';

export const dynamic = 'force-dynamic';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATUS BADGE STYLES — real Prisma `PaymentBatchStatus` enum
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const BATCH_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-muted text-muted-foreground border border-border',
  QUEUED:
    'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30',
  PROCESSING:
    'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30',
  COMPLETED:
    'bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30',
  FAILED:
    'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30',
  CANCELLED:
    'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30',
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PAGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default async function AffiliatePayoutsPage(): Promise<React.ReactElement> {
  const profile = await getAffiliateProfile();

  if (!profile) {
    redirect('/affiliate/register');
  }

  const prefs = await getServerLocalePreferences();
  const dict = getDictionary(prefs.language);
  const dt = (key: string, fallback: string): string => dict[key] ?? fallback;
  const exchangeRate = getCountryByCode(prefs.countryCode).exchangeRate;
  const usd = (amount: number): string =>
    formatCurrencyAmount(amount, {
      currency: prefs.currency,
      exchangeRate,
      language: prefs.language,
    });
  const batchStatusLabelKeys: Record<string, string> = {
    PENDING: 'admin.disbursement.tx_status_pending',
    QUEUED: 'admin.disbursement.batch_status_queued',
    PROCESSING: 'admin.disbursement.tx_status_processing',
    COMPLETED: 'admin.disbursement.tx_status_completed',
    FAILED: 'admin.disbursement.tx_status_failed',
    CANCELLED: 'admin.disbursement.tx_status_cancelled',
  };
  const batchStatusLabel = (status: string): string =>
    dt(batchStatusLabelKeys[status] ?? '', status);

  const transactions = await prisma.disbursementTransaction.findMany({
    where: { commission: { affiliateProfileId: profile.id } },
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      createdAt: true,
      completedAt: true,
      commission: {
        select: {
          commissionAmount: true,
          affiliateCode: { select: { code: true } },
        },
      },
      batch: {
        select: {
          id: true,
          batchNumber: true,
          status: true,
          scheduledAt: true,
          completedAt: true,
          provider: true,
        },
      },
      wiseTransfer: {
        select: {
          currentState: true,
          targetCurrency: true,
          targetValue: true,
          reference: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {dt('affiliate.payouts.payout_history', 'Payout History')}
        </h1>
        <p className="text-muted-foreground">
          {dt(
            'affiliate.payouts.payout_history_desc_prefix',
            'Real payment-batch status for every commission that has entered a payout run. To configure where payouts are sent, visit'
          )}{' '}
          <a
            href="/affiliate/settings/payout"
            className="text-amber-600 underline hover:text-amber-700 dark:text-amber-400"
          >
            {dt('affiliate.payouts.payout_settings', 'Payout Settings')}
          </a>
          .
        </p>
      </div>

      {transactions.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground shadow-sm">
          {dt(
            'affiliate.payouts.no_payout_batches',
            'No payout batches yet. Commissions enter a batch once approved and scheduled for payout.'
          )}
        </div>
      ) : (
        <div className="overflow-hidden overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/40">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {dt('admin.disbursement.batch', 'Batch')}
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {dt('affiliate.codes.code', 'Code')}
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {dt('admin.disbursement.amount', 'Amount')}
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {dt('affiliate.payouts.batch_status', 'Batch Status')}
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {dt('affiliate.payouts.wise_transfer', 'Wise Transfer')}
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {dt('affiliate.payouts.scheduled', 'Scheduled')}
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {dt('admin.disbursement.completed', 'Completed')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-muted-foreground">
                    {tx.batch.batchNumber}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 font-mono text-sm text-foreground">
                    {tx.commission.affiliateCode.code}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-foreground">
                    {usd(Number(tx.commission.commissionAmount))}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        BATCH_STATUS_STYLES[tx.batch.status] ??
                        'border border-border bg-muted text-muted-foreground'
                      }`}
                    >
                      {batchStatusLabel(tx.batch.status)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                    {tx.wiseTransfer
                      ? `${tx.wiseTransfer.currentState} (${Number(tx.wiseTransfer.targetValue).toFixed(2)} ${tx.wiseTransfer.targetCurrency})`
                      : '—'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                    {tx.batch.scheduledAt
                      ? new Date(tx.batch.scheduledAt).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                    {tx.batch.completedAt
                      ? new Date(tx.batch.completedAt).toLocaleDateString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Status Guide */}
      <div className="bg-muted/40 rounded-lg border border-border p-6">
        <h3 className="mb-3 font-semibold text-foreground">
          {dt(
            'affiliate.payouts.batch_status_guide',
            'Payout Batch Status Guide'
          )}
        </h3>
        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3 lg:grid-cols-6">
          {Object.entries(BATCH_STATUS_STYLES).map(([status, className]) => (
            <div key={status} className="flex items-center gap-2">
              <span
                className={`rounded px-2 py-1 text-xs font-medium ${className}`}
              >
                {batchStatusLabel(status)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
