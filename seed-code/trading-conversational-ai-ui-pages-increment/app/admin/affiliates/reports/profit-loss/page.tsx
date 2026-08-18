'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Calendar } from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AdminNav } from '@/components/admin/admin-nav';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLocale } from '@/lib/context/locale-context';

type Period = '3months' | '6months' | '1year';

const PERIOD_LABELS: Record<Period, string> = {
  '3months': '3 Months',
  '6months': '6 Months',
  '1year': '1 Year',
};

const SUMMARY_BY_PERIOD: Record<
  Period,
  {
    grossRevenue: number;
    affiliateExpense: number;
    netOperatingProfit: number;
    averageNetMargin: number;
    // Revenue Breakdown (matches Codebase 1's Revenue Breakdown card)
    discountPercent: number;
    discounts: number;
    netRevenue: number;
    totalSales: number;
    // Commission Breakdown (matches Codebase 1's Commission Breakdown card)
    paidCommissions: number;
    approvedCommissions: number;
    pendingCommissions: number;
  }
> = {
  '3months': {
    grossRevenue: 64850.0,
    affiliateExpense: 10610.0,
    netOperatingProfit: 51399.35,
    averageNetMargin: 79.2,
    discountPercent: 5,
    discounts: 3242.5,
    netRevenue: 61607.5,
    totalSales: 2236,
    paidCommissions: 7427.0,
    approvedCommissions: 2122.0,
    pendingCommissions: 1061.0,
  },
  '6months': {
    grossRevenue: 128900.0,
    affiliateExpense: 21240.0,
    netOperatingProfit: 101780.5,
    averageNetMargin: 79.0,
    discountPercent: 5,
    discounts: 6445.0,
    netRevenue: 122455.0,
    totalSales: 4445,
    paidCommissions: 14868.0,
    approvedCommissions: 4248.0,
    pendingCommissions: 2124.0,
  },
  '1year': {
    grossRevenue: 253600.0,
    affiliateExpense: 41850.0,
    netOperatingProfit: 198760.75,
    averageNetMargin: 78.4,
    discountPercent: 5,
    discounts: 12680.0,
    netRevenue: 240920.0,
    totalSales: 8745,
    paidCommissions: 29295.0,
    approvedCommissions: 8370.0,
    pendingCommissions: 4185.0,
  },
};

