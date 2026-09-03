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

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocale } from '@/lib/context/locale-context';

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
  const { t } = useLocale();
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
        throw new Error(
          t(
            'admin.affiliates.error_fetch_sales_performance',
            'Failed to fetch sales performance report'
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

  const getRankBadgeClass = (index: number): string => {
    if (index === 0) return 'bg-yellow-500/10 text-yellow-500';
    if (index === 1) return 'bg-muted text-muted-foreground';
    if (index === 2) return 'bg-orange-500/10 text-orange-500';
    return 'bg-muted/50 text-muted-foreground';
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
          {t(
            'admin.affiliates.sales_performance_title',
            'Sales Performance Report'
          )}
        </h1>
        <p className="text-muted-foreground">
          {t(
            'admin.affiliates.sales_performance_subtitle',
            'Top performing affiliates by conversions'
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
                  {t('admin.affiliates.active_affiliates', 'Active Affiliates')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">
                  {report.summary.totalAffiliates}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('admin.affiliates.total_conversions', 'Total Conversions')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {report.summary.totalConversions}
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
                <p className="text-3xl font-bold text-blue-500">
                  {formatCurrency(report.summary.totalCommissionsEarned)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('admin.affiliates.avg_per_affiliate', 'Avg per Affiliate')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">
                  {report.summary.averageConversionsPerAffiliate}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('admin.affiliates.conversions', 'conversions')}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Top Performers Table */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-foreground">
                {t('admin.affiliates.top_performers', 'Top Performers')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        {t('admin.affiliates.rank', 'Rank')}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        {t('admin.affiliates.affiliate', 'Affiliate')}
                      </th>
                      <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">
                        {t('admin.affiliates.country', 'Country')}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        {t('admin.affiliates.total_conversions', 'Conversions')}
                      </th>
                      <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">
                        {t(
                          'admin.affiliates.codes_used_distributed',
                          'Codes Used / Distributed'
                        )}
                      </th>
                      <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">
                        {t(
                          'admin.affiliates.conversion_rate_col',
                          'Conversion Rate'
                        )}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        {t('admin.affiliates.commissions', 'Commissions')}
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        {t('admin.users.actions', 'Actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topPerformers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-12 text-center text-muted-foreground"
                        >
                          {t(
                            'admin.affiliates.no_conversions_this_period',
                            'No affiliates with conversions in this period'
                          )}
                        </td>
                      </tr>
                    ) : (
                      report.topPerformers.map((performer, index) => (
                        <tr
                          key={performer.id}
                          className="border-border/50 hover:bg-accent/30 border-b transition-colors"
                        >
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-full font-medium ${getRankBadgeClass(index)}`}
                            >
                              {index + 1}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">
                              {performer.fullName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {performer.email}
                            </div>
                          </td>
                          <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                            {performer.country}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                              {performer.metrics.conversionsPeriod}
                            </span>
                          </td>
                          <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                            {performer.metrics.codesUsed} /{' '}
                            {performer.metrics.codesDistributed}
                          </td>
                          <td className="hidden px-4 py-3 lg:table-cell">
                            <div className="flex items-center">
                              <div className="mr-2 h-2 w-16 rounded-full bg-muted">
                                <div
                                  className="h-2 rounded-full bg-emerald-500"
                                  style={{
                                    width: `${Math.min(performer.metrics.conversionRate, 100)}%`,
                                  }}
                                ></div>
                              </div>
                              <span className="text-sm text-muted-foreground">
                                {performer.metrics.conversionRate}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            {formatCurrency(performer.metrics.totalCommissions)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/admin/affiliates/${performer.id}`}
                              className="text-sm text-primary hover:underline"
                            >
                              {t('admin.affiliates.view', 'View')}
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
