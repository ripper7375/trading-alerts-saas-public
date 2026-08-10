'use client';

/**
 * Admin Commission Owings Report Page
 *
 * View affiliates with pending commissions ready for payout
 *
 * @module app/admin/affiliates/reports/commission-owings/page
 */

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AffiliateOwing {
  id: string;
  fullName: string;
  email: string;
  country: string;
  paymentMethod: string;
  paymentDetails: Record<string, unknown>;
  balance: {
    pending: number;
    paid: number;
    total: number;
  };
  pendingCount: number;
  oldestPendingDate: string | null;
  readyForPayout: boolean;
}

interface CommissionOwingsReport {
  summary: {
    totalAffiliatesOwed: number;
    affiliatesReadyForPayout: number;
    totalOwed: number;
    minimumPayoutThreshold: number;
  };
  affiliates: AffiliateOwing[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function CommissionOwingsReportPage(): React.ReactElement {
  const [report, setReport] = useState<CommissionOwingsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchReport = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/affiliates/reports/commission-owings?page=${page}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch commission owings report');
      }

      const data = await response.json();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handlePayCommissions = async (
    affiliateId: string,
    fullName: string
  ): Promise<void> => {
    const paymentMethod = prompt(
      'Enter payment method (e.g., PayPal, Bank Transfer):'
    );
    if (!paymentMethod) return;

    const paymentReference = prompt('Enter payment reference/transaction ID:');
    if (!paymentReference) return;

    setActionLoading(affiliateId);
    try {
      const response = await fetch('/api/admin/commissions/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affiliateId,
          paymentMethod,
          paymentReference,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to process payment');
      }

      alert(`Successfully paid commissions to ${fullName}`);
      await fetchReport();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to process payment');
    } finally {
      setActionLoading(null);
    }
  };

  const formatCurrency = (amount: number): string => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date: string | null): string => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/affiliates"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          &larr; Back to Affiliates
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-gray-900">
          Commission Owings Report
        </h1>
        <p className="text-gray-600">
          Affiliates with pending commissions ready for payout
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="py-12 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading report...</p>
        </div>
      ) : report ? (
        <>
          {/* Summary Cards */}
          <div className="mb-8 grid grid-cols-4 gap-6">
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="text-sm font-medium text-gray-500">Total Owed</h3>
              <p className="mt-2 text-3xl font-bold text-orange-600">
                {formatCurrency(report.summary.totalOwed)}
              </p>
            </div>
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="text-sm font-medium text-gray-500">
                Affiliates Owed
              </h3>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {report.summary.totalAffiliatesOwed}
              </p>
            </div>
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="text-sm font-medium text-gray-500">
                Ready for Payout
              </h3>
              <p className="mt-2 text-3xl font-bold text-green-600">
                {report.summary.affiliatesReadyForPayout}
              </p>
              <p className="text-sm text-gray-500">
                ≥ {formatCurrency(report.summary.minimumPayoutThreshold)}
              </p>
            </div>
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="text-sm font-medium text-gray-500">
                Min Payout Threshold
              </h3>
              <p className="mt-2 text-3xl font-bold text-blue-600">
                {formatCurrency(report.summary.minimumPayoutThreshold)}
              </p>
            </div>
          </div>

          {/* Affiliates Table */}
          <div className="rounded-lg bg-white shadow">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold">
                Affiliates with Pending Commissions
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Affiliate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Country
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Payment Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Pending Balance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Pending Count
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Oldest Pending
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {report.affiliates.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        No affiliates with pending commissions above threshold
                      </td>
                    </tr>
                  ) : (
                    report.affiliates.map((affiliate) => (
                      <tr key={affiliate.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-gray-900">
                              {affiliate.fullName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {affiliate.email}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          {affiliate.country}
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          {affiliate.paymentMethod}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-lg font-semibold text-orange-600">
                            {formatCurrency(affiliate.balance.pending)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          {affiliate.pendingCount}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDate(affiliate.oldestPendingDate)}
                        </td>
                        <td className="px-6 py-4">
                          {affiliate.readyForPayout ? (
                            <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                              Ready
                            </span>
                          ) : (
                            <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                              Below Min
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex space-x-2">
                            <Link
                              href={`/admin/affiliates/${affiliate.id}`}
                              className="text-sm text-blue-600 hover:text-blue-800"
                            >
                              View
                            </Link>
                            {affiliate.readyForPayout && (
                              <button
                                onClick={() =>
                                  handlePayCommissions(
                                    affiliate.id,
                                    affiliate.fullName
                                  )
                                }
                                disabled={actionLoading === affiliate.id}
                                className="text-sm font-medium text-green-600 hover:text-green-800 disabled:opacity-50"
                              >
                                {actionLoading === affiliate.id
                                  ? 'Processing...'
                                  : 'Pay'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {report.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-3">
                <div className="text-sm text-gray-700">
                  Page {report.pagination.page} of{' '}
                  {report.pagination.totalPages} ({report.pagination.total}{' '}
                  total)
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="rounded-md border border-gray-300 px-3 py-1 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() =>
                      setPage(Math.min(report.pagination.totalPages, page + 1))
                    }
                    disabled={page === report.pagination.totalPages}
                    className="rounded-md border border-gray-300 px-3 py-1 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
