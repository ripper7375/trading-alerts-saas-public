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
import Link from 'next/link';

import { CommissionTable } from '@/components/affiliate/commission-table';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE DEFINITIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Real Prisma `CommissionStatus` enum (per-commission status, distinct
// from `PaymentBatchStatus` which describes the payout batch as a whole —
// see /affiliate/dashboard/payouts for batch-level Wise transfer status).
type CommissionStatus = 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED';

interface Commission {
  id: string;
  /** Real Prisma field is `commissionAmount` (Decimal, arrives as a
   *  string over JSON) — fixed Session 6-7, was silently `amount`
   *  (undefined on every real row, crashing CommissionTable's
   *  `.toFixed()` call the moment a real commission rendered). */
  commissionAmount: string | number;
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
  const totalEarned = commissions.reduce(
    (sum, c) => sum + Number(c.commissionAmount),
    0
  );
  const pendingAmount = commissions
    .filter((c) => c.status === 'PENDING' || c.status === 'APPROVED')
    .reduce((sum, c) => sum + Number(c.commissionAmount), 0);
  const paidAmount = commissions
    .filter((c) => c.status === 'PAID')
    .reduce((sum, c) => sum + Number(c.commissionAmount), 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commissions</h1>
          <p className="text-gray-600">Track your earnings from referrals</p>
        </div>
        <Link
          href="/affiliate/dashboard/payouts"
          className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          View Payout Status →
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-600">Total Earned (This Page)</p>
          <p className="text-2xl font-bold text-gray-900">
            ${totalEarned.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-600">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">
            ${pendingAmount.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-600">Paid</p>
          <p className="text-2xl font-bold text-green-600">
            ${paidAmount.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg bg-white p-4 shadow-md">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label
              htmlFor="statusFilter"
              className="mb-1 block text-sm font-medium text-gray-700"
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
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
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
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      {/* Commissions Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow-md">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
          </div>
        ) : (
          <CommissionTable commissions={commissions} />
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>

          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Info Section */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
        <h3 className="mb-3 font-semibold text-gray-900">
          Commission Status Guide
        </h3>
        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-2">
            <span className="rounded bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
              PENDING
            </span>
            <span className="text-gray-600">Awaiting approval</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
              APPROVED
            </span>
            <span className="text-gray-600">Ready for payout</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
              PAID
            </span>
            <span className="text-gray-600">Payment completed</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
              CANCELLED
            </span>
            <span className="text-gray-600">Refund/cancellation</span>
          </div>
        </div>
      </div>
    </div>
  );
}
