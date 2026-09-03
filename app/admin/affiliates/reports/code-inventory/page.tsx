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

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/lib/context/locale-context';

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
  const { t } = useLocale();
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
        throw new Error(
          t(
            'admin.affiliates.error_fetch_inventory',
            'Failed to fetch code inventory report'
          )
        );
      }

      const data = await response.json();
      setReport(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.affiliates.error_occurred', 'An error occurred')
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        throw new Error(
          data.error ||
            t('admin.affiliates.error_cancel_code', 'Failed to cancel code')
        );
      }

      setCancelSuccess(
        t(
          'admin.affiliates.code_cancelled_success',
          'Code {code} cancelled successfully.'
        ).replace('{code}', data.code.code)
      );
      setCancelCodeInput('');
      setCancelReason('');
      setShowCancelConfirm(false);
      void fetchReport();
    } catch (err) {
      setCancelError(
        err instanceof Error
          ? err.message
          : t('admin.affiliates.error_cancel', 'Failed to cancel')
      );
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/admin/affiliates"
          className="text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          &larr;{' '}
          {t('admin.affiliates.back_to_affiliates_short', 'Back to Affiliates')}
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-foreground sm:text-3xl">
          {t('admin.affiliates.inventory_title', 'Code Inventory Report')}
        </h1>
        <p className="text-muted-foreground">
          {t(
            'admin.affiliates.inventory_subtitle',
            'Affiliate code distribution and usage statistics'
          )}
        </p>
      </div>

      {/* Period Selector */}
      <div className="inline-flex overflow-hidden rounded-lg border border-border">
        {(['3months', '6months', '1year'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              period === p
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:bg-accent'
            }`}
          >
            {p === '3months'
              ? t('admin.affiliates.period_3months', '3 Months')
              : p === '6months'
                ? t('admin.affiliates.period_6months', '6 Months')
                : t('admin.affiliates.period_1year', '1 Year')}
          </button>
        ))}
      </div>

      {/* Cancel a Code */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            {t('admin.affiliates.cancel_a_code', 'Cancel a Code')}
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            {t(
              'admin.affiliates.cancel_a_code_desc',
              'Enter an active affiliate code to cancel it. Already-used or already-cancelled codes cannot be cancelled.'
            )}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={cancelCodeInput}
              onChange={(e) => setCancelCodeInput(e.target.value.toUpperCase())}
              placeholder="CODE123"
              aria-label={t(
                'admin.affiliates.code_to_cancel',
                'Code to cancel'
              )}
              className="flex-1 font-mono uppercase"
            />
            <AlertDialog
              open={showCancelConfirm}
              onOpenChange={setShowCancelConfirm}
            >
              <Button
                variant="destructive"
                onClick={() => setShowCancelConfirm(true)}
                disabled={!cancelCodeInput.trim()}
              >
                {t('admin.affiliates.cancel_code', 'Cancel Code')}
              </Button>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t(
                      'admin.affiliates.cancel_code_q',
                      'Cancel code {code}?'
                    ).replace('{code}', cancelCodeInput)}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t(
                      'admin.affiliates.cancel_code_desc',
                      'This immediately marks the code as CANCELLED and it can no longer be redeemed. This cannot be undone from this page.'
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="cancel-reason">
                    {t('admin.affiliates.reason_optional', 'Reason (optional)')}
                  </Label>
                  <Input
                    id="cancel-reason"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder={t(
                      'admin.affiliates.reason_placeholder_duplicate',
                      'e.g. Duplicate distribution'
                    )}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isCancelling}>
                    {t('admin.affiliates.keep_code', 'Keep Code')}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isCancelling}
                    onClick={() => void handleConfirmCancel()}
                    className="hover:bg-destructive/90 bg-destructive text-white"
                  >
                    {isCancelling
                      ? t('admin.affiliates.cancelling', 'Cancelling...')
                      : t('admin.affiliates.confirm_cancel', 'Confirm Cancel')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          {cancelError && (
            <p className="mt-2 text-sm text-red-500">{cancelError}</p>
          )}
          {cancelSuccess && (
            <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
              {cancelSuccess}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-500">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : report ? (
        <>
          {/* Alerts */}
          {(report.alerts.expiringIn7Days > 0 ||
            report.alerts.lowActiveCodesWarning) && (
            <div className="space-y-2">
              {report.alerts.expiringIn7Days > 0 && (
                <div className="flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-700 dark:text-amber-300">
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
                    <strong>{report.alerts.expiringIn7Days}</strong>{' '}
                    {t(
                      'admin.affiliates.codes_expiring_7days',
                      'codes expiring in the next 7 days'
                    )}
                  </span>
                </div>
              )}
              {report.alerts.lowActiveCodesWarning && (
                <div className="flex items-center rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-600 dark:text-red-400">
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
                    {t(
                      'admin.affiliates.low_active_codes_warning',
                      'Low active codes! Consider distributing more codes to affiliates.'
                    )}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Period Info */}
          <div className="bg-accent/50 rounded-lg px-4 py-3 text-sm text-muted-foreground">
            {t(
              'admin.affiliates.report_period',
              'Report period: {start} - {end}'
            )
              .replace('{start}', formatDate(report.period.start))
              .replace('{end}', formatDate(report.period.end))}
          </div>

          {/* All Time Stats */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              {t('admin.affiliates.all_time_statistics', 'All Time Statistics')}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-5">
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t('admin.affiliates.total_codes', 'Total Codes')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">
                    {report.allTime.totalCodes.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t('admin.affiliates.status_active', 'Active')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {report.allTime.byStatus.active.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t('admin.affiliates.status_used', 'Used')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-blue-500">
                    {report.allTime.byStatus.used.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t('admin.affiliates.status_expired', 'Expired')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-muted-foreground">
                    {report.allTime.byStatus.expired.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t('admin.dashboard.conversion_rate', 'Conversion Rate')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-primary">
                    {report.allTime.conversionRate}%
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Period Metrics */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              {t(
                'admin.affiliates.period_metrics',
                'Period Metrics ({period})'
              ).replace(
                '{period}',
                period === '3months'
                  ? t('admin.affiliates.period_3months', '3 Months')
                  : period === '6months'
                    ? t('admin.affiliates.period_6months', '6 Months')
                    : t('admin.affiliates.period_1year', '1 Year')
              )}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t('admin.affiliates.distributed_col', 'Distributed')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-blue-500">
                    {report.periodMetrics.distributed.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t('admin.affiliates.status_used', 'Used')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {report.periodMetrics.used.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t('admin.affiliates.status_expired', 'Expired')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                    {report.periodMetrics.expired.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t(
                      'admin.affiliates.period_conversion',
                      'Period Conversion'
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-primary">
                    {report.periodMetrics.periodConversionRate}%
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Distribution Breakdown */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* By Status */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">
                  {t('admin.affiliates.codes_by_status', 'Codes by Status')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t('admin.affiliates.status_active', 'Active')}
                    </span>
                    <span className="font-medium text-foreground">
                      {report.allTime.byStatus.active.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-muted">
                    <div
                      className="h-3 rounded-full bg-emerald-500"
                      style={{
                        width: `${(report.allTime.byStatus.active / report.allTime.totalCodes) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t('admin.affiliates.status_used', 'Used')}
                    </span>
                    <span className="font-medium text-foreground">
                      {report.allTime.byStatus.used.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-muted">
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
                    <span className="text-muted-foreground">
                      {t('admin.affiliates.status_expired', 'Expired')}
                    </span>
                    <span className="font-medium text-foreground">
                      {report.allTime.byStatus.expired.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-muted">
                    <div
                      className="bg-muted-foreground/50 h-3 rounded-full"
                      style={{
                        width: `${(report.allTime.byStatus.expired / report.allTime.totalCodes) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t('admin.affiliates.status_cancelled', 'Cancelled')}
                    </span>
                    <span className="font-medium text-foreground">
                      {report.allTime.byStatus.cancelled.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-muted">
                    <div
                      className="h-3 rounded-full bg-red-500"
                      style={{
                        width: `${(report.allTime.byStatus.cancelled / report.allTime.totalCodes) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* By Distribution Reason */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">
                  {t(
                    'admin.affiliates.codes_by_distribution_reason',
                    'Codes by Distribution Reason'
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t(
                        'admin.affiliates.initial_distribution',
                        'Initial Distribution'
                      )}
                    </span>
                    <span className="font-medium text-foreground">
                      {report.allTime.byReason.initial.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-muted">
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
                    <span className="text-muted-foreground">
                      {t(
                        'admin.affiliates.monthly_distribution',
                        'Monthly Distribution'
                      )}
                    </span>
                    <span className="font-medium text-foreground">
                      {report.allTime.byReason.monthly.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-muted">
                    <div
                      className="h-3 rounded-full bg-emerald-500"
                      style={{
                        width: `${(report.allTime.byReason.monthly / report.allTime.totalCodes) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t('admin.affiliates.admin_bonus', 'Admin Bonus')}
                    </span>
                    <span className="font-medium text-foreground">
                      {report.allTime.byReason.adminBonus.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-muted">
                    <div
                      className="h-3 rounded-full bg-primary"
                      style={{
                        width: `${(report.allTime.byReason.adminBonus / report.allTime.totalCodes) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
