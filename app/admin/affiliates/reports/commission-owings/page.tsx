'use client';

/**
 * Admin Commission Owings Report Page
 *
 * View affiliates with pending commissions ready for payout
 *
 * @module app/admin/affiliates/reports/commission-owings/page
 */

import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    fetchReport();
  }, [page]);

  const fetchReport = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/affiliates/reports/commission-owings?page=${page}`);

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
  };

  const handlePayCommissions = async (affiliateId: string, fullName: string): Promise<void> => {
    const paymentMethod = prompt('Enter payment method (e.g., PayPal, Bank Transfer):');
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
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/affiliates"
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          &larr; Back to Affiliates
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-gray-900">Commission Owings Report</h1>
        <p className="text-gray-600">Affiliates with pending commissions ready for payout</p>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading report...</p>
        </div>
      ) : report ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">Total Owed</h3>
              <p className="mt-2 text-3xl font-bold text-orange-600">
                {formatCurrency(report.summary.totalOwed)}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">Affiliates Owed</h3>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {report.summary.totalAffiliatesOwed}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">Ready for Payout</h3>
              <p className="mt-2 text-3xl font-bold text-green-600">
                {report.summary.affiliatesReadyForPayout}
              </p>
              <p className="text-sm text-gray-500">
                ≥ {formatCurrency(report.summary.minimumPayoutThreshold)}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">Min Payout Threshold</h3>
              <p className="mt-2 text-3xl font-bold text-blue-600">
                {formatCurrency(report.summary.minimumPayoutThreshold)}
              </p>
            </div>
          </div>

          {/* Affiliates Table */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Affiliates with Pending Commissions</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Affiliate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Country
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Payment Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Pending Balance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Pending Count
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Oldest Pending
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {report.affiliates.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                        No affiliates with pending commissions above threshold
                      </td>
                    </tr>
                  ) : (
                    report.affiliates.map((affiliate) => (
                      <tr key={affiliate.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-gray-900">{affiliate.fullName}</div>
                            <div className="text-sm text-gray-500">{affiliate.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-700">{affiliate.country}</td>
                        <td className="px-6 py-4 text-gray-700">{affiliate.paymentMethod}</td>
                        <td className="px-6 py-4">
                          <span className="text-lg font-semibold text-orange-600">
                            {formatCurrency(affiliate.balance.pending)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-700">{affiliate.pendingCount}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDate(affiliate.oldestPendingDate)}
                        </td>
                        <td className="px-6 py-4">
                          {affiliate.readyForPayout ? (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                              Ready
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                              Below Min
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex space-x-2">
                            <Link
                              href={`/admin/affiliates/${affiliate.id}`}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              View
                            </Link>
                            {affiliate.readyForPayout && (
                              <button
                                onClick={() => handlePayCommissions(affiliate.id, affiliate.fullName)}
                                disabled={actionLoading === affiliate.id}
                                className="text-green-600 hover:text-green-800 text-sm font-medium disabled:opacity-50"
                              >
                                {actionLoading === affiliate.id ? 'Processing...' : 'Pay'}
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
              <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  Page {report.pagination.page} of {report.pagination.totalPages} ({report.pagination.total} total)
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(Math.min(report.pagination.totalPages, page + 1))}
                    disabled={page === report.pagination.totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50"
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
