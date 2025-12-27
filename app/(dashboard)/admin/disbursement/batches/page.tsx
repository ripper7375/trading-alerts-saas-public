'use client';

import Link from 'next/link';
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
    PENDING: { className: 'bg-yellow-600', label: 'Pending' },
    QUEUED: { className: 'bg-blue-600', label: 'Queued' },
    PROCESSING: { className: 'bg-purple-600', label: 'Processing' },
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
    if (!confirm('Are you sure you want to delete this batch?')) return;

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Payment Batches
          </h1>
          <p className="text-gray-400 mt-1">
            Manage and execute payment batches
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => void fetchBatches()}
            variant="outline"
            disabled={isLoading}
            aria-label="Refresh payment batches list"
          >
            Refresh
          </Button>
          <Button
            onClick={() => void handlePreviewBatch()}
            className="bg-green-600 hover:bg-green-700"
            disabled={isProcessing}
            aria-label="Create new payment batch"
          >
            {isProcessing ? 'Loading...' : 'Create Batch'}
          </Button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <Card className="bg-red-900/50 border-red-600" role="alert" aria-live="polite">
          <CardContent className="py-4">
            <p className="text-red-300">{error}</p>
          </CardContent>
        </Card>
      )}

      {successMessage && (
        <Card className="bg-green-900/50 border-green-600" role="status" aria-live="polite">
          <CardContent className="py-4">
            <p className="text-green-300">{successMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* Status Filter */}
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter batches by status">
            {statusOptions.map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className={
                  statusFilter === status
                    ? 'bg-green-600 hover:bg-green-700'
                    : ''
                }
                aria-pressed={statusFilter === status}
                aria-label={`Filter by ${status === 'ALL' ? 'all batches' : status.toLowerCase()} status`}
              >
                {status === 'ALL' ? 'All Batches' : status}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Batches Table */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[200px]" role="status" aria-label="Loading payment batches">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" aria-hidden="true" />
          <span className="sr-only">Loading payment batches...</span>
        </div>
      ) : batches.length > 0 ? (
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">
                      Batch #
                    </th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">
                      Payments
                    </th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">
                      Amount
                    </th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">
                      Provider
                    </th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">
                      Created
                    </th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr
                      key={batch.id}
                      className="border-b border-gray-700/50 hover:bg-gray-700/30"
                    >
                      <td className="py-3 px-4">
                        <Link
                          href={`/admin/disbursement/batches/${batch.id}`}
                          className="text-blue-400 hover:text-blue-300 font-medium"
                        >
                          {batch.batchNumber}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(batch.status)}
                      </td>
                      <td className="py-3 px-4 text-gray-300">
                        {batch.paymentCount}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-green-400 font-medium">
                          {formatCurrency(batch.totalAmount)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className="bg-gray-600 text-white text-xs">
                          {batch.provider}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-xs">
                        {formatDate(batch.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {batch.status === 'PENDING' && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => void handleExecuteBatch(batch.id)}
                            disabled={isProcessing}
                            aria-label={`Execute batch ${batch.batchNumber}`}
                          >
                            Execute
                          </Button>
                        )}
                        {(batch.status === 'PENDING' ||
                          batch.status === 'CANCELLED' ||
                          batch.status === 'FAILED') && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => void handleDeleteBatch(batch.id)}
                            disabled={isProcessing}
                            aria-label={`Delete batch ${batch.batchNumber}`}
                          >
                            Delete
                          </Button>
                        )}
                        <Link href={`/admin/disbursement/batches/${batch.id}`} aria-label={`View details for batch ${batch.batchNumber}`}>
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
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="py-12 text-center">
            <p className="text-gray-400">No batches found.</p>
          </CardContent>
        </Card>
      )}

      {/* Create Batch Modal */}
      {showCreateModal && preview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="create-batch-title">
          <Card className="bg-gray-800 border-gray-700 max-w-2xl w-full max-h-[80vh] overflow-auto">
            <CardHeader>
              <CardTitle id="create-batch-title" className="text-white">Create Payment Batch</CardTitle>
              <CardDescription className="text-gray-400">
                Review the batch preview before creating
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <p className="text-gray-400 text-sm">Total Affiliates</p>
                  <p className="text-2xl font-bold text-white">
                    {preview.summary.totalAffiliates}
                  </p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <p className="text-gray-400 text-sm">Eligible</p>
                  <p className="text-2xl font-bold text-green-400">
                    {preview.summary.eligibleAffiliates}
                  </p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <p className="text-gray-400 text-sm">Total Amount</p>
                  <p className="text-2xl font-bold text-green-400">
                    {formatCurrency(preview.summary.totalAmount)}
                  </p>
                </div>
              </div>

              {/* Preview Table */}
              {preview.items.length > 0 && (
                <div className="max-h-60 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-800">
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-2 px-3 text-gray-400">
                          Affiliate
                        </th>
                        <th className="text-left py-2 px-3 text-gray-400">
                          Commissions
                        </th>
                        <th className="text-left py-2 px-3 text-gray-400">
                          Amount
                        </th>
                        <th className="text-left py-2 px-3 text-gray-400">
                          Eligible
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.items.map((item) => (
                        <tr
                          key={item.affiliateId}
                          className="border-b border-gray-700/50"
                        >
                          <td className="py-2 px-3 text-gray-300 text-xs">
                            {item.affiliateId}
                          </td>
                          <td className="py-2 px-3 text-gray-300">
                            {item.commissionCount}
                          </td>
                          <td className="py-2 px-3 text-green-400">
                            {formatCurrency(item.totalAmount)}
                          </td>
                          <td className="py-2 px-3">
                            {item.eligible ? (
                              <Badge className="bg-green-600 text-xs">
                                Yes
                              </Badge>
                            ) : (
                              <Badge className="bg-red-600 text-xs">
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
                <p className="text-yellow-400 text-center">
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
                  aria-label="Cancel batch creation"
                >
                  Cancel
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => void handleCreateBatch()}
                  disabled={
                    isProcessing || preview.summary.eligibleAffiliates === 0
                  }
                  aria-label={`Create batch with ${preview.summary.eligibleAffiliates} eligible affiliates`}
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
