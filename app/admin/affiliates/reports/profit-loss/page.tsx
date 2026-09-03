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

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocale } from '@/lib/context/locale-context';

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
  const { t } = useLocale();
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
        throw new Error(
          t('admin.affiliates.error_fetch_pnl', 'Failed to fetch P&L report')
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
          {t('admin.affiliates.pnl_title', 'Profit & Loss Report')}
        </h1>
        <p className="text-muted-foreground">
          {t(
            'admin.affiliates.pnl_subtitle',
            'Affiliate program financial overview'
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
          {/* Period Info */}
          <div className="bg-accent/50 rounded-lg px-4 py-3 text-sm text-muted-foreground">
            {t(
              'admin.affiliates.report_period',
              'Report period: {start} - {end}'
            )
              .replace('{start}', formatDate(report.period.start))
              .replace('{end}', formatDate(report.period.end))}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('admin.affiliates.gross_revenue', 'Gross Revenue')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">
                  {formatCurrency(report.revenue.grossRevenue)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('admin.affiliates.n_sales', '{n} sales').replace(
                    '{n}',
                    String(report.volume.totalSales)
                  )}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('admin.affiliates.net_revenue', 'Net Revenue')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-500">
                  {formatCurrency(report.revenue.netRevenue)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t(
                    'admin.affiliates.after_n_percent_discounts',
                    'After {n}% discounts'
                  ).replace('{n}', String(report.revenue.discountPercent))}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('admin.affiliates.total_commissions', 'Total Commissions')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                  {formatCurrency(report.costs.totalCommissions)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t(
                    'admin.affiliates.n_percent_commission_rate',
                    '{n}% commission rate'
                  ).replace('{n}', String(report.costs.commissionPercent))}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('admin.affiliates.net_profit', 'Net Profit')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(report.profit.netProfit)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t(
                    'admin.affiliates.n_percent_margin',
                    '{n}% margin'
                  ).replace('{n}', String(report.profit.margin))}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Revenue Breakdown */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">
                  {t('admin.affiliates.revenue_breakdown', 'Revenue Breakdown')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-4">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      {t(
                        'admin.affiliates.gross_revenue_calc',
                        'Gross Revenue ({sales} x ${price})'
                      )
                        .replace('{sales}', String(report.volume.totalSales))
                        .replace('{price}', String(report.volume.regularPrice))}
                    </dt>
                    <dd className="font-medium text-foreground">
                      {formatCurrency(report.revenue.grossRevenue)}
                    </dd>
                  </div>
                  <div className="flex justify-between text-red-500">
                    <dt>
                      {t(
                        'admin.affiliates.less_discounts',
                        'Less: Discounts ({n}%)'
                      ).replace('{n}', String(report.revenue.discountPercent))}
                    </dt>
                    <dd className="font-medium">
                      -{formatCurrency(report.revenue.discounts)}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-4">
                    <dt className="font-semibold text-foreground">
                      {t('admin.affiliates.net_revenue', 'Net Revenue')}
                    </dt>
                    <dd className="text-lg font-bold text-foreground">
                      {formatCurrency(report.revenue.netRevenue)}
                    </dd>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <dt>
                      {t('admin.affiliates.average_ticket', 'Average Ticket')}
                    </dt>
                    <dd>{formatCurrency(report.revenue.averageTicket)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* Commission Breakdown */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">
                  {t(
                    'admin.affiliates.commission_breakdown',
                    'Commission Breakdown'
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-4">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      {t(
                        'admin.affiliates.paid_commissions',
                        'Paid Commissions'
                      )}
                    </dt>
                    <dd className="font-medium text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(report.costs.paidCommissions)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      {t(
                        'admin.affiliates.approved_awaiting_payment',
                        'Approved (Awaiting Payment)'
                      )}
                    </dt>
                    <dd className="font-medium text-blue-500">
                      {formatCurrency(report.costs.approvedCommissions)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      {t(
                        'admin.affiliates.pending_approval',
                        'Pending Approval'
                      )}
                    </dt>
                    <dd className="font-medium text-yellow-500">
                      {formatCurrency(report.costs.pendingCommissions)}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-4">
                    <dt className="font-semibold text-foreground">
                      {t(
                        'admin.affiliates.total_commissions',
                        'Total Commissions'
                      )}
                    </dt>
                    <dd className="text-lg font-bold text-foreground">
                      {formatCurrency(report.costs.totalCommissions)}
                    </dd>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <dt>
                      {t(
                        'admin.affiliates.average_commission',
                        'Average Commission'
                      )}
                    </dt>
                    <dd>{formatCurrency(report.costs.averageCommission)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>

          {/* Profit Summary */}
          <Card className="border-2 border-emerald-500/30 bg-emerald-500/5">
            <CardHeader>
              <CardTitle className="text-emerald-700 dark:text-emerald-300">
                {t('admin.affiliates.profit_summary', 'Profit Summary')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    {t('admin.affiliates.net_revenue', 'Net Revenue')}
                  </p>
                  <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">
                    {formatCurrency(report.revenue.netRevenue)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    {t(
                      'admin.affiliates.less_commissions',
                      'Less: Commissions'
                    )}
                  </p>
                  <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">
                    -{formatCurrency(report.costs.totalCommissions)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    {t(
                      'admin.affiliates.net_profit_margin',
                      'Net Profit ({n}% margin)'
                    ).replace('{n}', String(report.profit.margin))}
                  </p>
                  <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">
                    {formatCurrency(report.profit.netProfit)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
