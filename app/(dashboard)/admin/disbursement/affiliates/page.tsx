'use client';

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
import type { PayableAffiliate, RiseWorksKycStatus } from '@/types/disbursement';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PayableSummary {
  totalAffiliates: number;
  totalPendingAmount: number;
  readyForPayout: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getKycStatusBadge(status: RiseWorksKycStatus | 'none'): React.ReactElement {
  const defaultConfig = { className: 'bg-gray-600', label: 'No Account' };
  const statusConfig: Record<string, { className: string; label: string }> = {
    APPROVED: { className: 'bg-green-600', label: 'Approved' },
    PENDING: { className: 'bg-yellow-600', label: 'Pending' },
    SUBMITTED: { className: 'bg-blue-600', label: 'Submitted' },
    REJECTED: { className: 'bg-red-600', label: 'Rejected' },
    EXPIRED: { className: 'bg-gray-600', label: 'Expired' },
    none: defaultConfig,
  };

  const config = statusConfig[status] ?? defaultConfig;

  return (
    <Badge className={`${config.className} text-white text-xs`}>
      {config.label}
    </Badge>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PAYABLE AFFILIATES PAGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Payable Affiliates Page - Client Component
 *
 * Features:
 * - List of affiliates with pending commissions
 * - RiseWorks account status display
 * - Quick pay action for individual affiliates
 * - Batch creation for multiple affiliates
 * - Summary statistics
 *
 * Data fetching:
 * - Fetches from /api/disbursement/affiliates/payable
 */
export default function PayableAffiliatesPage(): React.ReactElement {
  const [affiliates, setAffiliates] = useState<PayableAffiliate[]>([]);
  const [summary, setSummary] = useState<PayableSummary | null>(null);
  const [selectedAffiliates, setSelectedAffiliates] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchAffiliates = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/disbursement/affiliates/payable');

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch affiliates');
      }

      const data = await response.json();
      setAffiliates(data.affiliates || []);
      setSummary(data.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAffiliates();
  }, [fetchAffiliates]);

  const handleSelectAffiliate = (id: string): void => {
    const newSelected = new Set(selectedAffiliates);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedAffiliates(newSelected);
  };

  const handleSelectAll = (): void => {
    if (selectedAffiliates.size === affiliates.filter(a => a.readyForPayout).length) {
      setSelectedAffiliates(new Set());
    } else {
      const readyIds = affiliates.filter(a => a.readyForPayout).map(a => a.id);
      setSelectedAffiliates(new Set(readyIds));
    }
  };

  const handleQuickPay = async (affiliateId: string): Promise<void> => {
    try {
      setIsProcessing(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/disbursement/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Payment failed');
      }

      const data = await response.json();
      setSuccessMessage(`Payment successful! Batch ID: ${data.result.batchId}`);
      void fetchAffiliates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateBatch = async (): Promise<void> => {
    if (selectedAffiliates.size === 0) return;

    try {
      setIsProcessing(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/disbursement/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affiliateIds: Array.from(selectedAffiliates),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create batch');
      }

      const data = await response.json();
      setSuccessMessage(`Batch created! ID: ${data.batch.id}`);
      setSelectedAffiliates(new Set());
      void fetchAffiliates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create batch');
    } finally {
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

  const readyAffiliates = affiliates.filter(a => a.readyForPayout);
  const notReadyAffiliates = affiliates.filter(a => !a.readyForPayout);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Payable Affiliates
          </h1>
          <p className="text-gray-400 mt-1">
            Affiliates with pending commission payouts
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => void fetchAffiliates()}
            variant="outline"
            disabled={isLoading}
          >
            Refresh
          </Button>
          {selectedAffiliates.size > 0 && (
            <Button
              onClick={() => void handleCreateBatch()}
              className="bg-green-600 hover:bg-green-700"
              disabled={isProcessing}
            >
              {isProcessing ? 'Creating...' : `Create Batch (${selectedAffiliates.size})`}
            </Button>
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

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">Total Affiliates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{summary.totalAffiliates}</div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">Ready for Payout</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-400">{summary.readyForPayout}</div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">Total Pending</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-400">
                {formatCurrency(summary.totalPendingAmount)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ready for Payout Table */}
      {readyAffiliates.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  Ready for Payout
                  <Badge className="bg-green-600">{readyAffiliates.length}</Badge>
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Affiliates with approved RiseWorks accounts
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedAffiliates.size === readyAffiliates.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">
                      <input
                        type="checkbox"
                        checked={selectedAffiliates.size === readyAffiliates.length}
                        onChange={handleSelectAll}
                        className="rounded"
                        aria-label="Select all affiliates"
                      />
                    </th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Affiliate</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Country</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Pending</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Commissions</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Oldest</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">KYC Status</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {readyAffiliates.map((affiliate) => (
                    <tr
                      key={affiliate.id}
                      className="border-b border-gray-700/50 hover:bg-gray-700/30"
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedAffiliates.has(affiliate.id)}
                          onChange={() => handleSelectAffiliate(affiliate.id)}
                          className="rounded"
                          aria-label={`Select ${affiliate.fullName}`}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-white font-medium">{affiliate.fullName}</p>
                          <p className="text-gray-400 text-xs">{affiliate.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-300">{affiliate.country}</td>
                      <td className="py-3 px-4">
                        <span className="text-green-400 font-medium">
                          {formatCurrency(affiliate.pendingAmount)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-300">
                        {affiliate.pendingCommissionCount}
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-xs">
                        {affiliate.oldestPendingDate
                          ? formatDate(affiliate.oldestPendingDate)
                          : '-'}
                      </td>
                      <td className="py-3 px-4">
                        {getKycStatusBadge(affiliate.riseAccount.kycStatus)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => void handleQuickPay(affiliate.id)}
                          disabled={isProcessing}
                        >
                          Pay Now
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Not Ready Table */}
      {notReadyAffiliates.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              Not Ready for Payout
              <Badge className="bg-gray-600">{notReadyAffiliates.length}</Badge>
            </CardTitle>
            <CardDescription className="text-gray-400">
              Affiliates pending KYC approval or missing RiseWorks account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Affiliate</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Country</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Pending</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Commissions</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">RiseWorks Status</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {notReadyAffiliates.map((affiliate) => (
                    <tr
                      key={affiliate.id}
                      className="border-b border-gray-700/50 hover:bg-gray-700/30"
                    >
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-white font-medium">{affiliate.fullName}</p>
                          <p className="text-gray-400 text-xs">{affiliate.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-300">{affiliate.country}</td>
                      <td className="py-3 px-4">
                        <span className="text-yellow-400 font-medium">
                          {formatCurrency(affiliate.pendingAmount)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-300">
                        {affiliate.pendingCommissionCount}
                      </td>
                      <td className="py-3 px-4">
                        {getKycStatusBadge(affiliate.riseAccount.kycStatus)}
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-sm">
                        {!affiliate.riseAccount.hasAccount
                          ? 'No RiseWorks account'
                          : affiliate.riseAccount.kycStatus !== 'APPROVED'
                          ? 'KYC not approved'
                          : 'Unknown'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {affiliates.length === 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="py-12 text-center">
            <p className="text-gray-400">No affiliates with pending payouts found.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
