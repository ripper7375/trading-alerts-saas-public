'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
  PaymentBatchStatus,
  DisbursementTransactionStatus,
  DisbursementProvider,
  AuditLogStatus,
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
  payeeRiseId: string | null;
  amount: number;
  currency: string;
  status: DisbursementTransactionStatus;
  retryCount: number;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  failedAt: string | null;
}

interface AuditLog {
  id: string;
  transactionId: string | null;
  batchId: string | null;
  action: string;
  actor: string | null;
  status: AuditLogStatus;
  details: Record<string, unknown> | null;
  createdAt: string;
}

interface BatchDetails {
  id: string;
  batchNumber: string;
  paymentCount: number;
  totalAmount: number;
  currency: string;
  provider: DisbursementProvider;
  status: PaymentBatchStatus;
  scheduledAt: string | null;
  executedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  transactions: Transaction[];
  auditLogs: AuditLog[];
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const STATUS_BADGE_CLASS = {
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400',
  muted: 'bg-muted text-muted-foreground',
} as const;

function getBatchStatusBadge(status: PaymentBatchStatus): React.ReactElement {
  const statusConfig: Record<
    PaymentBatchStatus,
    { className: string; label: string }
  > = {
    PENDING: { className: STATUS_BADGE_CLASS.amber, label: 'Pending' },
    QUEUED: { className: STATUS_BADGE_CLASS.blue, label: 'Queued' },
    PROCESSING: { className: STATUS_BADGE_CLASS.purple, label: 'Processing' },
    COMPLETED: { className: STATUS_BADGE_CLASS.emerald, label: 'Completed' },
    FAILED: { className: STATUS_BADGE_CLASS.red, label: 'Failed' },
    CANCELLED: { className: STATUS_BADGE_CLASS.muted, label: 'Cancelled' },
  };

  const config = statusConfig[status];

  return <Badge className={config.className}>{config.label}</Badge>;
}

function getTransactionStatusBadge(
  status: DisbursementTransactionStatus
): React.ReactElement {
  const statusConfig: Record<
    DisbursementTransactionStatus,
    { className: string; label: string }
  > = {
    PENDING: { className: STATUS_BADGE_CLASS.amber, label: 'Pending' },
    PROCESSING: { className: STATUS_BADGE_CLASS.blue, label: 'Processing' },
    COMPLETED: { className: STATUS_BADGE_CLASS.emerald, label: 'Completed' },
    FAILED: { className: STATUS_BADGE_CLASS.red, label: 'Failed' },
    CANCELLED: { className: STATUS_BADGE_CLASS.muted, label: 'Cancelled' },
  };

  const config = statusConfig[status];

  return (
    <Badge className={`${config.className} text-xs`}>{config.label}</Badge>
  );
}

function getAuditStatusBadge(status: AuditLogStatus): React.ReactElement {
  const statusConfig: Record<
    AuditLogStatus,
    { className: string; label: string }
  > = {
    SUCCESS: { className: STATUS_BADGE_CLASS.emerald, label: 'Success' },
    FAILURE: { className: STATUS_BADGE_CLASS.red, label: 'Failure' },
    WARNING: { className: STATUS_BADGE_CLASS.amber, label: 'Warning' },
    INFO: { className: STATUS_BADGE_CLASS.blue, label: 'Info' },
  };

  const config = statusConfig[status];

  return (
    <Badge className={`${config.className} text-xs`}>{config.label}</Badge>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BATCH DETAILS PAGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Batch Details Page - Client Component
 *
 * Features:
 * - Batch summary and status
 * - List of transactions in the batch
 * - Audit log history
 * - Execute/Delete batch actions
 *
 * Data fetching:
 * - Fetches from /api/disbursement/batches/[batchId]
 */
export default function BatchDetailsPage(): React.ReactElement {
  const params = useParams<{ batchId: string }>();
  const router = useRouter();
  const batchId = params.batchId;

  const [batch, setBatch] = useState<BatchDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchBatch = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/disbursement/batches/${batchId}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch batch');
      }

      const data = await response.json();
      // GET /api/disbursement/batches/[batchId] returns `transactions` and
      // `auditLogs` as SIBLINGS of `batch`, not nested inside it (Session 9-9
      // live-verification finding) -- `data.batch` alone never carries them,
      // so batch.transactions/.auditLogs were undefined for every batch,
      // pre-existing since this page was written.
      setBatch({
        ...data.batch,
        transactions: data.transactions ?? [],
        auditLogs: data.auditLogs ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    void fetchBatch();
  }, [fetchBatch]);

  const handleExecuteBatch = async (): Promise<void> => {
    try {
      setIsProcessing(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch(
        `/api/disbursement/batches/${batchId}/execute`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to execute batch');
      }

      const data = await response.json();
      setSuccessMessage(
        `Batch executed: ${data.result.successCount} succeeded, ${data.result.failedCount} failed`
      );
      void fetchBatch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute batch');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteBatch = async (): Promise<void> => {
    try {
      setIsProcessing(true);
      const response = await fetch(`/api/disbursement/batches/${batchId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete batch');
      }

      router.push('/admin/disbursement/batches');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete batch');
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-green-500" />
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="py-8 text-center">
        <p className="mb-4 text-red-500">{error || 'Batch not found'}</p>
        <Link href="/admin/disbursement/batches">
          <Button variant="outline">Back to Batches</Button>
        </Link>
      </div>
    );
  }

  const completedTransactions = batch.transactions.filter(
    (t) => t.status === 'COMPLETED'
  );
  const failedTransactions = batch.transactions.filter(
    (t) => t.status === 'FAILED'
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-3">
            <Link
              href="/admin/disbursement/batches"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Batches
            </Link>
          </div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-foreground sm:text-3xl">
            {batch.batchNumber}
            {getBatchStatusBadge(batch.status)}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Created {formatDate(batch.createdAt)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => void fetchBatch()}
            variant="outline"
            disabled={isLoading}
          >
            Refresh
          </Button>
          {batch.status === 'PENDING' && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={isProcessing}>
                    {isProcessing ? 'Executing...' : 'Execute Batch'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm batch execution</AlertDialogTitle>
                    <AlertDialogDescription>
                      Execute batch <strong>{batch.batchNumber}</strong> —{' '}
                      {batch.paymentCount} payment
                      {batch.paymentCount === 1 ? '' : 's'},{' '}
                      <strong>{formatCurrency(batch.totalAmount)}</strong> via{' '}
                      <strong>{batch.provider}</strong>? This triggers real
                      transfers through that provider and cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => void handleExecuteBatch()}
                    >
                      Execute
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isProcessing}>
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete batch {batch.batchNumber}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes batch{' '}
                      <strong>{batch.batchNumber}</strong> ({batch.paymentCount}{' '}
                      payment
                      {batch.paymentCount === 1 ? '' : 's'},{' '}
                      {formatCurrency(batch.totalAmount)}). This cannot be
                      undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void handleDeleteBatch()}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <Card className="border-red-600 bg-red-500/10">
          <CardContent className="py-4">
            <p className="text-red-500">{error}</p>
          </CardContent>
        </Card>
      )}

      {successMessage && (
        <Card className="border-green-600 bg-emerald-500/10">
          <CardContent className="py-4">
            <p className="text-emerald-500">{successMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* Batch Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground">
              Total Amount
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">
              {formatCurrency(batch.totalAmount)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground">
              Payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {batch.paymentCount}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground">
              Completed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">
              {completedTransactions.length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground">
              Failed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-400">
              {failedTransactions.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Batch Details Card */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Batch Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Provider</p>
              <p className="text-foreground">{batch.provider}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Currency</p>
              <p className="text-foreground">{batch.currency}</p>
            </div>
            {batch.executedAt && (
              <div>
                <p className="text-muted-foreground">Executed At</p>
                <p className="text-foreground">
                  {formatDate(batch.executedAt)}
                </p>
              </div>
            )}
            {batch.completedAt && (
              <div>
                <p className="text-muted-foreground">Completed At</p>
                <p className="text-foreground">
                  {formatDate(batch.completedAt)}
                </p>
              </div>
            )}
            {batch.failedAt && (
              <div>
                <p className="text-muted-foreground">Failed At</p>
                <p className="text-foreground">{formatDate(batch.failedAt)}</p>
              </div>
            )}
            {batch.errorMessage && (
              <div className="sm:col-span-2">
                <p className="text-muted-foreground">Error Message</p>
                <p className="text-red-400">{batch.errorMessage}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            Transactions
            <Badge className="bg-muted text-muted-foreground">
              {batch.transactions.length}
            </Badge>
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Individual payment transactions in this batch
          </CardDescription>
        </CardHeader>
        <CardContent>
          {batch.transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Transaction ID
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Payee
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Provider TX
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Retries
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {batch.transactions.map((tx) => (
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
                        {getTransactionStatusBadge(tx.status)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-green-400">
                          {formatCurrency(tx.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-muted-foreground">
                          {tx.payeeRiseId
                            ? `${tx.payeeRiseId.slice(0, 10)}...`
                            : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">
                          {tx.providerTxId || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {tx.retryCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-4 text-center text-muted-foreground">
              No transactions yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Audit Logs */}
      {batch.auditLogs && batch.auditLogs.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              Audit Logs
              <Badge className="bg-muted text-muted-foreground">
                {batch.auditLogs.length}
              </Badge>
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Activity history for this batch
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {batch.auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-accent/50 flex items-start gap-3 rounded-lg p-3"
                >
                  <div className="mt-1">{getAuditStatusBadge(log.status)}</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {log.action}
                    </p>
                    {log.actor && (
                      <p className="text-xs text-muted-foreground">
                        by {log.actor}
                      </p>
                    )}
                    {log.details && Object.keys(log.details).length > 0 && (
                      <pre className="mt-1 overflow-auto text-xs text-muted-foreground">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
