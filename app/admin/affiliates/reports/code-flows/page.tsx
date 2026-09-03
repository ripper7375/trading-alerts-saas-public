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

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/lib/context/locale-context';

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
  const { t } = useLocale();
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
        throw new Error(
          data.error ||
            t(
              'admin.affiliates.error_fetch_flows',
              'Failed to fetch code flows report'
            )
        );
      }

      const data = await response.json();
      setReport(data.report);
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
  }, [start, end]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

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
          {t('admin.affiliates.flows_title', 'Code Flows Report')}
        </h1>
        <p className="text-muted-foreground">
          {t(
            'admin.affiliates.flows_subtitle',
            'Period reconciliation of affiliate code distribution — opening + additions - reductions = closing'
          )}
        </p>
      </div>

      {/* Date Range */}
      <Card className="border-border bg-card">
        <CardContent className="flex flex-wrap items-end gap-4 p-4 sm:p-6">
          <div>
            <Label htmlFor="flows-start" className="mb-1 block">
              {t('admin.affiliates.start', 'Start')}
            </Label>
            <Input
              id="flows-start"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-auto"
            />
          </div>
          <div>
            <Label htmlFor="flows-end" className="mb-1 block">
              {t('admin.affiliates.end', 'End')}
            </Label>
            <Input
              id="flows-end"
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-auto"
            />
          </div>
          <Button onClick={() => void fetchReport()}>
            {t('Refresh', 'Refresh')}
          </Button>
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
          <div className="bg-accent/50 rounded-lg px-4 py-3 text-sm text-muted-foreground">
            {t(
              'admin.affiliates.flows_period_prefix',
              'Period: {start} - {end} ·'
            )
              .replace('{start}', formatDate(report.period.start))
              .replace('{end}', formatDate(report.period.end))}{' '}
            <strong className="text-foreground">
              {report.affiliatesWithActivity}
            </strong>{' '}
            {t(
              'admin.affiliates.affiliates_with_activity',
              'affiliates with activity'
            )}
          </div>

          {/* Reconciliation Summary */}
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('admin.affiliates.opening_balance', 'Opening Balance')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">
                  {report.openingBalance.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('admin.affiliates.additions', 'Additions')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  +{report.additions.total.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('admin.affiliates.reductions', 'Reductions')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-red-500">
                  -{report.reductions.total.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card className="border-primary/30 bg-primary/5 border-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-primary">
                  {t('admin.affiliates.closing_balance', 'Closing Balance')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">
                  {report.closingBalance.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Additions Breakdown */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">
                  {t(
                    'admin.affiliates.additions_by_reason',
                    'Additions by Reason'
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t(
                      'admin.affiliates.initial_distribution',
                      'Initial Distribution'
                    )}
                  </span>
                  <span className="font-medium text-foreground">
                    {report.additions.initialDistribution.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t(
                      'admin.affiliates.monthly_distribution',
                      'Monthly Distribution'
                    )}
                  </span>
                  <span className="font-medium text-foreground">
                    {report.additions.monthlyDistribution.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('admin.affiliates.admin_bonus', 'Admin Bonus')}
                  </span>
                  <span className="font-medium text-foreground">
                    {report.additions.bonusDistribution.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-3 text-sm font-semibold text-foreground">
                  <span>{t('admin.fraud.total', 'Total')}</span>
                  <span>{report.additions.total.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            {/* Reductions Breakdown */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">
                  {t('admin.affiliates.reductions', 'Reductions')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('admin.affiliates.status_used', 'Used')}
                  </span>
                  <span className="font-medium text-foreground">
                    {report.reductions.used.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('admin.affiliates.status_expired', 'Expired')}
                  </span>
                  <span className="font-medium text-foreground">
                    {report.reductions.expired.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('admin.affiliates.status_cancelled', 'Cancelled')}
                  </span>
                  <span className="font-medium text-foreground">
                    {report.reductions.cancelled.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-3 text-sm font-semibold text-foreground">
                  <span>{t('admin.fraud.total', 'Total')}</span>
                  <span>{report.reductions.total.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
