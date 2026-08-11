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

export const dynamic = 'force-dynamic';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATUS BADGE STYLES — real Prisma `PaymentBatchStatus` enum
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const BATCH_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-800',
  QUEUED: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PAGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default async function AffiliatePayoutsPage(): Promise<React.ReactElement> {
  const profile = await getAffiliateProfile();

  if (!profile) {
    redirect('/affiliate/register');
  }

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
        <h1 className="text-2xl font-bold text-gray-900">Payout History</h1>
        <p className="text-gray-600">
          Real payment-batch status for every commission that has entered a
          payout run. To configure where payouts are sent, visit{' '}
          <a
            href="/affiliate/settings/payout"
            className="text-blue-600 underline hover:text-blue-800"
          >
            Payout Settings
          </a>
          .
        </p>
      </div>

      {transactions.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow-md">
          No payout batches yet. Commissions enter a batch once approved and
          scheduled for payout.
        </div>
      ) : (
        <div className="overflow-hidden overflow-x-auto rounded-lg bg-white shadow-md">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Batch
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Code
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Amount
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Batch Status
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Wise Transfer
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Scheduled
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Completed
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-gray-600">
                    {tx.batch.batchNumber}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 font-mono text-sm">
                    {tx.commission.affiliateCode.code}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold">
                    ${Number(tx.commission.commissionAmount).toFixed(2)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        BATCH_STATUS_STYLES[tx.batch.status] ??
                        'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {tx.batch.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                    {tx.wiseTransfer
                      ? `${tx.wiseTransfer.currentState} (${Number(tx.wiseTransfer.targetValue).toFixed(2)} ${tx.wiseTransfer.targetCurrency})`
                      : '—'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                    {tx.batch.scheduledAt
                      ? new Date(tx.batch.scheduledAt).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
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
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
        <h3 className="mb-3 font-semibold text-gray-900">
          Payout Batch Status Guide
        </h3>
        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3 lg:grid-cols-6">
          {Object.entries(BATCH_STATUS_STYLES).map(([status, className]) => (
            <div key={status} className="flex items-center gap-2">
              <span
                className={`rounded px-2 py-1 text-xs font-medium ${className}`}
              >
                {status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
