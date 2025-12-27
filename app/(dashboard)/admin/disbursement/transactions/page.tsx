'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, Suspense, useRef } from 'react';

import {
  TransactionStatusBadge,
  ProviderBadge,
} from '@/components/admin/disbursement-badges';
import {
  TransactionsPageSkeleton,
  TransactionsTableSkeleton,
} from '@/components/admin/disbursement-skeletons';
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
// TRANSACTIONS PAGE CONTENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function TransactionsPageContent(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
        throw new Error(data.error || 'Failed to fetch transactions');
      }

      const data = await response.json();
      setTransactions(data.transactions || []);
      setPagination(data.pagination || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, currentOffset]);

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  // Silent fetch for polling (doesn't show loading state)
  const fetchTransactionsSilent = useCallback(async (): Promise<void> => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('limit', limit.toString());
      params.set('offset', currentOffset.toString());

      const response = await fetch(
        `/api/disbursement/transactions?${params.toString()}`
      );

      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
        setPagination(data.pagination || null);
      }
    } catch {
      // Silently fail on polling errors
    }
  }, [statusFilter, currentOffset]);

  // Polling effect - auto-refresh every 5 seconds when enabled
  useEffect(() => {
    if (isPolling) {
      pollingIntervalRef.current = setInterval(() => {
        void fetchTransactionsSilent();
      }, 5000);
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [isPolling, fetchTransactionsSilent]);

  // Auto-enable polling when there are PROCESSING or PENDING transactions
  useEffect(() => {
    const hasActiveTransactions = transactions.some(
      (t) => t.status === 'PROCESSING' || t.status === 'PENDING'
    );
    if (hasActiveTransactions && !isPolling) {
      setIsPolling(true);
    }
  }, [transactions, isPolling]);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Transactions
          </h1>
          <p className="text-gray-400 mt-1">All disbursement transactions</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsPolling(!isPolling)}
            variant={isPolling ? 'default' : 'outline'}
            className={isPolling ? 'bg-blue-600 hover:bg-blue-700' : ''}
            aria-label={isPolling ? 'Disable auto-refresh' : 'Enable auto-refresh'}
            aria-pressed={isPolling}
          >
            {isPolling ? 'Auto-refresh On' : 'Auto-refresh'}
          </Button>
          <Button
            onClick={() => void fetchTransactions()}
            variant="outline"
            disabled={isLoading}
            aria-label="Refresh transactions list"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="bg-red-900/50 border-red-600" role="alert" aria-live="polite">
          <CardContent className="py-4">
            <p className="text-red-300">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Status Filter */}
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter transactions by status">
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
                className={
                  (status === 'ALL' && !statusFilter) || statusFilter === status
                    ? 'bg-green-600 hover:bg-green-700'
                    : ''
                }
                aria-pressed={(status === 'ALL' && !statusFilter) || statusFilter === status}
                aria-label={`Filter by ${status === 'ALL' ? 'all transactions' : status.toLowerCase()} status`}
              >
                {status === 'ALL' ? 'All Transactions' : status}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      {isLoading ? (
        <TransactionsTableSkeleton />
      ) : transactions.length > 0 ? (
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">
                      Transaction ID
                    </th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">
                      Amount
                    </th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">
                      Provider
                    </th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">
                      Provider TX
                    </th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">
                      Payee
                    </th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">
                      Retries
                    </th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-b border-gray-700/50 hover:bg-gray-700/30"
                    >
                      <td className="py-3 px-4">
                        <span className="text-white font-mono text-xs">
                          {tx.transactionId}
                        </span>
                      </td>
                      <td className="py-3 px-4"><TransactionStatusBadge status={tx.status} /></td>
                      <td className="py-3 px-4">
                        <span className="text-green-400 font-medium">
                          {formatCurrency(tx.amount)}
                        </span>
                        <span className="text-gray-500 text-xs ml-1">
                          {tx.currency}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className="bg-gray-600 text-white text-xs">
                          {tx.provider}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-gray-400 text-xs font-mono">
                          {tx.providerTxId || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {tx.payeeRiseId ? (
                          <span className="text-gray-400 font-mono text-xs">
                            {tx.payeeRiseId.slice(0, 10)}...
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={
                            tx.retryCount > 0
                              ? 'text-yellow-400'
                              : 'text-gray-400'
                          }
                        >
                          {tx.retryCount}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-xs">
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
            <CardContent className="border-t border-gray-700">
              <div className="flex items-center justify-between">
                <p className="text-gray-400 text-sm" aria-live="polite">
                  Showing {currentOffset + 1} -{' '}
                  {Math.min(currentOffset + limit, pagination.total)} of{' '}
                  {pagination.total}
                </p>
                <nav className="flex gap-2" aria-label="Transaction pagination">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentOffset === 0}
                    onClick={() =>
                      handlePageChange(Math.max(0, currentOffset - limit))
                    }
                    aria-label="Go to previous page"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!pagination.hasMore}
                    onClick={() => handlePageChange(currentOffset + limit)}
                    aria-label="Go to next page"
                  >
                    Next
                  </Button>
                </nav>
              </div>
            </CardContent>
          )}
        </Card>
      ) : (
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="py-12 text-center">
            <p className="text-gray-400">No transactions found.</p>
          </CardContent>
        </Card>
      )}

      {/* Failed Transactions Info */}
      {statusFilter === 'FAILED' && transactions.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">
              Failed Transaction Details
            </CardTitle>
            <CardDescription className="text-gray-400">
              Error information for failed transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {transactions
                .filter((tx) => tx.errorMessage)
                .map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 bg-red-900/30 border border-red-600/50 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-mono text-xs">
                        {tx.transactionId}
                      </span>
                      <span className="text-gray-400 text-xs">
                        {formatDate(tx.failedAt || tx.createdAt)}
                      </span>
                    </div>
                    <p className="text-red-400 text-sm">{tx.errorMessage}</p>
                    {tx.retryCount > 0 && (
                      <p className="text-yellow-400 text-xs mt-1">
                        Retried {tx.retryCount} times
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
    <Suspense fallback={<TransactionsPageSkeleton />}>
      <TransactionsPageContent />
    </Suspense>
  );
}
