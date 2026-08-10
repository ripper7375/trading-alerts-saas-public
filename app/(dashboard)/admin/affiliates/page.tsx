'use client';

/**
 * Admin Affiliate Management Page
 *
 * Lists all affiliates with filtering and actions
 *
 * @module app/admin/affiliates/page
 */

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface Affiliate {
  id: string;
  fullName: string;
  country: string;
  status: string;
  paymentMethod: string;
  totalCodesDistributed: number;
  totalCodesUsed: number;
  totalEarnings: number;
  pendingCommissions: number;
  user: {
    email: string;
  };
  affiliateCodes: Array<{
    id: string;
    code: string;
    status: string;
  }>;
}

interface AffiliatesResponse {
  affiliates: Affiliate[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function AdminAffiliatesPage(): React.ReactElement {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    status: '',
    country: '',
  });

  const fetchAffiliates = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.country) params.set('country', filters.country);
      params.set('page', pagination.page.toString());
      params.set('limit', pagination.limit.toString());

      const response = await fetch(`/api/admin/affiliates?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch affiliates');
      }

      const data: AffiliatesResponse = await response.json();
      setAffiliates(data.affiliates);
      setPagination((prev) => ({
        ...prev,
        total: data.total,
        totalPages: data.totalPages,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchAffiliates();
  }, [fetchAffiliates]);

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'PENDING_VERIFICATION':
        return 'bg-yellow-100 text-yellow-800';
      case 'SUSPENDED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (
    amount: number | { toNumber?: () => number }
  ): string => {
    const value =
      typeof amount === 'object' && amount.toNumber
        ? amount.toNumber()
        : Number(amount);
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Affiliate Management
        </h1>
        <p className="mt-2 text-gray-600">
          Manage affiliates, distribute codes, and view performance
        </p>
      </div>

      {/* Quick Links */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        <Link
          href="/admin/affiliates/reports/profit-loss"
          className="rounded-lg bg-blue-50 p-4 transition-colors hover:bg-blue-100"
        >
          <h3 className="font-semibold text-blue-800">P&L Report</h3>
          <p className="text-sm text-blue-600">Revenue & margins</p>
        </Link>
        <Link
          href="/admin/affiliates/reports/sales-performance"
          className="rounded-lg bg-green-50 p-4 transition-colors hover:bg-green-100"
        >
          <h3 className="font-semibold text-green-800">Sales Performance</h3>
          <p className="text-sm text-green-600">Top affiliates</p>
        </Link>
        <Link
          href="/admin/affiliates/reports/commission-owings"
          className="rounded-lg bg-yellow-50 p-4 transition-colors hover:bg-yellow-100"
        >
          <h3 className="font-semibold text-yellow-800">Commission Owings</h3>
          <p className="text-sm text-yellow-600">Pending payouts</p>
        </Link>
        <Link
          href="/admin/affiliates/reports/code-inventory"
          className="rounded-lg bg-purple-50 p-4 transition-colors hover:bg-purple-100"
        >
          <h3 className="font-semibold text-purple-800">Code Inventory</h3>
          <p className="text-sm text-purple-600">Distribution stats</p>
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-lg bg-white p-4 shadow">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING_VERIFICATION">Pending Verification</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Country
            </label>
            <input
              type="text"
              value={filters.country}
              onChange={(e) =>
                setFilters({ ...filters, country: e.target.value })
              }
              placeholder="US, UK, etc."
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setFilters({ status: '', country: '' })}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading affiliates...</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Name / Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Country
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Codes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Earnings
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {affiliates.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    No affiliates found
                  </td>
                </tr>
              ) : (
                affiliates.map((affiliate) => (
                  <tr key={affiliate.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">
                          {affiliate.fullName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {affiliate.user.email}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-700">
                      {affiliate.country}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(affiliate.status)}`}
                      >
                        {affiliate.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-700">
                      {affiliate.totalCodesUsed} /{' '}
                      {affiliate.totalCodesDistributed}
                      <span className="ml-1 text-gray-400">
                        ({affiliate.affiliateCodes.length} active)
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-gray-900">
                        {formatCurrency(affiliate.totalEarnings)}
                      </div>
                      <div className="text-sm text-yellow-600">
                        {formatCurrency(affiliate.pendingCommissions)} pending
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <Link
                        href={`/admin/affiliates/${affiliate.id}`}
                        className="font-medium text-blue-600 hover:text-blue-800"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-3">
              <div className="text-sm text-gray-700">
                Showing page {pagination.page} of {pagination.totalPages} (
                {pagination.total} total)
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      page: Math.max(1, prev.page - 1),
                    }))
                  }
                  disabled={pagination.page === 1}
                  className="rounded-md border border-gray-300 px-3 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      page: Math.min(prev.totalPages, prev.page + 1),
                    }))
                  }
                  disabled={pagination.page === pagination.totalPages}
                  className="rounded-md border border-gray-300 px-3 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
