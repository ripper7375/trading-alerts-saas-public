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

import { useLocale } from '@/lib/context/locale-context';

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
  const { t, formatDate } = useLocale();
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
          throw new Error(
            t(
              'affiliate.codes.error_load_inventory',
              'Failed to load code inventory report'
            )
          );
        }

        const data: CodeInventoryReport = await response.json();
        setReport(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t(
                'affiliate.codes.error_load_inventory',
                'Failed to load code inventory report'
              )
        );
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t('affiliate.codes.code_inventory', 'Code Inventory')}
        </h1>
        <p className="text-muted-foreground">
          {t(
            'affiliate.codes.inventory_subtitle',
            'Track how your referral codes moved in and out over a period'
          )}
        </p>
      </div>

      {/* Date Range */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label
              htmlFor="startDate"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              {t('admin.api_usage.start_date', 'Start Date')}
            </label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div>
            <label
              htmlFor="endDate"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              {t('admin.api_usage.end_date', 'End Date')}
            </label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              min={startDate}
              max={isoDate(today)}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-amber-500" />
        </div>
      ) : (
        report && (
          <>
            {/* Balance Summary */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <p className="text-sm text-muted-foreground">
                  {t('affiliate.codes.opening_balance', 'Opening Balance')}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {report.openingBalance}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <p className="text-sm text-muted-foreground">
                  {t('affiliate.codes.closing_balance', 'Closing Balance')}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {report.closingBalance}
                </p>
              </div>
            </div>

            {/* Additions / Reductions Breakdown */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <h3 className="mb-4 font-semibold text-foreground">
                  {t('affiliate.codes.additions', 'Additions')} (
                  {report.additions.total})
                </h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      {t(
                        'affiliate.codes.monthly_distribution',
                        'Monthly distribution'
                      )}
                    </dt>
                    <dd className="font-medium text-foreground">
                      {report.additions.monthlyDistribution}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      {t(
                        'affiliate.codes.initial_distribution',
                        'Initial distribution'
                      )}
                    </dt>
                    <dd className="font-medium text-foreground">
                      {report.additions.initialDistribution}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      {t('affiliate.codes.admin_bonus', 'Admin bonus')}
                    </dt>
                    <dd className="font-medium text-foreground">
                      {report.additions.bonusDistribution}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <h3 className="mb-4 font-semibold text-foreground">
                  {t('affiliate.codes.reductions', 'Reductions')} (
                  {report.reductions.total})
                </h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      {t('affiliate.codes.used', 'Used')}
                    </dt>
                    <dd className="font-medium text-foreground">
                      {report.reductions.used}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      {t('affiliate.codes.status_expired', 'Expired')}
                    </dt>
                    <dd className="font-medium text-foreground">
                      {report.reductions.expired}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      {t('affiliate.codes.status_cancelled', 'Cancelled')}
                    </dt>
                    <dd className="font-medium text-foreground">
                      {report.reductions.cancelled}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {t('affiliate.codes.period_prefix', 'Period:')}{' '}
              {formatDate(report.period.start)} –{' '}
              {formatDate(report.period.end)}
            </p>
          </>
        )
      )}
    </div>
  );
}
