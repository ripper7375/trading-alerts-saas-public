'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, Suspense } from 'react';

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
  DisbursementProvider,
} from '@/types/disbursement';
import { useLocale } from '@/lib/context/locale-context';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface Transaction {
  id: string;
  batchId: string;
  commissionId: string;
  transactionId: string;
  providerTxId: string | null;
  provider: DisbursementProvider;
  affiliateRiseAccountId: string | null;
  payeeRiseId: string | null;
  amount: number;
  amountRiseUnits: number | null;
  currency: string;
  status: DisbursementTransactionStatus;
  retryCount: number;
  lastRetryAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  failedAt: string | null;
}

interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getStatusBadge(
  status: DisbursementTransactionStatus,
  t: (keyOrText: string, fallback?: string) => string
): React.ReactElement {
  const statusConfig: Record<
    DisbursementTransactionStatus,
    { className: string; labelKey: string; label: string }
  > = {
    PENDING: {
      className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      labelKey: 'admin.disbursement.tx_status_pending',
      label: 'Pending',
    },
    PROCESSING: {
      className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      labelKey: 'admin.disbursement.tx_status_processing',
      label: 'Processing',
    },
    COMPLETED: {
      className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      labelKey: 'admin.disbursement.tx_status_completed',
      label: 'Completed',
    },
    FAILED: {
      className: 'bg-red-500/10 text-red-600 dark:text-red-400',
      labelKey: 'admin.disbursement.tx_status_failed',
      label: 'Failed',
    },
    CANCELLED: {
      className: 'bg-muted text-muted-foreground',
      labelKey: 'admin.disbursement.tx_status_cancelled',
      label: 'Cancelled',
    },
  };

  const config = statusConfig[status];

  return (
    <Badge className={`${config.className} text-xs`}>
      {t(config.labelKey, config.label)}
    </Badge>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TRANSACTIONS PAGE CONTENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function TransactionsPageContent(): React.ReactElement {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const statusFilter = searchParams.get(
    'status'
  ) as DisbursementTransactionStatus | null;
  const currentOffset = parseInt(searchParams.get('offset') || '0', 10);
  const limit = 20;

  const fetchTransactions = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('limit', limit.toString());
      params.set('offset', currentOffset.toString());

      const response = await fetch(
        `/api/disbursement/transactions?${params.toString()}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error ||
            t(
              'admin.disbursement.error_fetch_transactions',
              'Failed to fetch transactions'
            )
        );
      }

      const data = await response.json();
      setTransactions(data.transactions || []);
      setPagination(data.pagination || null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.dashboard.unknown_error', 'Unknown error')
      );
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, currentOffset]);

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  const handleStatusFilter = (
    status: DisbursementTransactionStatus | 'ALL'
  ): void => {
    const params = new URLSearchParams();
    if (status !== 'ALL') params.set('status', status);
    params.set('offset', '0');
    router.push(`/admin/disbursement/transactions?${params.toString()}`);
  };

  const handlePageChange = (newOffset: number): void => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    params.set('offset', newOffset.toString());
    router.push(`/admin/disbursement/transactions?${params.toString()}`);
  };

  const statusOptions: (DisbursementTransactionStatus | 'ALL')[] = [
    'ALL',
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {t('admin.disbursement.nav_transactions', 'Transactions')}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t(
              'admin.disbursement.all_transactions_subtitle',
              'All disbursement transactions'
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => void fetchTransactions()}
            variant="outline"
            disabled={isLoading}
          >
            {t('Refresh', 'Refresh')}
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-red-600 bg-red-500/10">
          <CardContent className="py-4">
            <p className="text-red-500">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Status Filter */}
      <Card className="border-border bg-card">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((status) => (
              <Button
                key={status}
                variant={
                  (status === 'ALL' && !statusFilter) || statusFilter === status
                    ? 'default'
                    : 'outline'
                }
                size="sm"
                onClick={() => handleStatusFilter(status)}
              >
                {status === 'ALL'
                  ? t('admin.disbursement.all_transactions', 'All Transactions')
                  : t(
                      `admin.disbursement.tx_status_${status.toLowerCase()}`,
                      status.charAt(0) + status.slice(1).toLowerCase()
                    )}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-green-500" />
        </div>
      ) : transactions.length > 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('admin.disbursement.transaction_id', 'Transaction ID')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('admin.users.status', 'Status')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('Amount')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('admin.disbursement.provider', 'Provider')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('admin.disbursement.provider_tx', 'Provider TX')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('admin.disbursement.payee', 'Payee')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('admin.disbursement.retries', 'Retries')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('admin.users.created', 'Created')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-border/50 hover:bg-accent/30 border-b"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-foreground">
                          {tx.transactionId}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(tx.status, t)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-green-400">
                          {formatCurrency(tx.amount)}
                        </span>
                        <span className="ml-1 text-xs text-muted-foreground">
                          {tx.currency}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className="bg-muted text-xs text-foreground">
                          {tx.provider}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-muted-foreground">
                          {tx.providerTxId || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {tx.payeeRiseId ? (
                          <span className="font-mono text-xs text-muted-foreground">
                            {tx.payeeRiseId.slice(0, 10)}...
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            tx.retryCount > 0
                              ? 'text-yellow-400'
                              : 'text-muted-foreground'
                          }
                        >
                          {tx.retryCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(tx.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>

          {/* Pagination */}
          {pagination && (
            <CardContent className="border-t border-border">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {t(
                    'admin.disbursement.showing_x_of_y',
                    'Showing {from} - {to} of {total}'
                  )
                    .replace('{from}', String(currentOffset + 1))
                    .replace(
                      '{to}',
                      String(Math.min(currentOffset + limit, pagination.total))
                    )
                    .replace('{total}', String(pagination.total))}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentOffset === 0}
                    onClick={() =>
                      handlePageChange(Math.max(0, currentOffset - limit))
                    }
                  >
                    {t('admin.users.previous', 'Previous')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!pagination.hasMore}
                    onClick={() => handlePageChange(currentOffset + limit)}
                  >
                    {t('admin.users.next', 'Next')}
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      ) : (
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {t(
                'admin.disbursement.no_transactions_found',
                'No transactions found.'
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Failed Transactions Info */}
      {statusFilter === 'FAILED' && transactions.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">
              {t(
                'admin.disbursement.failed_tx_details',
                'Failed Transaction Details'
              )}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {t(
                'admin.disbursement.failed_tx_details_desc',
                'Error information for failed transactions'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {transactions
                .filter((tx) => tx.errorMessage)
                .map((tx) => (
                  <div
                    key={tx.id}
                    className="rounded-lg border border-red-600/50 bg-red-900/30 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-xs text-foreground">
                        {tx.transactionId}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(tx.failedAt || tx.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-red-400">{tx.errorMessage}</p>
                    {tx.retryCount > 0 && (
                      <p className="mt-1 text-xs text-yellow-400">
                        {t(
                          'admin.disbursement.retried_n_times',
                          'Retried {n} times'
                        ).replace('{n}', String(tx.retryCount))}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TRANSACTIONS PAGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Transactions Page - Client Component with Suspense
 *
 * Features:
 * - Paginated list of all transactions
 * - Status filter
 * - Transaction details
 * - Error message display for failed transactions
 *
 * Data fetching:
 * - Fetches from /api/disbursement/transactions
 */
export default function TransactionsPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-green-500" />
        </div>
      }
    >
      <TransactionsPageContent />
    </Suspense>
  );
}
