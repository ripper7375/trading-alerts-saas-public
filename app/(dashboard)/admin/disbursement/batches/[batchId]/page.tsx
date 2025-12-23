'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

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

function getBatchStatusBadge(status: PaymentBatchStatus): React.ReactElement {
  const statusConfig: Record<PaymentBatchStatus, { className: string; label: string }> = {
    PENDING: { className: 'bg-yellow-600', label: 'Pending' },
    QUEUED: { className: 'bg-blue-600', label: 'Queued' },
    PROCESSING: { className: 'bg-purple-600', label: 'Processing' },
    COMPLETED: { className: 'bg-green-600', label: 'Completed' },
    FAILED: { className: 'bg-red-600', label: 'Failed' },
    CANCELLED: { className: 'bg-gray-600', label: 'Cancelled' },
  };

  const config = statusConfig[status];

  return (
    <Badge className={`${config.className} text-white`}>
      {config.label}
    </Badge>
  );
}

function getTransactionStatusBadge(status: DisbursementTransactionStatus): React.ReactElement {
  const statusConfig: Record<DisbursementTransactionStatus, { className: string; label: string }> = {
    PENDING: { className: 'bg-yellow-600', label: 'Pending' },
    PROCESSING: { className: 'bg-blue-600', label: 'Processing' },
    COMPLETED: { className: 'bg-green-600', label: 'Completed' },
    FAILED: { className: 'bg-red-600', label: 'Failed' },
    CANCELLED: { className: 'bg-gray-600', label: 'Cancelled' },
  };

  const config = statusConfig[status];

  return (
    <Badge className={`${config.className} text-white text-xs`}>
      {config.label}
    </Badge>
  );
}

function getAuditStatusBadge(status: AuditLogStatus): React.ReactElement {
  const statusConfig: Record<AuditLogStatus, { className: string; label: string }> = {
    SUCCESS: { className: 'bg-green-600', label: 'Success' },
    FAILURE: { className: 'bg-red-600', label: 'Failure' },
    WARNING: { className: 'bg-yellow-600', label: 'Warning' },
    INFO: { className: 'bg-blue-600', label: 'Info' },
  };

  const config = statusConfig[status];

  return (
    <Badge className={`${config.className} text-white text-xs`}>
      {config.label}
    </Badge>
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
      setBatch(data.batch);
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

      const response = await fetch(`/api/disbursement/batches/${batchId}/execute`, {
        method: 'POST',
      });

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
    if (!confirm('Are you sure you want to delete this batch?')) return;

    try {
      setIsProcessing(true);
      const response = await fetch(`/api/disbursement/batches/${batchId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete batch');
      }

      window.location.href = '/admin/disbursement/batches';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete batch');
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500" />
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400 mb-4">{error || 'Batch not found'}</p>
        <Link href="/admin/disbursement/batches">
          <Button variant="outline">Back to Batches</Button>
        </Link>
      </div>
    );
  }

  const completedTransactions = batch.transactions.filter(t => t.status === 'COMPLETED');
  const failedTransactions = batch.transactions.filter(t => t.status === 'FAILED');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/admin/disbursement/batches"
              className="text-gray-400 hover:text-white text-sm"
            >
              ← Batches
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
            {batch.batchNumber}
            {getBatchStatusBadge(batch.status)}
          </h1>
          <p className="text-gray-400 mt-1">
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
              <Button
                onClick={() => void handleExecuteBatch()}
                className="bg-green-600 hover:bg-green-700"
                disabled={isProcessing}
              >
                {isProcessing ? 'Executing...' : 'Execute Batch'}
              </Button>
              <Button
                onClick={() => void handleDeleteBatch()}
                variant="destructive"
                disabled={isProcessing}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <Card className="bg-red-900/50 border-red-600">
          <CardContent className="py-4">
            <p className="text-red-300">{error}</p>
          </CardContent>
        </Card>
      )}

      {successMessage && (
        <Card className="bg-green-900/50 border-green-600">
          <CardContent className="py-4">
            <p className="text-green-300">{successMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* Batch Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400">Total Amount</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">
              {formatCurrency(batch.totalAmount)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400">Payments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{batch.paymentCount}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400">Completed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">
              {completedTransactions.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400">Failed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-400">
              {failedTransactions.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Batch Details Card */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Batch Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Provider</p>
              <p className="text-white">{batch.provider}</p>
            </div>
            <div>
              <p className="text-gray-400">Currency</p>
              <p className="text-white">{batch.currency}</p>
            </div>
            {batch.executedAt && (
              <div>
                <p className="text-gray-400">Executed At</p>
                <p className="text-white">{formatDate(batch.executedAt)}</p>
              </div>
            )}
            {batch.completedAt && (
              <div>
                <p className="text-gray-400">Completed At</p>
                <p className="text-white">{formatDate(batch.completedAt)}</p>
              </div>
            )}
            {batch.failedAt && (
              <div>
                <p className="text-gray-400">Failed At</p>
                <p className="text-white">{formatDate(batch.failedAt)}</p>
              </div>
            )}
            {batch.errorMessage && (
              <div className="sm:col-span-2">
                <p className="text-gray-400">Error Message</p>
                <p className="text-red-400">{batch.errorMessage}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            Transactions
            <Badge className="bg-gray-600">{batch.transactions.length}</Badge>
          </CardTitle>
          <CardDescription className="text-gray-400">
            Individual payment transactions in this batch
          </CardDescription>
        </CardHeader>
        <CardContent>
          {batch.transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Transaction ID</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Amount</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Payee</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Provider TX</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Retries</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-b border-gray-700/50 hover:bg-gray-700/30"
                    >
                      <td className="py-3 px-4">
                        <span className="text-gray-300 font-mono text-xs">
                          {tx.transactionId}
                        </span>
                      </td>
                      <td className="py-3 px-4">{getTransactionStatusBadge(tx.status)}</td>
                      <td className="py-3 px-4">
                        <span className="text-green-400 font-medium">
                          {formatCurrency(tx.amount)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-gray-400 font-mono text-xs">
                          {tx.payeeRiseId ? `${tx.payeeRiseId.slice(0, 10)}...` : '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-gray-400 text-xs">
                          {tx.providerTxId || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-400">{tx.retryCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">No transactions yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Audit Logs */}
      {batch.auditLogs && batch.auditLogs.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              Audit Logs
              <Badge className="bg-gray-600">{batch.auditLogs.length}</Badge>
            </CardTitle>
            <CardDescription className="text-gray-400">
              Activity history for this batch
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {batch.auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 bg-gray-700/50 rounded-lg"
                >
                  <div className="mt-1">{getAuditStatusBadge(log.status)}</div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{log.action}</p>
                    {log.actor && (
                      <p className="text-gray-400 text-xs">by {log.actor}</p>
                    )}
                    {log.details && Object.keys(log.details).length > 0 && (
                      <pre className="text-gray-400 text-xs mt-1 overflow-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                  <span className="text-gray-500 text-xs">
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
