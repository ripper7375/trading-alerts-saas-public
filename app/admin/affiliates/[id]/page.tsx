'use client';

/**
 * Admin Affiliate Detail Page
 *
 * View and manage individual affiliate details
 *
 * @module app/admin/affiliates/[id]/page
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AffiliateCode {
  id: string;
  code: string;
  status: string;
  distributedAt: string;
  expiresAt: string;
  usedAt: string | null;
  distributionReason: string;
}

interface Commission {
  id: string;
  commissionAmount: number;
  status: string;
  earnedAt: string;
  paidAt: string | null;
}

interface AffiliateDetails {
  id: string;
  fullName: string;
  country: string;
  status: string;
  paymentMethod: string;
  paymentDetails: Record<string, unknown>;
  totalCodesDistributed: number;
  totalCodesUsed: number;
  totalEarnings: number;
  pendingCommissions: number;
  paidCommissions: number;
  verifiedAt: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  createdAt: string;
  user: {
    email: string;
    name: string | null;
  };
  affiliateCodes: AffiliateCode[];
  commissions: Commission[];
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function AdminAffiliateDetailPage(): React.ReactElement {
  const params = useParams();
  const affiliateId = params['id'] as string;

  const [affiliate, setAffiliate] = useState<AffiliateDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [distributeCount, setDistributeCount] = useState(10);
  const [distributeReason, setDistributeReason] = useState('');

  const fetchAffiliate = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/affiliates/${affiliateId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Affiliate not found');
        }
        throw new Error('Failed to fetch affiliate');
      }

      const data = await response.json();
      setAffiliate(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [affiliateId]);

  useEffect(() => {
    if (affiliateId) {
      fetchAffiliate();
    }
  }, [affiliateId, fetchAffiliate]);

  const handleSuspend = async (): Promise<void> => {
    const reason = prompt('Enter suspension reason:');
    if (!reason) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/affiliates/${affiliateId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        throw new Error('Failed to suspend affiliate');
      }

      await fetchAffiliate();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to suspend');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async (): Promise<void> => {
    if (!confirm('Are you sure you want to reactivate this affiliate?')) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/affiliates/${affiliateId}/reactivate`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to reactivate affiliate');
      }

      await fetchAffiliate();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reactivate');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDistributeCodes = async (): Promise<void> => {
    if (!distributeReason) {
      alert('Please enter a reason');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/affiliates/${affiliateId}/distribute-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: distributeCount, reason: distributeReason }),
      });

      if (!response.ok) {
        throw new Error('Failed to distribute codes');
      }

      setShowDistributeModal(false);
      setDistributeCount(10);
      setDistributeReason('');
      await fetchAffiliate();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to distribute codes');
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount: number | { toNumber?: () => number }): string => {
    const value = typeof amount === 'object' && amount.toNumber ? amount.toNumber() : Number(amount);
    return `$${value.toFixed(2)}`;
  };

  const formatDate = (date: string | null): string => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'PENDING_VERIFICATION':
        return 'bg-yellow-100 text-yellow-800';
      case 'SUSPENDED':
        return 'bg-red-100 text-red-800';
      case 'USED':
        return 'bg-blue-100 text-blue-800';
      case 'EXPIRED':
        return 'bg-gray-100 text-gray-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'PAID':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading affiliate details...</p>
        </div>
      </div>
    );
  }

  if (error || !affiliate) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || 'Affiliate not found'}
        </div>
        <Link
          href="/admin/affiliates"
          className="mt-4 inline-block text-blue-600 hover:text-blue-800"
        >
          &larr; Back to Affiliates
        </Link>
      </div>
    );
  }

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
        <div className="mt-4 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{affiliate.fullName}</h1>
            <p className="text-gray-600">{affiliate.user.email}</p>
          </div>
          <div className="flex space-x-3">
            {affiliate.status === 'ACTIVE' && (
              <>
                <button
                  onClick={() => setShowDistributeModal(true)}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Distribute Codes
                </button>
                <button
                  onClick={handleSuspend}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  Suspend
                </button>
              </>
            )}
            {affiliate.status === 'SUSPENDED' && (
              <button
                onClick={handleReactivate}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                Reactivate
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Profile Info */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Profile Information</h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-gray-600">Status</dt>
              <dd>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(affiliate.status)}`}>
                  {affiliate.status.replace('_', ' ')}
                </span>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Country</dt>
              <dd className="font-medium">{affiliate.country}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Payment Method</dt>
              <dd className="font-medium">{affiliate.paymentMethod}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Verified At</dt>
              <dd className="font-medium">{formatDate(affiliate.verifiedAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Joined</dt>
              <dd className="font-medium">{formatDate(affiliate.createdAt)}</dd>
            </div>
            {affiliate.suspensionReason && (
              <div className="pt-3 border-t border-gray-200">
                <dt className="text-red-600 text-sm">Suspension Reason:</dt>
                <dd className="text-red-800 font-medium">{affiliate.suspensionReason}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Earnings Summary</h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-gray-600">Total Earnings</dt>
              <dd className="font-medium text-lg">{formatCurrency(affiliate.totalEarnings)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Pending Commissions</dt>
              <dd className="font-medium text-yellow-600">{formatCurrency(affiliate.pendingCommissions)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Paid Commissions</dt>
              <dd className="font-medium text-green-600">{formatCurrency(affiliate.paidCommissions)}</dd>
            </div>
            <div className="flex justify-between pt-3 border-t border-gray-200">
              <dt className="text-gray-600">Codes Distributed</dt>
              <dd className="font-medium">{affiliate.totalCodesDistributed}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Codes Used</dt>
              <dd className="font-medium">{affiliate.totalCodesUsed}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Conversion Rate</dt>
              <dd className="font-medium">
                {affiliate.totalCodesDistributed > 0
                  ? ((affiliate.totalCodesUsed / affiliate.totalCodesDistributed) * 100).toFixed(1)
                  : 0}
                %
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Affiliate Codes */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Affiliate Codes ({affiliate.affiliateCodes.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Distributed</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Used</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {affiliate.affiliateCodes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No codes distributed yet
                  </td>
                </tr>
              ) : (
                affiliate.affiliateCodes.slice(0, 20).map((code) => (
                  <tr key={code.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-sm">{code.code}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(code.status)}`}>
                        {code.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{code.distributionReason}</td>
                    <td className="px-6 py-4 text-sm">{formatDate(code.distributedAt)}</td>
                    <td className="px-6 py-4 text-sm">{formatDate(code.expiresAt)}</td>
                    <td className="px-6 py-4 text-sm">{formatDate(code.usedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Commissions */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Recent Commissions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Earned</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {affiliate.commissions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No commissions yet
                  </td>
                </tr>
              ) : (
                affiliate.commissions.map((commission) => (
                  <tr key={commission.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">{formatCurrency(commission.commissionAmount)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(commission.status)}`}>
                        {commission.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">{formatDate(commission.earnedAt)}</td>
                    <td className="px-6 py-4 text-sm">{formatDate(commission.paidAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Distribute Modal */}
      {showDistributeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Distribute Bonus Codes</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Codes
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={distributeCount}
                  onChange={(e) => setDistributeCount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason
                </label>
                <input
                  type="text"
                  value={distributeReason}
                  onChange={(e) => setDistributeReason(e.target.value)}
                  placeholder="e.g., Performance bonus"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowDistributeModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDistributeCodes}
                disabled={actionLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading ? 'Distributing...' : 'Distribute'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
