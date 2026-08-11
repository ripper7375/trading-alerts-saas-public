'use client';

/**
 * Admin Code Inventory Report Page
 *
 * View global code distribution and usage statistics
 *
 * @module app/admin/affiliates/reports/code-inventory/page
 */

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface CodeInventoryReport {
  period: {
    start: string;
    end: string;
    name: string;
  };
  allTime: {
    totalCodes: number;
    byStatus: {
      active: number;
      used: number;
      expired: number;
      cancelled: number;
    };
    byReason: {
      initial: number;
      monthly: number;
      adminBonus: number;
    };
    conversionRate: number;
  };
  periodMetrics: {
    distributed: number;
    used: number;
    expired: number;
    periodConversionRate: number;
  };
  alerts: {
    expiringIn7Days: number;
    lowActiveCodesWarning: boolean;
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function CodeInventoryReportPage(): React.ReactElement {
  const [report, setReport] = useState<CodeInventoryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'3months' | '6months' | '1year'>(
    '3months'
  );

  // Cancel-code widget state. There is no per-code listing endpoint or UI
  // anywhere in this codebase (this report only shows aggregate counts by
  // status/reason, never individual code rows) -- `POST
  // /api/admin/codes/[code]/cancel` operates on one code at a time via its
  // own code string, so the cancel action is a standalone lookup form rather
  // than a per-row button (Session 6-6 deviation, see order Deviations).
  const [cancelCodeInput, setCancelCodeInput] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);

  const fetchReport = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/affiliates/reports/code-inventory?period=${period}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch code inventory report');
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

  const handleConfirmCancel = async (): Promise<void> => {
    const code = cancelCodeInput.trim();
    if (!code) return;

    setIsCancelling(true);
    setCancelError(null);
    setCancelSuccess(null);

    try {
      const response = await fetch(
        `/api/admin/codes/${encodeURIComponent(code)}/cancel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            cancelReason.trim() ? { reason: cancelReason.trim() } : {}
          ),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel code');
      }

      setCancelSuccess(`Code ${data.code.code} cancelled successfully.`);
      setCancelCodeInput('');
      setCancelReason('');
      setShowCancelConfirm(false);
      void fetchReport();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setIsCancelling(false);
    }
  };

  const formatDate = (date: string): string => {
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
          Code Inventory Report
        </h1>
        <p className="text-gray-600">
          Affiliate code distribution and usage statistics
        </p>
      </div>

      {/* Period Selector */}
      <div className="mb-6">
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-300">
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

      {/* Cancel a Code */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">
          Cancel a Code
        </h2>
        <p className="mb-3 text-xs text-gray-500">
          Enter an active affiliate code to cancel it. Already-used or
          already-cancelled codes cannot be cancelled.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={cancelCodeInput}
            onChange={(e) => setCancelCodeInput(e.target.value.toUpperCase())}
            placeholder="CODE123"
            aria-label="Code to cancel"
            className="flex-1 rounded border border-gray-300 px-3 py-2 font-mono text-sm uppercase focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => setShowCancelConfirm(true)}
            disabled={!cancelCodeInput.trim()}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel Code
          </button>
        </div>
        {cancelError && (
          <p className="mt-2 text-sm text-red-600">{cancelError}</p>
        )}
        {cancelSuccess && (
          <p className="mt-2 text-sm text-green-600">{cancelSuccess}</p>
        )}
      </div>

      {/* Cancel Confirmation Dialog */}
      {showCancelConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-code-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowCancelConfirm(false);
          }}
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3
              id="cancel-code-dialog-title"
              className="text-lg font-semibold text-gray-900"
            >
              Cancel code {cancelCodeInput}?
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              This immediately marks the code as CANCELLED and it can no longer
              be redeemed. This cannot be undone from this page.
            </p>
            <div className="mt-4">
              <label
                htmlFor="cancel-reason"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Reason (optional)
              </label>
              <input
                id="cancel-reason"
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Duplicate distribution"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                disabled={isCancelling}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Keep Code
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmCancel()}
                disabled={isCancelling}
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

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
          {/* Alerts */}
          {(report.alerts.expiringIn7Days > 0 ||
            report.alerts.lowActiveCodesWarning) && (
            <div className="mb-6 space-y-2">
              {report.alerts.expiringIn7Days > 0 && (
                <div className="flex items-center rounded border border-yellow-200 bg-yellow-50 px-4 py-3 text-yellow-800">
                  <svg
                    className="mr-2 h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>
                    <strong>{report.alerts.expiringIn7Days}</strong> codes
                    expiring in the next 7 days
                  </span>
                </div>
              )}
              {report.alerts.lowActiveCodesWarning && (
                <div className="flex items-center rounded border border-red-200 bg-red-50 px-4 py-3 text-red-800">
                  <svg
                    className="mr-2 h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>
                    Low active codes! Consider distributing more codes to
                    affiliates.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Period Info */}
          <div className="mb-6 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
            Report period: {formatDate(report.period.start)} -{' '}
            {formatDate(report.period.end)}
          </div>

          {/* All Time Stats */}
          <div className="mb-8">
            <h2 className="mb-4 text-lg font-semibold">All Time Statistics</h2>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="text-sm font-medium text-gray-500">
                  Total Codes
                </h3>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {report.allTime.totalCodes.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="text-sm font-medium text-gray-500">Active</h3>
                <p className="mt-2 text-3xl font-bold text-green-600">
                  {report.allTime.byStatus.active.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="text-sm font-medium text-gray-500">Used</h3>
                <p className="mt-2 text-3xl font-bold text-blue-600">
                  {report.allTime.byStatus.used.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="text-sm font-medium text-gray-500">Expired</h3>
                <p className="mt-2 text-3xl font-bold text-gray-600">
                  {report.allTime.byStatus.expired.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="text-sm font-medium text-gray-500">
                  Conversion Rate
                </h3>
                <p className="mt-2 text-3xl font-bold text-purple-600">
                  {report.allTime.conversionRate}%
                </p>
              </div>
            </div>
          </div>

          {/* Period Metrics */}
          <div className="mb-8">
            <h2 className="mb-4 text-lg font-semibold">
              Period Metrics (
              {period === '3months'
                ? '3 Months'
                : period === '6months'
                  ? '6 Months'
                  : '1 Year'}
              )
            </h2>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="text-sm font-medium text-gray-500">
                  Distributed
                </h3>
                <p className="mt-2 text-3xl font-bold text-blue-600">
                  {report.periodMetrics.distributed.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="text-sm font-medium text-gray-500">Used</h3>
                <p className="mt-2 text-3xl font-bold text-green-600">
                  {report.periodMetrics.used.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="text-sm font-medium text-gray-500">Expired</h3>
                <p className="mt-2 text-3xl font-bold text-orange-600">
                  {report.periodMetrics.expired.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="text-sm font-medium text-gray-500">
                  Period Conversion
                </h3>
                <p className="mt-2 text-3xl font-bold text-purple-600">
                  {report.periodMetrics.periodConversionRate}%
                </p>
              </div>
            </div>
          </div>

          {/* Distribution Breakdown */}
          <div className="grid grid-cols-2 gap-6">
            {/* By Status */}
            <div className="rounded-lg bg-white shadow">
              <div className="border-b border-gray-200 px-6 py-4">
                <h2 className="text-lg font-semibold">Codes by Status</h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-gray-600">Active</span>
                      <span className="font-medium">
                        {report.allTime.byStatus.active.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-gray-200">
                      <div
                        className="h-3 rounded-full bg-green-500"
                        style={{
                          width: `${(report.allTime.byStatus.active / report.allTime.totalCodes) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-gray-600">Used</span>
                      <span className="font-medium">
                        {report.allTime.byStatus.used.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-gray-200">
                      <div
                        className="h-3 rounded-full bg-blue-500"
                        style={{
                          width: `${(report.allTime.byStatus.used / report.allTime.totalCodes) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-gray-600">Expired</span>
                      <span className="font-medium">
                        {report.allTime.byStatus.expired.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-gray-200">
                      <div
                        className="h-3 rounded-full bg-gray-500"
                        style={{
                          width: `${(report.allTime.byStatus.expired / report.allTime.totalCodes) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-gray-600">Cancelled</span>
                      <span className="font-medium">
                        {report.allTime.byStatus.cancelled.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-gray-200">
                      <div
                        className="h-3 rounded-full bg-red-500"
                        style={{
                          width: `${(report.allTime.byStatus.cancelled / report.allTime.totalCodes) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* By Distribution Reason */}
            <div className="rounded-lg bg-white shadow">
              <div className="border-b border-gray-200 px-6 py-4">
                <h2 className="text-lg font-semibold">
                  Codes by Distribution Reason
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-gray-600">
                        Initial Distribution
                      </span>
                      <span className="font-medium">
                        {report.allTime.byReason.initial.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-gray-200">
                      <div
                        className="h-3 rounded-full bg-blue-500"
                        style={{
                          width: `${(report.allTime.byReason.initial / report.allTime.totalCodes) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-gray-600">
                        Monthly Distribution
                      </span>
                      <span className="font-medium">
                        {report.allTime.byReason.monthly.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-gray-200">
                      <div
                        className="h-3 rounded-full bg-green-500"
                        style={{
                          width: `${(report.allTime.byReason.monthly / report.allTime.totalCodes) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-gray-600">Admin Bonus</span>
                      <span className="font-medium">
                        {report.allTime.byReason.adminBonus.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-gray-200">
                      <div
                        className="h-3 rounded-full bg-purple-500"
                        style={{
                          width: `${(report.allTime.byReason.adminBonus / report.allTime.totalCodes) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
