/**
 * Affiliate Commissions Page
 *
 * Displays commission history with filtering and pagination.
 * Shows earned amounts, status, and payment dates.
 *
 * @module app/affiliate/dashboard/commissions/page
 */

'use client';

import React, { useEffect, useState } from 'react';

import { CommissionTable } from '@/components/affiliate/commission-table';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE DEFINITIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type CommissionStatus = 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED';

interface Commission {
  id: string;
  amount: number;
  status: CommissionStatus;
  earnedAt: Date;
  paidAt: Date | null;
  affiliateCode: {
    code: string;
  };
}

interface CommissionsResponse {
  commissions: Commission[];
  total: number;
  page: number;
  limit: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Affiliate Commissions Page
 * Lists all commissions with filtering
 */
export default function AffiliateCommissionsPage(): React.ReactElement {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<CommissionStatus | 'ALL'>(
    'ALL'
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const limit = 20;

  useEffect(() => {
    const fetchCommissions = async (): Promise<void> => {
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });

        if (statusFilter !== 'ALL') {
          params.set('status', statusFilter);
        }

        const response = await fetch(
          `/api/affiliate/dashboard/commission-report?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error('Failed to load commissions');
        }

        const data: CommissionsResponse = await response.json();
        setCommissions(data.commissions);
        setTotal(data.total);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load commissions'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchCommissions();
  }, [page, statusFilter]);

  const totalPages = Math.ceil(total / limit);

  // Calculate totals
  const totalEarned = commissions.reduce((sum, c) => sum + c.amount, 0);
  const pendingAmount = commissions
    .filter((c) => c.status === 'PENDING' || c.status === 'APPROVED')
    .reduce((sum, c) => sum + c.amount, 0);
  const paidAmount = commissions
    .filter((c) => c.status === 'PAID')
    .reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commissions</h1>
          <p className="text-gray-600">Track your earnings from referrals</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Total Earned (This Page)</p>
          <p className="text-2xl font-bold text-gray-900">
            ${totalEarned.toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">
            ${pendingAmount.toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Paid</p>
          <p className="text-2xl font-bold text-green-600">
            ${paidAmount.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label
              htmlFor="statusFilter"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Status
            </label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as CommissionStatus | 'ALL');
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="PAID">Paid</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="ml-auto text-sm text-gray-600">
            Showing {commissions.length} of {total} commissions
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Commissions Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <CommissionTable commissions={commissions} />
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {/* Info Section */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-3">
          Commission Status Guide
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
              PENDING
            </span>
            <span className="text-gray-600">Awaiting approval</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
              APPROVED
            </span>
            <span className="text-gray-600">Ready for payout</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
              PAID
            </span>
            <span className="text-gray-600">Payment completed</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
              CANCELLED
            </span>
            <span className="text-gray-600">Refund/cancellation</span>
          </div>
        </div>
      </div>
    </div>
  );
}
