/**
 * Affiliate Code Inventory Report Page (Session 6-7, A2-6)
 *
 * Wires the already-live GET /api/affiliate/dashboard/code-inventory
 * endpoint (zero UI consumer before this session). Shows opening/closing
 * code balance for a period, additions by distribution reason, and
 * reductions by outcome — matching lib/affiliate/report-builder.ts's
 * CodeInventoryReport shape exactly (Data Contract dial LOW).
 *
 * @module app/affiliate/dashboard/code-inventory/page
 */

'use client';

import React, { useEffect, useState } from 'react';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE DEFINITIONS — mirrors lib/affiliate/report-builder.ts's
// CodeInventoryReport exactly
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface CodeInventoryReport {
  period: { start: string; end: string };
  openingBalance: number;
  additions: {
    monthlyDistribution: number;
    initialDistribution: number;
    bonusDistribution: number;
    total: number;
  };
  reductions: {
    used: number;
    expired: number;
    cancelled: number;
    total: number;
  };
  closingBalance: number;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function AffiliateCodeInventoryPage(): React.ReactElement {
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [startDate, setStartDate] = useState(isoDate(thirtyDaysAgo));
  const [endDate, setEndDate] = useState(isoDate(today));
  const [report, setReport] = useState<CodeInventoryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchReport = async (): Promise<void> => {
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams({ startDate, endDate });
        const response = await fetch(
          `/api/affiliate/dashboard/code-inventory?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error('Failed to load code inventory report');
        }

        const data: CodeInventoryReport = await response.json();
        setReport(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load code inventory report'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [startDate, endDate]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Code Inventory</h1>
        <p className="text-gray-600">
          Track how your referral codes moved in and out over a period
        </p>
      </div>

      {/* Date Range */}
      <div className="rounded-lg bg-white p-4 shadow-md">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label
              htmlFor="startDate"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Start Date
            </label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="endDate"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              End Date
            </label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              min={startDate}
              max={isoDate(today)}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      ) : (
        report && (
          <>
            {/* Balance Summary */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg bg-white p-4 shadow">
                <p className="text-sm text-gray-600">Opening Balance</p>
                <p className="text-2xl font-bold text-gray-900">
                  {report.openingBalance}
                </p>
              </div>
              <div className="rounded-lg bg-white p-4 shadow">
                <p className="text-sm text-gray-600">Closing Balance</p>
                <p className="text-2xl font-bold text-gray-900">
                  {report.closingBalance}
                </p>
              </div>
            </div>

            {/* Additions / Reductions Breakdown */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg bg-white p-6 shadow-md">
                <h3 className="mb-4 font-semibold text-gray-900">
                  Additions ({report.additions.total})
                </h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Monthly distribution</dt>
                    <dd className="font-medium">
                      {report.additions.monthlyDistribution}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Initial distribution</dt>
                    <dd className="font-medium">
                      {report.additions.initialDistribution}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Admin bonus</dt>
                    <dd className="font-medium">
                      {report.additions.bonusDistribution}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-lg bg-white p-6 shadow-md">
                <h3 className="mb-4 font-semibold text-gray-900">
                  Reductions ({report.reductions.total})
                </h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Used</dt>
                    <dd className="font-medium">{report.reductions.used}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Expired</dt>
                    <dd className="font-medium">{report.reductions.expired}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Cancelled</dt>
                    <dd className="font-medium">
                      {report.reductions.cancelled}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Period: {new Date(report.period.start).toLocaleDateString()} –{' '}
              {new Date(report.period.end).toLocaleDateString()}
            </p>
          </>
        )
      )}
    </div>
  );
}
