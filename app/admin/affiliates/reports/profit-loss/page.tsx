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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/admin/affiliates"
          className="text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          &larr; Back to Affiliates
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-foreground sm:text-3xl">
          Profit & Loss Report
        </h1>
        <p className="text-muted-foreground">
          Affiliate program financial overview
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
              ? '3 Months'
              : p === '6months'
                ? '6 Months'
                : '1 Year'}
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
            Report period: {formatDate(report.period.start)} -{' '}
            {formatDate(report.period.end)}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Gross Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">
                  {formatCurrency(report.revenue.grossRevenue)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {report.volume.totalSales} sales
                </p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Net Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-500">
                  {formatCurrency(report.revenue.netRevenue)}
                </p>
                <p className="text-sm text-muted-foreground">
                  After {report.revenue.discountPercent}% discounts
                </p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Commissions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                  {formatCurrency(report.costs.totalCommissions)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {report.costs.commissionPercent}% commission rate
                </p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Net Profit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(report.profit.netProfit)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {report.profit.margin}% margin
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
                  Revenue Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-4">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      Gross Revenue ({report.volume.totalSales} x $
                      {report.volume.regularPrice})
                    </dt>
                    <dd className="font-medium text-foreground">
                      {formatCurrency(report.revenue.grossRevenue)}
                    </dd>
                  </div>
                  <div className="flex justify-between text-red-500">
                    <dt>Less: Discounts ({report.revenue.discountPercent}%)</dt>
                    <dd className="font-medium">
                      -{formatCurrency(report.revenue.discounts)}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-4">
                    <dt className="font-semibold text-foreground">
                      Net Revenue
                    </dt>
                    <dd className="text-lg font-bold text-foreground">
                      {formatCurrency(report.revenue.netRevenue)}
                    </dd>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <dt>Average Ticket</dt>
                    <dd>{formatCurrency(report.revenue.averageTicket)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* Commission Breakdown */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">
                  Commission Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-4">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Paid Commissions</dt>
                    <dd className="font-medium text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(report.costs.paidCommissions)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      Approved (Awaiting Payment)
                    </dt>
                    <dd className="font-medium text-blue-500">
                      {formatCurrency(report.costs.approvedCommissions)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Pending Approval</dt>
                    <dd className="font-medium text-yellow-500">
                      {formatCurrency(report.costs.pendingCommissions)}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-4">
                    <dt className="font-semibold text-foreground">
                      Total Commissions
                    </dt>
                    <dd className="text-lg font-bold text-foreground">
                      {formatCurrency(report.costs.totalCommissions)}
                    </dd>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <dt>Average Commission</dt>
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
                Profit Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    Net Revenue
                  </p>
                  <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">
                    {formatCurrency(report.revenue.netRevenue)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    Less: Commissions
                  </p>
                  <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">
                    -{formatCurrency(report.costs.totalCommissions)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    Net Profit ({report.profit.margin}% margin)
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
