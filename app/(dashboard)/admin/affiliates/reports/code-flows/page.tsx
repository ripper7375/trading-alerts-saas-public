'use client';

/**
 * Admin Code Flows Report Page (Session 6-6, A2-5)
 *
 * Wires the previously-orphaned `GET /api/admin/affiliates/reports/code-flows`
 * (zero UI consumers before this session) — a period reconciliation of
 * opening balance + additions - reductions = closing balance, complementing
 * the point-in-time `code-inventory` report. This page did not exist before
 * this session; the route already existed and returns `{ report:
 * GlobalCodeFlowsReport }` (`lib/affiliate/report-builder.ts`), consumed
 * here directly rather than through the code-inventory report's own
 * unwrapped-top-level shape (the two sibling routes wrap differently).
 *
 * @module app/(dashboard)/admin/affiliates/reports/code-flows/page
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface GlobalCodeFlowsReport {
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
  affiliatesWithActivity: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function currentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: now.toISOString().slice(0, 10),
  };
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function CodeFlowsReportPage(): React.ReactElement {
  const defaultRange = currentMonthRange();
  const [start, setStart] = useState(defaultRange.start);
  const [end, setEnd] = useState(defaultRange.end);
  const [report, setReport] = useState<GlobalCodeFlowsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        start: new Date(start).toISOString(),
        end: new Date(end + 'T23:59:59.999Z').toISOString(),
      });
      const response = await fetch(
        `/api/admin/affiliates/reports/code-flows?${params.toString()}`
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch code flows report');
      }

      const data = await response.json();
      setReport(data.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

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
          Code Flows Report
        </h1>
        <p className="text-gray-600">
          Period reconciliation of affiliate code distribution — opening +
          additions - reductions = closing
        </p>
      </div>

      {/* Date Range */}
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label
            htmlFor="flows-start"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Start
          </label>
          <input
            id="flows-start"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label
            htmlFor="flows-end"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            End
          </label>
          <input
            id="flows-end"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          type="button"
          onClick={() => void fetchReport()}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Refresh
        </button>
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
          <div className="mb-6 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
            Period: {formatDate(report.period.start)} -{' '}
            {formatDate(report.period.end)} ·{' '}
            <strong>{report.affiliatesWithActivity}</strong> affiliates with
            activity
          </div>

          {/* Reconciliation Summary */}
          <div className="mb-8 grid grid-cols-2 gap-6 lg:grid-cols-4">
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="text-sm font-medium text-gray-500">
                Opening Balance
              </h3>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {report.openingBalance.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="text-sm font-medium text-gray-500">Additions</h3>
              <p className="mt-2 text-3xl font-bold text-green-600">
                +{report.additions.total.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="text-sm font-medium text-gray-500">Reductions</h3>
              <p className="mt-2 text-3xl font-bold text-red-600">
                -{report.reductions.total.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-6 shadow">
              <h3 className="text-sm font-medium text-blue-700">
                Closing Balance
              </h3>
              <p className="mt-2 text-3xl font-bold text-blue-900">
                {report.closingBalance.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Additions Breakdown */}
            <div className="rounded-lg bg-white shadow">
              <div className="border-b border-gray-200 px-6 py-4">
                <h2 className="text-lg font-semibold">Additions by Reason</h2>
              </div>
              <div className="space-y-3 p-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Initial Distribution</span>
                  <span className="font-medium">
                    {report.additions.initialDistribution.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Monthly Distribution</span>
                  <span className="font-medium">
                    {report.additions.monthlyDistribution.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Admin Bonus</span>
                  <span className="font-medium">
                    {report.additions.bonusDistribution.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-3 text-sm font-semibold">
                  <span>Total</span>
                  <span>{report.additions.total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Reductions Breakdown */}
            <div className="rounded-lg bg-white shadow">
              <div className="border-b border-gray-200 px-6 py-4">
                <h2 className="text-lg font-semibold">Reductions</h2>
              </div>
              <div className="space-y-3 p-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Used</span>
                  <span className="font-medium">
                    {report.reductions.used.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Expired</span>
                  <span className="font-medium">
                    {report.reductions.expired.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Cancelled</span>
                  <span className="font-medium">
                    {report.reductions.cancelled.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-3 text-sm font-semibold">
                  <span>Total</span>
                  <span>{report.reductions.total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
