'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Percent,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  Search,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AffiliateNav } from '@/components/affiliate/affiliate-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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

interface CommissionRecord {
  id: string;
  date: string;
  userMask: string;
  plan: string;
  amount: number;
  rate: number;
  earned: number;
  status: 'PAID' | 'PENDING' | 'HOLD';
}

type StatusFilter = 'ALL' | CommissionRecord['status'];

export default function AffiliateCommissionsPage() {
  const { t, formatCurrency, formatDate } = useLocale();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const records: CommissionRecord[] = [
    {
      id: 'tx-881',
      date: '2026-08-15',
      userMask: 'usr_***892',
      plan: 'PRO Monthly ($49)',
      amount: 49.0,
      rate: 30,
      earned: 14.7,
      status: 'PENDING',
    },
    {
      id: 'tx-880',
      date: '2026-08-14',
      userMask: 'usr_***412',
      plan: 'PRO Monthly ($49)',
      amount: 49.0,
      rate: 30,
      earned: 14.7,
      status: 'PENDING',
    },
    {
      id: 'tx-879',
      date: '2026-08-12',
      userMask: 'usr_***190',
      plan: 'PRO Annual ($490)',
      amount: 490.0,
      rate: 30,
      earned: 147.0,
      status: 'PENDING',
    },
    {
      id: 'tx-862',
      date: '2026-07-31',
      userMask: 'usr_***904',
      plan: 'PRO Monthly ($49)',
      amount: 49.0,
      rate: 30,
      earned: 14.7,
      status: 'PAID',
    },
    {
      id: 'tx-861',
      date: '2026-07-28',
      userMask: 'usr_***331',
      plan: 'PRO Monthly ($49)',
      amount: 49.0,
      rate: 30,
      earned: 14.7,
      status: 'PAID',
    },
    {
      id: 'tx-860',
      date: '2026-07-25',
      userMask: 'usr_***774',
      plan: 'PRO Monthly ($49)',
      amount: 49.0,
      rate: 30,
      earned: 14.7,
      status: 'PAID',
    },
  ];

  const totalEarned = records.reduce((sum, r) => sum + r.earned, 0);
  const pendingEarned = records
    .filter((r) => r.status === 'PENDING')
    .reduce((sum, r) => sum + r.earned, 0);

  const filtered = records
    .filter((r) => statusFilter === 'ALL' || r.status === statusFilter)
    .filter((r) => {
      const q = search.toLowerCase();
      return (
        q === '' ||
        r.id.toLowerCase().includes(q) ||
        r.userMask.toLowerCase().includes(q) ||
        r.plan.toLowerCase().includes(q)
      );
    });

  const exportCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['Transaction ID,Date,User,Plan,Gross,Rate,Commission,Status'].join(',') +
      '\n' +
      records
        .map(
          (e) =>
            `${e.id},${e.date},${e.userMask},${e.plan},${e.amount},${e.rate}%,${e.earned},${e.status}`
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'davintrade_commissions.csv');
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#06070a] text-slate-100 select-none">
      <AppHeader
        title={t('Affiliate Commissions Ledger')}
        subtitle={t(
          'Detailed Revenue Share Breakdown, Conversion Timelines & Settlement Status'
        )}
      />

      <AffiliateNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="border-slate-800/80 bg-[#090b14]/90 p-5">
            <div className="text-xs font-medium text-slate-400">
              {t('Total Commissions Generated')}
            </div>
            <div className="mt-1 font-mono text-3xl font-extrabold text-emerald-400">
              {formatCurrency(totalEarned)}
            </div>
          </Card>

          <Card className="border-slate-800/80 bg-[#090b14]/90 p-5">
            <div className="text-xs font-medium text-slate-400">
              {t('Pending August Disbursement')}
            </div>
            <div className="mt-1 font-mono text-3xl font-extrabold text-amber-400">
              {formatCurrency(pendingEarned)}
            </div>
          </Card>

          <Card className="border-slate-800/80 bg-[#090b14]/90 p-5">
            <div className="text-xs font-medium text-slate-400">
              {t('Active Commission Rate')}
            </div>
            <div className="mt-1 font-mono text-3xl font-extrabold text-cyan-400">
              30.0%
            </div>
          </Card>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-xs">
              <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t('Search transaction or user...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 border-slate-800 bg-[#090b14] pl-9 text-xs text-slate-200"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-9 rounded-md border border-slate-800 bg-[#090b14] px-3 text-xs text-slate-200"
            >
              <option value="ALL">{t('All Status')}</option>
              <option value="PENDING">{t('Pending')}</option>
              <option value="PAID">{t('Paid')}</option>
              <option value="HOLD">{t('Hold')}</option>
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            className="self-start border-slate-800 bg-[#090b14] text-xs text-slate-300 hover:bg-slate-800 sm:self-auto"
          >
            <Download className="mr-1.5 h-3.5 w-3.5 text-amber-400" />
            {t('Export CSV Report')}
          </Button>
        </div>

        {/* Ledger Table */}
        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Tx ID')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Date')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Referred Trader')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Purchased Plan')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Gross Payment')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Rate')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Commission Earned')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Status')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow className="border-slate-800/60 hover:bg-transparent">
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-xs text-slate-500"
                  >
                    {t('No commissions match this search or filter.')}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => (
                <TableRow
                  key={r.id}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell className="font-mono text-xs text-slate-400">
                    {r.id}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">
                    {formatDate(r.date)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">
                    {r.userMask}
                  </TableCell>
                  <TableCell className="text-xs text-slate-200">
                    {t(r.plan)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">
                    {formatCurrency(r.amount)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-amber-400">
                    {r.rate}%
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-400">
                    {formatCurrency(r.earned)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      className={`text-[10px] ${
                        r.status === 'PAID'
                          ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-400'
                          : 'border-amber-500/40 bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {t(r.status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Commission Status Guide */}
        <Card className="border-slate-800/80 bg-[#090b14]/90 p-6">
          <h3 className="mb-3 text-sm font-bold text-slate-100">
            {t('Commission Status Guide')}
          </h3>
          <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <Badge className="border-amber-500/40 bg-amber-500/20 text-[10px] text-amber-400">
                {t('PENDING')}
              </Badge>
              <span className="text-slate-400">
                {t('Awaiting the next payout cycle')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="border-emerald-500/40 bg-emerald-500/20 text-[10px] text-emerald-400">
                {t('PAID')}
              </Badge>
              <span className="text-slate-400">{t('Settled via payout')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="border-slate-700 bg-slate-800 text-[10px] text-slate-400">
                {t('HOLD')}
              </Badge>
              <span className="text-slate-400">
                {t('Under fraud/compliance review')}
              </span>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
