'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, Filter, Eye } from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AdminNav } from '@/components/admin/admin-nav';
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

interface AdminAffiliate {
  id: string;
  name: string;
  email: string;
  code: string;
  country: string;
  referrals: number;
  activeSubscribers: number;
  totalVolume: number;
  unpaidCommission: number;
  payoutMethod: string;
  status: 'ACTIVE' | 'PENDING_VERIFICATION' | 'SUSPENDED' | 'INACTIVE';
}

const STATUS_FILTERS = [
  'ALL',
  'ACTIVE',
  'PENDING_VERIFICATION',
  'SUSPENDED',
  'INACTIVE',
] as const;

export default function AdminAffiliatesDirectoryPage() {
  const { t } = useLocale();
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTERS)[number]>('ALL');

  const affiliates: AdminAffiliate[] = [
    {
      id: 'aff-101',
      name: 'Alex Morgan',
      email: 'alex.trader@gmail.com',
      code: 'GOLDPRO20',
      country: 'US',
      referrals: 168,
      activeSubscribers: 42,
      totalVolume: 8232.0,
      unpaidCommission: 617.4,
      payoutMethod: 'Wise (USD)',
      status: 'ACTIVE',
    },
    {
      id: 'aff-102',
      name: 'Marcus Vance',
      email: 'marcus.fx@capital.io',
      code: 'DAVINVIP10',
      country: 'DE',
      referrals: 94,
      activeSubscribers: 28,
      totalVolume: 4116.0,
      unpaidCommission: 411.6,
      payoutMethod: 'Wise (EUR)',
      status: 'ACTIVE',
    },
    {
      id: 'aff-103',
      name: 'Elena Rostova',
      email: 'elena@quantumforex.ru',
      code: 'SUMMERTRADER',
      country: 'RU',
      referrals: 22,
      activeSubscribers: 8,
      totalVolume: 1176.0,
      unpaidCommission: 117.6,
      payoutMethod: 'RiseWorks',
      status: 'SUSPENDED',
    },
  ];

  const filtered = affiliates.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase()) ||
      a.code.toLowerCase().includes(search.toLowerCase());
    const matchesCountry =
      !country || a.country.toLowerCase().includes(country.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
    return matchesSearch && matchesCountry && matchesStatus;
  });

  const getStatusBadgeClass = (status: AdminAffiliate['status']): string => {
    switch (status) {
      case 'ACTIVE':
        return 'border-emerald-500/40 bg-emerald-500/20 text-emerald-400';
      case 'PENDING_VERIFICATION':
        return 'border-amber-500/40 bg-amber-500/20 text-amber-400';
      case 'INACTIVE':
        return 'border-slate-500/40 bg-slate-500/20 text-slate-400';
      case 'SUSPENDED':
      default:
        return 'border-rose-500/40 bg-rose-500/20 text-rose-400';
    }
  };

  const reportsNav = [
    {
      href: '/admin/affiliates/reports/code-flows',
      label: t('Code Flows'),
    },
    {
      href: '/admin/affiliates/reports/code-inventory',
      label: t('Code Inventory'),
    },
    {
      href: '/admin/affiliates/reports/commission-owings',
      label: t('Commission Owings'),
    },
    {
      href: '/admin/affiliates/reports/profit-loss',
      label: t('P&L Breakdown'),
    },
    {
      href: '/admin/affiliates/reports/sales-performance',
      label: t('Sales Performance'),
    },
    {
      href: '/admin/resources',
      label: t('Marketing Media Kit'),
    },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t('Admin Affiliates Directory & Reports')}
        subtitle={t(
          'Master Partner Accounts, Commission Ledgers & Promotional Telemetry'
        )}
      />

      <AdminNav />

      {/* Reports Sub-Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-800 bg-[#06080e] px-4 py-2 text-xs md:px-6">
        <span className="mr-2 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
          {t('Reports')}:
        </span>
        {reportsNav.map((rep) => (
          <Link
            key={rep.href}
            href={rep.href}
            className="rounded-lg px-2.5 py-1 whitespace-nowrap text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-400"
          >
            {rep.label}
          </Link>
        ))}
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card className="border-slate-800/80 bg-[#090b14]/90 p-4">
            <div className="text-xs font-medium text-slate-400">
              {t('Total Partners')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-amber-400">
              {affiliates.length}
            </div>
          </Card>
          <Card className="border-slate-800/80 bg-[#090b14]/90 p-4">
            <div className="text-xs font-medium text-slate-400">
              {t('Referred Subscriptions')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-emerald-400">
              78
            </div>
          </Card>
          <Card className="border-slate-800/80 bg-[#090b14]/90 p-4">
            <div className="text-xs font-medium text-slate-400">
              {t('Gross Partner Volume')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-cyan-400">
              $13,524.00
            </div>
          </Card>
          <Card className="border-slate-800/80 bg-[#090b14]/90 p-4">
            <div className="text-xs font-medium text-slate-400">
              {t('Total Unpaid Owings')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-rose-400">
              $1,146.60
            </div>
          </Card>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative max-w-xs">
              <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t('Search partner, code, email...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 border-slate-800 bg-[#090b14] pl-9 text-xs text-slate-200"
              />
            </div>
            <div className="relative max-w-[10rem]">
              <Filter className="absolute top-2.5 left-3 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder={t('Country')}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="h-9 border-slate-800 bg-[#090b14] pl-9 text-xs text-slate-200"
              />
            </div>
            {(search || country || statusFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearch('');
                  setCountry('');
                  setStatusFilter('ALL');
                }}
                className="px-2 text-xs text-slate-400 hover:text-slate-200"
              >
                {t('Clear Filters')}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map((s) => (
              <Button
                key={s}
                variant="outline"
                size="sm"
                onClick={() => setStatusFilter(s)}
                className={`text-xs ${
                  statusFilter === s
                    ? 'border-amber-500 bg-amber-500/15 text-amber-400'
                    : 'border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {s.replace('_', ' ')}
              </Button>
            ))}
          </div>
        </div>

        {/* Table */}
        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Partner ID')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Name & Email')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Country')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Code')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Active Traders')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Gross Volume')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Unpaid Owings')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Payout Method')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Status')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Action')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="border-slate-800/60 hover:bg-transparent">
                  <TableCell
                    colSpan={9}
                    className="py-8 text-center text-xs text-slate-500"
                  >
                    {t('No affiliates found')}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((aff) => (
                  <TableRow
                    key={aff.id}
                    className="border-slate-800/60 hover:bg-slate-800/30"
                  >
                    <TableCell className="font-mono text-xs font-bold text-slate-400">
                      {aff.id}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-bold text-slate-200">
                        {aff.name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {aff.email}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-300">
                      {aff.country}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-amber-400">
                      {aff.code}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-emerald-400">
                      {aff.activeSubscribers}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-300">
                      ${aff.totalVolume.toFixed(2)}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-rose-400">
                      ${aff.unpaidCommission.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-300">
                      {aff.payoutMethod}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-[10px] ${getStatusBadgeClass(aff.status)}`}
                      >
                        {aff.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/affiliates/${aff.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-amber-400 hover:bg-amber-500/10"
                        >
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          <span>{t('Inspect')}</span>
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </main>
    </div>
  );
}