export default function AdminReportProfitLossPage() {
  const { t, formatCurrency, language } = useLocale();
  const [period, setPeriod] = useState<Period>('3months');
  const summary = SUMMARY_BY_PERIOD[period];

  const pnlMonthly = [
    {
      month: 'August 2026 (MTD)',
      gross: 18420.0,
      gatewayFees: 534.18,
      affiliateCommissions: 2840.0,
      serverCosts: 320.0,
      netProfit: 14725.82,
      margin: '79.9%',
    },
    {
      month: 'July 2026',
      gross: 24890.0,
      gatewayFees: 721.81,
      affiliateCommissions: 4120.0,
      serverCosts: 320.0,
      netProfit: 19728.19,
      margin: '79.3%',
    },
    {
      month: 'June 2026',
      gross: 21540.0,
      gatewayFees: 624.66,
      affiliateCommissions: 3650.0,
      serverCosts: 320.0,
      netProfit: 16945.34,
      margin: '78.7%',
    },
    {
      month: 'May 2026',
      gross: 17200.0,
      gatewayFees: 498.8,
      affiliateCommissions: 2890.0,
      serverCosts: 320.0,
      netProfit: 13491.2,
      margin: '78.4%',
    },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t('Admin Report: SaaS Profit & Loss Breakdown')}
        subtitle={t(
          'Gross Revenue, Gateway Costs, Affiliate Commission Expense & Net SaaS Margin'
        )}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <Link
            href="/admin/affiliates"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-400"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t('Back to Affiliates Directory')}</span>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={() => alert(t('Downloading PnL CSV Report...'))}
            className="border-slate-800 bg-[#090b14] text-xs text-slate-300 hover:bg-slate-800"
          >
            <Download className="mr-1.5 h-3.5 w-3.5 text-amber-400" />
            {t('Export CSV Report')}
          </Button>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-800">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-1.5 text-xs font-medium ${
                  period === p
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-[#090b14] text-slate-300 hover:bg-slate-800'
                }`}
              >
                {t(PERIOD_LABELS[p])}
              </button>
            ))}
          </div>
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card className="border-slate-800/80 bg-[#090b14]/90 p-4">
            <div className="text-xs font-medium text-slate-400">
              {t(`Gross Revenue (${PERIOD_LABELS[period]})`)}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-emerald-400">
              {formatCurrency(summary.grossRevenue)}
            </div>
          </Card>
          <Card className="border-slate-800/80 bg-[#090b14]/90 p-4">
            <div className="text-xs font-medium text-slate-400">
              {t('Affiliate Expense')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-amber-400">
              {formatCurrency(summary.affiliateExpense)}
            </div>
          </Card>
          <Card className="border-slate-800/80 bg-[#090b14]/90 p-4">
            <div className="text-xs font-medium text-slate-400">
              {t('Net Operating Profit')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-cyan-400">
              {formatCurrency(summary.netOperatingProfit)}
            </div>
          </Card>
          <Card className="border-slate-800/80 bg-[#090b14]/90 p-4">
            <div className="text-xs font-medium text-slate-400">
              {t('Average Net Margin')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-purple-400">
              {summary.averageNetMargin.toFixed(1)}%
            </div>
          </Card>
        </div>

        {/* Revenue Breakdown & Commission Breakdown (matches Codebase 1's Detailed Breakdown section) */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="border-slate-800/80 bg-[#090b14]/90 p-6">
            <h2 className="mb-4 text-sm font-bold text-slate-200">
              {t('Revenue Breakdown')}
            </h2>
            <dl className="space-y-3 text-xs">
              <div className="flex justify-between">
                <dt className="text-slate-400">
                  {t('Gross Revenue')} (
                  {summary.totalSales.toLocaleString(language)} {t('sales')}{' '}
                  &times;{' '}
                  {formatCurrency(summary.grossRevenue / summary.totalSales)})
                </dt>
                <dd className="font-mono font-semibold text-slate-200">
                  {formatCurrency(summary.grossRevenue)}
                </dd>
              </div>
              <div className="flex justify-between text-red-400">
                <dt>
                  {t('Less: Discounts')} ({summary.discountPercent}%)
                </dt>
                <dd className="font-mono font-semibold">
                  -{formatCurrency(summary.discounts)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-3">
                <dt className="font-bold text-slate-200">{t('Net Revenue')}</dt>
                <dd className="font-mono text-sm font-bold text-emerald-400">
                  {formatCurrency(summary.netRevenue)}
                </dd>
              </div>
              <div className="flex justify-between text-slate-500">
                <dt>{t('Average Ticket')}</dt>
                <dd className="font-mono">
                  {formatCurrency(summary.grossRevenue / summary.totalSales)}
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="border-slate-800/80 bg-[#090b14]/90 p-6">
            <h2 className="mb-4 text-sm font-bold text-slate-200">
              {t('Commission Breakdown')}
            </h2>
            <dl className="space-y-3 text-xs">
              <div className="flex justify-between">
                <dt className="text-slate-400">{t('Paid Commissions')}</dt>
                <dd className="font-mono font-semibold text-emerald-400">
                  {formatCurrency(summary.paidCommissions)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">
                  {t('Approved (Awaiting Payment)')}
                </dt>
                <dd className="font-mono font-semibold text-cyan-400">
                  {formatCurrency(summary.approvedCommissions)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">{t('Pending Approval')}</dt>
                <dd className="font-mono font-semibold text-amber-400">
                  {formatCurrency(summary.pendingCommissions)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-3">
                <dt className="font-bold text-slate-200">
                  {t('Total Commissions')}
                </dt>
                <dd className="font-mono text-sm font-bold text-slate-100">
                  {formatCurrency(summary.affiliateExpense)}
                </dd>
              </div>
              <div className="flex justify-between text-slate-500">
                <dt>{t('Average Commission')}</dt>
                <dd className="font-mono">
                  {formatCurrency(
                    summary.affiliateExpense / summary.totalSales
                  )}
                </dd>
              </div>
            </dl>
          </Card>
        </div>

        {/* Table */}
        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Month Period')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Gross Revenue')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Payment Gateway Fees (2.9%)')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Affiliate Commissions (30%)')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Infrastructure Cost')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Net Profit')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Net Margin')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pnlMonthly.map((p, idx) => (
                <TableRow
                  key={idx}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell className="text-xs font-bold text-slate-200">
                    {t(p.month)}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-400">
                    {formatCurrency(p.gross)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">
                    {formatCurrency(p.gatewayFees)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-amber-400">
                    {formatCurrency(p.affiliateCommissions)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">
                    {formatCurrency(p.serverCosts)}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-cyan-300">
                    {formatCurrency(p.netProfit)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge className="border-purple-500/40 bg-purple-500/20 font-mono text-[10px] text-purple-300">
                      {p.margin}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </main>
    </div>
  );
}
