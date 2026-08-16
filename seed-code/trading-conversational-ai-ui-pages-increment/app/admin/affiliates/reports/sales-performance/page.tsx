'use client';

import React from 'react';
import Link from 'next/link';
import {
  Trophy,
  ArrowLeft,
  Users,
  TrendingUp,
  Download,
  Percent,
  Sparkles,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AdminNav } from '@/components/admin/admin-nav';
import { Button } from '@/components/ui/button';
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

export default function AdminReportSalesPerformancePage() {
  const { t } = useLocale();

  const leaderboard = [
    {
      rank: 1,
      partner: 'Alex Morgan',
      channel: 'YouTube / Telegram Community',
      signups: 168,
      proConversions: 42,
      conversionRate: '25.0%',
      grossSales: 8232.0,
      commissionPaid: 2469.6,
    },
    {
      rank: 2,
      partner: 'Marcus Vance',
      channel: 'Quantitative Trading Newsletter',
      signups: 94,
      proConversions: 28,
      conversionRate: '29.7%',
      grossSales: 4116.0,
      commissionPaid: 1234.8,
    },
    {
      rank: 3,
      partner: 'Elena Rostova',
      channel: 'VK / Trading Academy',
      signups: 22,
      proConversions: 8,
      conversionRate: '36.3%',
      grossSales: 1176.0,
      commissionPaid: 352.8,
    },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
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
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-400"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t('Back to Affiliates Directory')}</span>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={() => alert('Downloading Leaderboard CSV...')}
            className="border-slate-800 bg-[#090b14] text-xs text-slate-300 hover:bg-slate-800"
          >
            <Download className="mr-1.5 h-3.5 w-3.5 text-amber-400" />
            {t('Export Leaderboard CSV')}
          </Button>
        </div>

        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Rank')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Partner Name')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Attributed Channel')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Total Signups')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('PRO Upgrades')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Conversion %')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Gross Revenue')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Commissions Paid')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboard.map((item) => (
                <TableRow
                  key={item.rank}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell className="text-xs font-bold">
                    {item.rank === 1 ? (
                      <span className="flex items-center gap-1 text-amber-400">
                        <Trophy className="h-4 w-4" /> #1
                      </span>
                    ) : (
                      <span className="text-slate-400">#{item.rank}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-slate-200">
                    {item.partner}
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">
                    {item.channel}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">
                    {item.signups}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-400">
                    {item.proConversions}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-cyan-400">
                    {item.conversionRate}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-slate-200">
                    ${item.grossSales.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold text-emerald-400">
                    ${item.commissionPaid.toFixed(2)}
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
