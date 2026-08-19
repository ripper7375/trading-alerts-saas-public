'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Trophy,
  ArrowLeft,
  Users,
  TrendingUp,
  Download,
  Eye,
} from 'lucide-react';
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

const LEADERBOARD = [
  {
    id: 'aff-101',
    rank: 1,
    partner: 'Alex Morgan',
    country: 'US',
    channel: 'YouTube / Telegram Community',
    signups: 168,
    proConversions: 42,
    conversionRate: '25.0%',
    grossSales: 8232.0,
    commissionPaid: 2469.6,
  },
  {
    id: 'aff-102',
    rank: 2,
    partner: 'Marcus Vance',
    country: 'DE',
    channel: 'Quantitative Trading Newsletter',
    signups: 94,
    proConversions: 28,
    conversionRate: '29.7%',
    grossSales: 4116.0,
    commissionPaid: 1234.8,
  },
  {
    id: 'aff-103',
    rank: 3,
    partner: 'Elena Rostova',
    country: 'RU',
    channel: 'VK / Trading Academy',
    signups: 22,
    proConversions: 8,
    conversionRate: '36.3%',
    grossSales: 1176.0,
    commissionPaid: 352.8,
  },
];

export default function AdminReportSalesPerformancePage() {
  const { t, formatCurrency } = useLocale();
  const [period, setPeriod] = useState<Period>('3months');
  const leaderboard = LEADERBOARD;

  const activeAffiliates = leaderboard.length;
  const totalConversions = leaderboard.reduce(
    (sum, p) => sum + p.proConversions,
    0
  );
  const totalCommissions = leaderboard.reduce(
    (sum, p) => sum + p.commissionPaid,
    0
  );
  const avgPerAffiliate =
    activeAffiliates > 0
      ? (totalConversions / activeAffiliates).toFixed(1)
      : '0.0';

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-slate-50 text-slate-900 select-none dark:bg-[#050609] dark:text-slate-100">
      <AppHeader
        title={t('Admin Report: Affiliate Sales Performance Leaderboard')}
        subtitle={t(
          'Top Performing Affiliates, Conversion Velocity & Channel Attribution Metrics'
        )}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <Link
            href="/admin/affiliates"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t('Back to Affiliates Directory')}</span>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={() => alert(t('Downloading Leaderboard CSV...'))}
            className="border-slate-300 bg-slate-50 text-xs text-slate-800 hover:bg-slate-100 dark:border-slate-800 dark:bg-[#090b14] dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Download className="mr-1.5 h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            {t('Export Leaderboard CSV')}
          </Button>
        </div>

        {/* Period Selector */}
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 text-xs font-medium ${
                period === p
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-[#090b14] dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {t(PERIOD_LABELS[p])}
            </button>
          ))}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card className="border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-[#090b14]/90">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
              <Users className="h-3.5 w-3.5" />
              {t('Active Affiliates')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-slate-900 dark:text-slate-200">
              {activeAffiliates}
            </div>
          </Card>
          <Card className="border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-[#090b14]/90">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
              <TrendingUp className="h-3.5 w-3.5" />
              {t('Total Conversions')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">
              {totalConversions}
            </div>
          </Card>
          <Card className="border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-[#090b14]/90">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('Total Commissions')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-cyan-700 dark:text-cyan-400">
              {formatCurrency(totalCommissions)}
            </div>
          </Card>
          <Card className="border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-[#090b14]/90">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('Avg per Affiliate')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-purple-700 dark:text-purple-400">
              {avgPerAffiliate}
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#090b14]/90 dark:backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-[#06080e]">
              <TableRow className="border-slate-200 hover:bg-transparent dark:border-slate-800">
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Rank')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Partner Name')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Country')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Attributed Channel')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Total Signups')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('PRO Upgrades')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Conversion %')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Gross Revenue')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Commissions Paid')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Action')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboard.map((item) => (
                <TableRow
                  key={item.rank}
                  className="border-slate-200 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/30"
                >
                  <TableCell className="text-xs font-bold">
                    {item.rank === 1 ? (
                      <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                        <Trophy className="h-4 w-4" /> #1
                      </span>
                    ) : (
                      <span className="text-slate-600 dark:text-slate-400">
                        #{item.rank}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-slate-900 dark:text-slate-200">
                    {item.partner}
                  </TableCell>
                  <TableCell className="text-xs text-slate-700 dark:text-slate-300">
                    {item.country}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                    {t(item.channel)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-700 dark:text-slate-300">
                    {item.signups}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {item.proConversions}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-cyan-700 dark:text-cyan-400">
                    {item.conversionRate}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-slate-900 dark:text-slate-200">
                    {formatCurrency(item.grossSales)}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(item.commissionPaid)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/affiliates/${item.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        {t('View')}
                      </Button>
                    </Link>
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
