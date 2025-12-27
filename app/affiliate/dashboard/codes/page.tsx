/**
 * Affiliate Codes Page
 *
 * Displays all affiliate codes with filtering and pagination.
 * Shows code status, distribution, and usage information.
 *
 * @module app/affiliate/dashboard/codes/page
 */

'use client';

import React, { useEffect, useState } from 'react';

import { CodeTable } from '@/components/affiliate/code-table';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE DEFINITIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type CodeStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';

interface AffiliateCode {
  id: string;
  code: string;
  status: CodeStatus;
  distributedAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
}

interface CodesResponse {
  codes: AffiliateCode[];
  total: number;
  page: number;
  limit: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Affiliate Codes Page
 * Lists all affiliate codes with filtering
 */
export default function AffiliateCodesPage(): React.ReactElement {
  const [codes, setCodes] = useState<AffiliateCode[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<CodeStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const limit = 20;

  useEffect(() => {
    const fetchCodes = async (): Promise<void> => {
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
          `/api/affiliate/dashboard/codes?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error('Failed to load codes');
        }

        const data: CodesResponse = await response.json();
        setCodes(data.codes);
        setTotal(data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load codes');
      } finally {
        setLoading(false);
      }
    };

    fetchCodes();
  }, [page, statusFilter]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Codes</h1>
          <p className="text-gray-600">Manage your affiliate codes</p>
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
                setStatusFilter(e.target.value as CodeStatus | 'ALL');
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="ALL">All Codes</option>
              <option value="ACTIVE">Active</option>
              <option value="USED">Used</option>
              <option value="EXPIRED">Expired</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="ml-auto text-sm text-gray-600">
            Showing {codes.length} of {total} codes
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Codes Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <CodeTable codes={codes} />
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
        <h3 className="font-semibold text-gray-900 mb-3">Code Status Guide</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
              ACTIVE
            </span>
            <span className="text-gray-600">Ready to share</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
              USED
            </span>
            <span className="text-gray-600">Successfully redeemed</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">
              EXPIRED
            </span>
            <span className="text-gray-600">Past expiration date</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
              CANCELLED
            </span>
            <span className="text-gray-600">Manually cancelled</span>
          </div>
        </div>
      </div>
    </div>
  );
}
