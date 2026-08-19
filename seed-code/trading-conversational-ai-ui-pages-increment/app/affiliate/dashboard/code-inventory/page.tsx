'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Layers,
  Sparkles,
  Percent,
  CheckCircle2,
  Clock,
  Ban,
  ArrowRight,
  Search,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AffiliateNav } from '@/components/affiliate/affiliate-nav';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLocale } from '@/lib/context/locale-context';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function AffiliateCodeInventoryPage() {
  const { t, formatDate } = useLocale();
  const [search, setSearch] = useState('');

  const today = new Date();
  const sixMonthsOut = new Date(today.getTime() + 180 * 24 * 60 * 60 * 1000);
  const [startDate, setStartDate] = useState(isoDate(today));
  const [endDate, setEndDate] = useState(isoDate(sixMonthsOut));

  const stats = [
    {
      label: t('Total Allocated Codes'),
      value: '15',
      color: 'text-amber-700 dark:text-amber-400',
    },
    {
      label: t('Active & Redeemable'),
      value: '12',
      color: 'text-emerald-700 dark:text-emerald-400',
    },
    {
      label: t('Redemption Rate'),
      value: '64.8%',
      color: 'text-cyan-700 dark:text-cyan-400',
    },
    {
      label: t('Expired / Inactive'),
      value: '3',
      color: 'text-slate-500',
    },
  ];

  const inventory = [
    {
      code: 'GOLDPRO20',
      discount: '20%',
      pool: 'Tier 1 Creator Pool',
      allocated: 100,
      claimed: 42,
      remaining: 58,
      expiry: '2026-12-31',
    },
    {
      code: 'DAVINVIP10',
      discount: '10%',
      pool: 'Standard Partner Pool',
      allocated: 250,
      claimed: 28,
      remaining: 222,
      expiry: '2027-01-01',
    },
    {
      code: 'SUMMERTRADER',
      discount: '15%',
      pool: 'Seasonal Campaign Pool',
      allocated: 50,
      claimed: 50,
      remaining: 0,
      expiry: '2026-07-31',
    },
  ];

  const visibleInventory = inventory
    .filter((item) => item.code.toLowerCase().includes(search.toLowerCase()))
    .filter((item) => item.expiry >= startDate && item.expiry <= endDate);

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-slate-50 text-slate-900 select-none dark:bg-[#06070a] dark:text-slate-100">
      <AppHeader
        title={t('Affiliate Code Inventory')}
        subtitle={t(
          'Batch Allocations, Tier Quotas & Code Redemption Capacity'
        )}
      />

      <AffiliateNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        {/* Filters */}
        <Card className="border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-[#090b14]/90">
          <div className="flex flex-wrap items-end gap-4">
            <div className="relative max-w-xs flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('Search Code')}
              </label>
              <Search className="absolute top-[34px] left-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t('Search promo code...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 border-slate-200 bg-slate-50 pl-9 text-xs text-slate-900 dark:border-slate-800 dark:bg-[#06080e] dark:text-slate-200"
              />
            </div>
            <div>
              <label
                htmlFor="startDate"
                className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                {t('Start Date')}
              </label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 dark:border-slate-800 dark:bg-[#06080e] dark:text-slate-200"
              />
            </div>
            <div>
              <label
                htmlFor="endDate"
                className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                {t('End Date')}
              </label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 dark:border-slate-800 dark:bg-[#06080e] dark:text-slate-200"
              />
            </div>
          </div>
        </Card>

        {/* KPI Stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((st, idx) => (
            <Card
              key={idx}
              className="border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-[#090b14]/90"
            >
              <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {st.label}
              </div>
              <div
                className={`mt-1 font-mono text-2xl font-extrabold ${st.color}`}
              >
                {st.value}
              </div>
            </Card>
          ))}
        </div>

        {/* Inventory Table */}
        <Card className="overflow-hidden border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#090b14]/90 dark:backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-[#06080e]">
              <TableRow className="border-slate-200 hover:bg-transparent dark:border-slate-800">
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Promo Code')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Discount')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Allocation Pool')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Allocated')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Claimed')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Remaining')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Expiration')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleInventory.length === 0 && (
                <TableRow className="border-slate-200 hover:bg-transparent dark:border-slate-800/60">
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-xs text-slate-500"
                  >
                    {t('No codes match this search or date range.')}
                  </TableCell>
                </TableRow>
              )}
              {visibleInventory.map((item, idx) => (
                <TableRow
                  key={idx}
                  className="border-slate-200 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/30"
                >
                  <TableCell className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
                    {item.code}
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge
                      variant="outline"
                      className="border-amber-500/40 bg-amber-500/15 text-[10px] text-amber-700 dark:text-amber-400"
                    >
                      {item.discount}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-900 dark:text-slate-300">
                    {t(item.pool)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-700 dark:text-slate-300">
                    {item.allocated}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {item.claimed}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                    {item.remaining}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">
                    {formatDate(item.expiry)}
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
