'use client';

/**
 * Admin Sales Performance Report Page
 *
 * View top performing affiliates by conversions
 *
 * @module app/admin/affiliates/reports/sales-performance/page
 */

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface TopPerformer {
  id: string;
  fullName: string;
  email: string;
  country: string;
  metrics: {
    codesDistributed: number;
    codesUsed: number;
    conversionsPeriod: number;
    totalCommissions: number;
    conversionRate: number;
  };
}

interface SalesPerformanceReport {
  period: {
    start: string;
    end: string;
    name: string;
  };
  summary: {
    totalAffiliates: number;
    totalConversions: number;
    totalCommissionsEarned: number;
    averageConversionsPerAffiliate: number;
  };
  topPerformers: TopPerformer[];
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function SalesPerformanceReportPage(): React.ReactElement {
  const [report, setReport] = useState<SalesPerformanceReport | null>(null);
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
        `/api/admin/affiliates/reports/sales-performance?period=${period}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch sales performance report');
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
          Sales Performance Report
        </h1>
        <p className="text-gray-600">
          Top performing affiliates by conversions
        </p>
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
                Active Affiliates
              </h3>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {report.summary.totalAffiliates}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">
                Total Conversions
              </h3>
              <p className="mt-2 text-3xl font-bold text-green-600">
                {report.summary.totalConversions}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">
                Total Commissions
              </h3>
              <p className="mt-2 text-3xl font-bold text-blue-600">
                {formatCurrency(report.summary.totalCommissionsEarned)}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">
                Avg per Affiliate
              </h3>
              <p className="mt-2 text-3xl font-bold text-purple-600">
                {report.summary.averageConversionsPerAffiliate}
              </p>
              <p className="text-sm text-gray-500">conversions</p>
            </div>
          </div>

          {/* Top Performers Table */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Top Performers</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Affiliate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Country
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Conversions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Codes Used / Distributed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Conversion Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Commissions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {report.topPerformers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        No affiliates with conversions in this period
                      </td>
                    </tr>
                  ) : (
                    report.topPerformers.map((performer, index) => (
                      <tr key={performer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
                              index === 0
                                ? 'bg-yellow-100 text-yellow-800'
                                : index === 1
                                  ? 'bg-gray-100 text-gray-800'
                                  : index === 2
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-gray-50 text-gray-600'
                            }`}
                          >
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-gray-900">
                              {performer.fullName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {performer.email}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          {performer.country}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-lg font-semibold text-green-600">
                            {performer.metrics.conversionsPeriod}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          {performer.metrics.codesUsed} /{' '}
                          {performer.metrics.codesDistributed}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div
                                className="bg-green-500 h-2 rounded-full"
                                style={{
                                  width: `${Math.min(performer.metrics.conversionRate, 100)}%`,
                                }}
                              ></div>
                            </div>
                            <span className="text-sm text-gray-700">
                              {performer.metrics.conversionRate}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium">
                          {formatCurrency(performer.metrics.totalCommissions)}
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            href={`/admin/affiliates/${performer.id}`}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
