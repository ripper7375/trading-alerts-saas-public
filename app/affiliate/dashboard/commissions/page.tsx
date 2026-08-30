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
  /**
   * davintrade-vat-stack follow-up: set only on a clawback deduction row --
   * created when a refund/dispute arrives for a customer whose commission
   * was already PAID, netted against the next payout.
   */
  clawbackOfCommissionId?: string | null;
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
          <h1 className="text-2xl font-bold text-foreground">Commissions</h1>
          <p className="text-muted-foreground">
            Track your earnings from referrals
          </p>
        </div>
        <Link
          href="/affiliate/dashboard/payouts"
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
        >
          View Payout Status →
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Total Earned (This Page)
          </p>
          <p className="text-2xl font-bold text-foreground">
            ${totalEarned.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            ${pendingAmount.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Paid</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            ${paidAmount.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label
              htmlFor="statusFilter"
              className="mb-1 block text-sm font-medium text-foreground"
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
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="PAID">Paid</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="ml-auto text-sm text-muted-foreground">
            Showing {commissions.length} of {total} commissions
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Commissions Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-amber-500" />
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
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>

          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Info Section */}
      <div className="bg-muted/40 rounded-lg border border-border p-6">
        <h3 className="mb-3 font-semibold text-foreground">
          Commission Status Guide
        </h3>
        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-2">
            <span className="rounded border border-amber-500/30 bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              PENDING
            </span>
            <span className="text-muted-foreground">Awaiting approval</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded border border-blue-500/30 bg-blue-500/15 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-400">
              APPROVED
            </span>
            <span className="text-muted-foreground">Ready for payout</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded border border-green-500/30 bg-green-500/15 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-400">
              PAID
            </span>
            <span className="text-muted-foreground">Payment completed</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded border border-red-500/30 bg-red-500/15 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400">
              CANCELLED
            </span>
            <span className="text-muted-foreground">Refund/cancellation</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded border border-red-500/30 bg-red-500/15 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400">
              CLAWBACK
            </span>
            <span className="text-muted-foreground">
              Deduction for a refund on a commission already paid — offsets your
              next payout
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
