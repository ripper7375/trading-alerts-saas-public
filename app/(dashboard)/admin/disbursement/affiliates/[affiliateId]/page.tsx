'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/utils';
import type {
  DisbursementTransactionStatus,
  PaymentBatchStatus,
} from '@/types/disbursement';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES (mirrors the real GET /api/disbursement/affiliates/[affiliateId]
// response shape verbatim -- not the money service cutover table's own,
// unrelated batch-lifecycle terminology)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AffiliateDisbursementDetail {
  affiliate: {
    id: string;
    fullName: string;
    email: string | undefined;
    country: string;
    status: string;
    createdAt: string;
    verifiedAt: string | null;
    stats: {
      totalPending: number;
      totalPaid: number;
      totalEarnings: number;
      codesDistributed: number;
      codesUsed: number;
    };
    paymentInfo: {
      paymentMethod: string;
      paymentDetails: unknown;
    };
  };
  riseAccount: {
    id: string;
    riseId: string;
    email: string;
    kycStatus: string;
    kycCompletedAt: string | null;
    invitationSentAt: string | null;
    invitationAcceptedAt: string | null;
    lastSyncAt: string | null;
    canReceivePayments: boolean;
  } | null;
  pendingCommissions: {
    count: number;
    totalAmount: number;
    oldestDate: string | null;
    meetsThreshold: boolean;
    commissionIds: string[];
  };
  recentTransactions: Array<{
    id: string;
    transactionId: string;
    amount: number;
    status: DisbursementTransactionStatus;
    createdAt: string;
    completedAt: string | null;
    batchNumber: string | undefined;
    batchStatus: PaymentBatchStatus | undefined;
  }>;
  readyForPayout: boolean;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS — real DisbursementTransactionStatus / PaymentBatchStatus enum
// values only (PENDING, QUEUED, PROCESSING, COMPLETED, FAILED, CANCELLED).
// The order's own "DRAFTING/PENDING_APPROVAL/APPROVED" vocabulary does not
// exist anywhere in either Prisma schema -- corrected per Davin, 2026-08-11.
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const TRANSACTION_STATUS_CLASS: Record<DisbursementTransactionStatus, string> =
  {
    PENDING: 'bg-yellow-600',
    PROCESSING: 'bg-blue-600',
    COMPLETED: 'bg-green-600',
    FAILED: 'bg-red-600',
    CANCELLED: 'bg-gray-600',
  };

const BATCH_STATUS_CLASS: Record<PaymentBatchStatus, string> = {
  PENDING: 'bg-yellow-600',
  QUEUED: 'bg-blue-500',
  PROCESSING: 'bg-blue-600',
  COMPLETED: 'bg-green-600',
  FAILED: 'bg-red-600',
  CANCELLED: 'bg-gray-600',
};

function transactionStatusBadge(
  status: DisbursementTransactionStatus
): React.ReactElement {
  return (
    <Badge className={`${TRANSACTION_STATUS_CLASS[status]} text-xs text-white`}>
      {status}
    </Badge>
  );
}

function batchStatusBadge(status: PaymentBatchStatus): React.ReactElement {
  return (
    <Badge className={`${BATCH_STATUS_CLASS[status]} text-xs text-white`}>
      {status}
    </Badge>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PAGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Admin Affiliate Disbursement Detail Page (Session 6-6, A2-7)
 *
 * Did not exist before this session -- only a flat "Payable Affiliates"
 * list (`app/(dashboard)/admin/disbursement/affiliates/page.tsx`) existed
 * at this path's parent. The order's own Step 5 text ("audit... to align
 * batch status vocabulary") assumed this page already existed; it didn't,
 * so it's built here consuming the already-live
 * `GET /api/disbursement/affiliates/[affiliateId]` (Part 19B) as-is, using
 * that route's own real `DisbursementTransactionStatus`/`PaymentBatchStatus`
 * enum values for badges rather than the order's fabricated vocabulary.
 * The route's `riseAccount` data stays RiseWorks-only (historical, matching
 * Step 2's read-only-tab precedent) -- not rebuilt for Wise recipients,
 * since that's out of A2-7's own stated "align vocabulary" scope.
 */
export default function AffiliateDisbursementDetailPage(): React.ReactElement {
  const params = useParams();
  const affiliateId = params['affiliateId'] as string;

  const [detail, setDetail] = useState<AffiliateDisbursementDetail | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const response = await fetch(
        `/api/disbursement/affiliates/${affiliateId}`
      );
      if (response.status === 404) {
        setNotFound(true);
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch affiliate details');
      }
      const data: AffiliateDisbursementDetail = await response.json();
      setDetail(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch affiliate'
      );
    } finally {
      setLoading(false);
    }
  }, [affiliateId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-green-500" />
      </div>
    );
  }

  if (notFound) {
    return (
      <Card className="border-gray-700 bg-gray-800">
        <CardContent className="py-12 text-center">
          <h2 className="text-xl font-bold text-white">Affiliate not found</h2>
          <p className="mt-2 text-gray-400">
            No affiliate exists with this ID.
          </p>
          <Button asChild className="mt-4 bg-green-600 hover:bg-green-700">
            <Link href="/admin/disbursement/affiliates">
              Back to Payable Affiliates
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (error || !detail) {
    return (
      <Card className="border-gray-700 bg-gray-800">
        <CardContent className="py-12 text-center">
          <p className="mb-4 text-red-400">{error}</p>
          <Button
            onClick={() => void fetchDetail()}
            className="bg-green-600 hover:bg-green-700"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { affiliate } = detail;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/disbursement/affiliates"
          className="text-sm text-blue-400 transition-colors hover:text-blue-300"
        >
          ← Back to Payable Affiliates
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            {affiliate.fullName}
          </h1>
          <Badge
            className={
              affiliate.status === 'ACTIVE'
                ? 'bg-green-600'
                : affiliate.status === 'SUSPENDED'
                  ? 'bg-red-600'
                  : 'bg-yellow-600'
            }
          >
            {affiliate.status}
          </Badge>
          {detail.readyForPayout && (
            <Badge className="bg-green-600">Ready for Payout</Badge>
          )}
        </div>
        <p className="mt-1 text-gray-400">
          {affiliate.email} · {affiliate.country}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400">
              Total Earnings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(affiliate.stats.totalEarnings)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400">Pending</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-400">
              {formatCurrency(affiliate.stats.totalPending)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400">Paid</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">
              {formatCurrency(affiliate.stats.totalPaid)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400">
              Codes Distributed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {affiliate.stats.codesDistributed}
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400">
              Codes Used
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {affiliate.stats.codesUsed}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pending Commissions */}
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Pending Commissions</CardTitle>
            <CardDescription className="text-gray-400">
              {detail.pendingCommissions.count} commission
              {detail.pendingCommissions.count === 1 ? '' : 's'} awaiting payout
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Total Amount</span>
              <span className="text-white">
                {formatCurrency(detail.pendingCommissions.totalAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Oldest</span>
              <span className="text-white">
                {detail.pendingCommissions.oldestDate
                  ? formatDate(detail.pendingCommissions.oldestDate)
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Meets Payout Threshold</span>
              {detail.pendingCommissions.meetsThreshold ? (
                <Badge className="bg-green-600 text-xs">Yes</Badge>
              ) : (
                <Badge className="bg-gray-600 text-xs">No</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* RiseWorks Account (historical) */}
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              RiseWorks Account
              <Badge className="bg-gray-600 text-xs">Historical</Badge>
            </CardTitle>
            <CardDescription className="text-gray-400">
              Archived per F42 — live payouts run through Wise
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {detail.riseAccount ? (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-400">KYC Status</span>
                  <span className="text-white">
                    {detail.riseAccount.kycStatus}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Rise ID</span>
                  <span className="font-mono text-xs text-gray-300">
                    {detail.riseAccount.riseId.slice(0, 10)}...
                  </span>
                </div>
              </>
            ) : (
              <p className="text-gray-400">No RiseWorks account on record.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="border-gray-700 bg-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Recent Transactions</CardTitle>
          <CardDescription className="text-gray-400">
            Most recent 10 disbursement transactions
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {detail.recentTransactions.length === 0 ? (
            <p className="px-6 py-8 text-center text-gray-400">
              No transactions yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="px-4 py-3 text-left font-medium text-gray-400">
                      Transaction
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-400">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-400">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-400">
                      Batch
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-400">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detail.recentTransactions.map((txn) => (
                    <tr
                      key={txn.id}
                      className="border-b border-gray-700/50 hover:bg-gray-700/30"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-300">
                        {txn.transactionId}
                      </td>
                      <td className="px-4 py-3 text-white">
                        {formatCurrency(txn.amount)}
                      </td>
                      <td className="px-4 py-3">
                        {transactionStatusBadge(txn.status)}
                      </td>
                      <td className="px-4 py-3">
                        {txn.batchNumber ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-gray-400">
                              {txn.batchNumber}
                            </span>
                            {txn.batchStatus &&
                              batchStatusBadge(txn.batchStatus)}
                          </div>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {formatDate(txn.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
