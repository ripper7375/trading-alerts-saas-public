'use client';

import Link from 'next/link';
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
  DisbursementProvider,
} from '@/types/disbursement';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PaymentBatch {
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
}

interface BatchPreviewItem {
  affiliateId: string;
  commissionCount: number;
  totalAmount: number;
  eligible: boolean;
  reason?: string;
}

interface BatchPreviewSummary {
  totalAffiliates: number;
  eligibleAffiliates: number;
  totalAmount: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getStatusBadge(status: PaymentBatchStatus): React.ReactElement {
  const statusConfig: Record<
    PaymentBatchStatus,
    { className: string; label: string }
  > = {
    PENDING: {
      className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      label: 'Pending',
    },
    QUEUED: {
      className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      label: 'Queued',
    },
    PROCESSING: {
      className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
      label: 'Processing',
    },
    COMPLETED: {
      className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      label: 'Completed',
    },
    FAILED: {
      className: 'bg-red-500/10 text-red-600 dark:text-red-400',
      label: 'Failed',
    },
    CANCELLED: {
      className: 'bg-muted text-muted-foreground',
      label: 'Cancelled',
    },
  };

  const config = statusConfig[status];

  return (
    <Badge className={`${config.className} text-xs`}>{config.label}</Badge>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PAYMENT BATCHES PAGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Payment Batches Page - Client Component
 *
 * Features:
 * - List of all payment batches
 * - Status filter
 * - Create new batch functionality
 * - Preview batch before creation
 * - Execute pending batches
 * - Delete cancelled/failed batches
 *
 * Data fetching:
 * - Fetches from /api/disbursement/batches
 */
export default function PaymentBatchesPage(): React.ReactElement {
  const [batches, setBatches] = useState<PaymentBatch[]>([]);
  const [statusFilter, setStatusFilter] = useState<PaymentBatchStatus | 'ALL'>(
    'ALL'
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [preview, setPreview] = useState<{
    items: BatchPreviewItem[];
    summary: BatchPreviewSummary;
  } | null>(null);

  const fetchBatches = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      const url =
        statusFilter === 'ALL'
          ? '/api/disbursement/batches'
          : `/api/disbursement/batches?status=${statusFilter}`;

      const response = await fetch(url);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch batches');
      }

      const data = await response.json();
      setBatches(data.batches || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void fetchBatches();
  }, [fetchBatches]);

  const handlePreviewBatch = async (): Promise<void> => {
    try {
      setIsProcessing(true);
      setError(null);

      const response = await fetch('/api/disbursement/batches/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to preview batch');
      }

      const data = await response.json();
      setPreview({
        items: data.preview || [],
        summary: data.summary || {
          totalAffiliates: 0,
          eligibleAffiliates: 0,
          totalAmount: 0,
        },
      });
      setShowCreateModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview batch');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateBatch = async (): Promise<void> => {
    try {
      setIsProcessing(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/disbursement/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create batch');
      }

      const data = await response.json();
      setSuccessMessage(`Batch created: ${data.batch.batchNumber}`);
      setShowCreateModal(false);
      setPreview(null);
      void fetchBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create batch');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteBatch = async (batchId: string): Promise<void> => {
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
      void fetchBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute batch');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteBatch = async (batchId: string): Promise<void> => {
    try {
      setIsProcessing(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch(`/api/disbursement/batches/${batchId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete batch');
      }

      setSuccessMessage('Batch deleted successfully');
      void fetchBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete batch');
    } finally {
      setIsProcessing(false);
    }
  };

  const statusOptions: (PaymentBatchStatus | 'ALL')[] = [
    'ALL',
    'PENDING',
    'QUEUED',
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
            Payment Batches
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage and execute payment batches
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => void fetchBatches()}
            variant="outline"
            disabled={isLoading}
          >
            Refresh
          </Button>
          <Button
            onClick={() => void handlePreviewBatch()}
            disabled={isProcessing}
          >
            {isProcessing ? 'Loading...' : 'Create Batch'}
          </Button>
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

      {/* Status Filter */}
      <Card className="border-border bg-card">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
              >
                {status === 'ALL' ? 'All Batches' : status}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Batches Table */}
      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-green-500" />
        </div>
      ) : batches.length > 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Batch #
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Payments
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Provider
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Created
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr
                      key={batch.id}
                      className="border-border/50 hover:bg-accent/30 border-b"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/disbursement/batches/${batch.id}`}
                          className="hover:text-primary/80 font-medium text-primary"
                        >
                          {batch.batchNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(batch.status)}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {batch.paymentCount}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-green-400">
                          {formatCurrency(batch.totalAmount)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className="bg-muted text-xs text-muted-foreground">
                          {batch.provider}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(batch.createdAt)}
                      </td>
                      <td className="space-x-2 px-4 py-3 text-right">
                        {batch.status === 'PENDING' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" disabled={isProcessing}>
                                Execute
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Confirm batch execution
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Execute batch{' '}
                                  <strong>{batch.batchNumber}</strong> —{' '}
                                  {batch.paymentCount} payment
                                  {batch.paymentCount === 1 ? '' : 's'},{' '}
                                  <strong>
                                    {formatCurrency(batch.totalAmount)}
                                  </strong>{' '}
                                  via <strong>{batch.provider}</strong>? This
                                  triggers real transfers through that provider
                                  and cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    void handleExecuteBatch(batch.id)
                                  }
                                >
                                  Execute
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        {(batch.status === 'PENDING' ||
                          batch.status === 'CANCELLED' ||
                          batch.status === 'FAILED') && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={isProcessing}
                              >
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
                                  <strong>{batch.batchNumber}</strong> (
                                  {batch.paymentCount} payment
                                  {batch.paymentCount === 1 ? '' : 's'},{' '}
                                  {formatCurrency(batch.totalAmount)}). This
                                  cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    void handleDeleteBatch(batch.id)
                                  }
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        <Link href={`/admin/disbursement/batches/${batch.id}`}>
                          <Button size="sm" variant="outline">
                            Details
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No batches found.</p>
          </CardContent>
        </Card>
      )}

      {/* Create Batch Modal */}
      {showCreateModal && preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-h-[80vh] w-full max-w-2xl overflow-auto border-border bg-card">
            <CardHeader>
              <CardTitle className="text-foreground">
                Create Payment Batch
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Review the batch preview before creating
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-accent/50 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground">
                    Total Affiliates
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {preview.summary.totalAffiliates}
                  </p>
                </div>
                <div className="bg-accent/50 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground">Eligible</p>
                  <p className="text-2xl font-bold text-green-400">
                    {preview.summary.eligibleAffiliates}
                  </p>
                </div>
                <div className="bg-accent/50 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold text-green-400">
                    {formatCurrency(preview.summary.totalAmount)}
                  </p>
                </div>
              </div>

              {/* Preview Table */}
              {preview.items.length > 0 && (
                <div className="max-h-60 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border">
                        <th className="px-3 py-2 text-left text-muted-foreground">
                          Affiliate
                        </th>
                        <th className="px-3 py-2 text-left text-muted-foreground">
                          Commissions
                        </th>
                        <th className="px-3 py-2 text-left text-muted-foreground">
                          Amount
                        </th>
                        <th className="px-3 py-2 text-left text-muted-foreground">
                          Eligible
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.items.map((item) => (
                        <tr
                          key={item.affiliateId}
                          className="border-border/50 border-b"
                        >
                          <td className="px-3 py-2 text-xs text-foreground">
                            {item.affiliateId}
                          </td>
                          <td className="px-3 py-2 text-foreground">
                            {item.commissionCount}
                          </td>
                          <td className="px-3 py-2 text-green-400">
                            {formatCurrency(item.totalAmount)}
                          </td>
                          <td className="px-3 py-2">
                            {item.eligible ? (
                              <Badge className="bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400">
                                Yes
                              </Badge>
                            ) : (
                              <Badge className="bg-red-500/10 text-xs text-red-600 dark:text-red-400">
                                {item.reason || 'No'}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {preview.summary.eligibleAffiliates === 0 && (
                <p className="text-center text-yellow-400">
                  No eligible affiliates for payout.
                </p>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false);
                    setPreview(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleCreateBatch()}
                  disabled={
                    isProcessing || preview.summary.eligibleAffiliates === 0
                  }
                >
                  {isProcessing ? 'Creating...' : 'Create Batch'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
