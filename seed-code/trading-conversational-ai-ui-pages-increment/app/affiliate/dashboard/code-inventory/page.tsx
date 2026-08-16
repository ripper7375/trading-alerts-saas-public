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

export default function AffiliateCodeInventoryPage() {
  const { t } = useLocale();
  const [search, setSearch] = useState('');

  const stats = [
    {
      label: t('Total Allocated Codes'),
      value: '15',
      color: 'text-amber-400',
    },
    {
      label: t('Active & Redeemable'),
      value: '12',
      color: 'text-emerald-400',
    },
    {
      label: t('Redemption Rate'),
      value: '64.8%',
      color: 'text-cyan-400',
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

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#06070a] text-slate-100 select-none">
      <AppHeader
        title={t('Affiliate Code Inventory')}
        subtitle={t(
          'Batch Allocations, Tier Quotas & Code Redemption Capacity'
        )}
      />

      <AffiliateNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        {/* KPI Stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((st, idx) => (
            <Card key={idx} className="border-slate-800/80 bg-[#090b14]/90 p-4">
              <div className="text-xs font-medium text-slate-400">
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
        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Promo Code')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Discount')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Allocation Pool')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Allocated')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Claimed')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Remaining')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Expiration')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventory.map((item, idx) => (
                <TableRow
                  key={idx}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell className="font-mono text-xs font-bold text-amber-400">
                    {item.code}
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge
                      variant="outline"
                      className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-400"
                    >
                      {item.discount}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-300">
                    {item.pool}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">
                    {item.allocated}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-400">
                    {item.claimed}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-slate-200">
                    {item.remaining}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">
                    {item.expiry}
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
