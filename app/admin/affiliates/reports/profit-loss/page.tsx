'use client';

/**
 * Admin P&L Report Page
 *
 * View profit and loss metrics for affiliate program
 *
 * @module app/admin/affiliates/reports/profit-loss/page
 */

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PnLReport {
  period: {
    start: string;
    end: string;
    name: string;
  };
  revenue: {
    grossRevenue: number;
    discounts: number;
    netRevenue: number;
    discountPercent: number;
    averageTicket: number;
  };
  costs: {
    paidCommissions: number;
    pendingCommissions: number;
    approvedCommissions: number;
    totalCommissions: number;
    commissionPercent: number;
    averageCommission: number;
  };
  profit: {
    netProfit: number;
    margin: number;
  };
  volume: {
    totalSales: number;
    regularPrice: number;
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function ProfitLossReportPage(): React.ReactElement {
  const [report, setReport] = useState<PnLReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'3months' | '6months' | '1year'>(
    '3months'
  );

  const fetchReport = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/affiliates/reports/profit-loss?period=${period}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch P&L report');
      }

      const data = await response.json();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const formatCurrency = (amount: number): string => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date: string): string => {
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
        <h1 className="mt-4 text-3xl font-bold text-gray-900">
          Profit & Loss Report
        </h1>
        <p className="text-gray-600">Affiliate program financial overview</p>
      </div>

      {/* Period Selector */}
      <div className="mb-6">
        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
          {(['3months', '6months', '1year'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 text-sm font-medium ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {p === '3months'
                ? '3 Months'
                : p === '6months'
                  ? '6 Months'
                  : '1 Year'}
            </button>
          ))}
        </div>
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
          {/* Period Info */}
          <div className="bg-gray-50 px-4 py-3 rounded-lg mb-6 text-sm text-gray-600">
            Report period: {formatDate(report.period.start)} -{' '}
            {formatDate(report.period.end)}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">
                Gross Revenue
              </h3>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {formatCurrency(report.revenue.grossRevenue)}
              </p>
              <p className="text-sm text-gray-500">
                {report.volume.totalSales} sales
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">Net Revenue</h3>
              <p className="mt-2 text-3xl font-bold text-blue-600">
                {formatCurrency(report.revenue.netRevenue)}
              </p>
              <p className="text-sm text-gray-500">
                After {report.revenue.discountPercent}% discounts
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">
                Total Commissions
              </h3>
              <p className="mt-2 text-3xl font-bold text-orange-600">
                {formatCurrency(report.costs.totalCommissions)}
              </p>
              <p className="text-sm text-gray-500">
                {report.costs.commissionPercent}% commission rate
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">Net Profit</h3>
              <p className="mt-2 text-3xl font-bold text-green-600">
                {formatCurrency(report.profit.netProfit)}
              </p>
              <p className="text-sm text-gray-500">
                {report.profit.margin}% margin
              </p>
            </div>
          </div>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-2 gap-6">
            {/* Revenue Breakdown */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">Revenue Breakdown</h2>
              </div>
              <div className="p-6">
                <dl className="space-y-4">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">
                      Gross Revenue ({report.volume.totalSales} x $
                      {report.volume.regularPrice})
                    </dt>
                    <dd className="font-medium">
                      {formatCurrency(report.revenue.grossRevenue)}
                    </dd>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <dt>Less: Discounts ({report.revenue.discountPercent}%)</dt>
                    <dd className="font-medium">
                      -{formatCurrency(report.revenue.discounts)}
                    </dd>
                  </div>
                  <div className="flex justify-between pt-4 border-t border-gray-200">
                    <dt className="font-semibold">Net Revenue</dt>
                    <dd className="font-bold text-lg">
                      {formatCurrency(report.revenue.netRevenue)}
                    </dd>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <dt>Average Ticket</dt>
                    <dd>{formatCurrency(report.revenue.averageTicket)}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Commission Breakdown */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">Commission Breakdown</h2>
              </div>
              <div className="p-6">
                <dl className="space-y-4">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Paid Commissions</dt>
                    <dd className="font-medium text-green-600">
                      {formatCurrency(report.costs.paidCommissions)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">
                      Approved (Awaiting Payment)
                    </dt>
                    <dd className="font-medium text-blue-600">
                      {formatCurrency(report.costs.approvedCommissions)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Pending Approval</dt>
                    <dd className="font-medium text-yellow-600">
                      {formatCurrency(report.costs.pendingCommissions)}
                    </dd>
                  </div>
                  <div className="flex justify-between pt-4 border-t border-gray-200">
                    <dt className="font-semibold">Total Commissions</dt>
                    <dd className="font-bold text-lg">
                      {formatCurrency(report.costs.totalCommissions)}
                    </dd>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <dt>Average Commission</dt>
                    <dd>{formatCurrency(report.costs.averageCommission)}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          {/* Profit Summary */}
          <div className="mt-6 bg-green-50 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-green-800 mb-4">
              Profit Summary
            </h2>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-green-600">Net Revenue</p>
                <p className="text-2xl font-bold text-green-800">
                  {formatCurrency(report.revenue.netRevenue)}
                </p>
              </div>
              <div>
                <p className="text-sm text-green-600">Less: Commissions</p>
                <p className="text-2xl font-bold text-green-800">
                  -{formatCurrency(report.costs.totalCommissions)}
                </p>
              </div>
              <div>
                <p className="text-sm text-green-600">
                  Net Profit ({report.profit.margin}% margin)
                </p>
                <p className="text-2xl font-bold text-green-800">
                  {formatCurrency(report.profit.netProfit)}
                </p>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
