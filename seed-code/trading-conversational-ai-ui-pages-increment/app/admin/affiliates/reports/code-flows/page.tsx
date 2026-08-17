'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AdminNav } from '@/components/admin/admin-nav';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

const FLOWS = [
  {
    code: 'GOLDPRO20',
    partner: 'Alex Morgan',
    generatedDate: '2026-06-01',
    firstRedeemed: '2026-06-02',
    velocity: '1.4 redemptions/day',
    totalUsed: 42,
    activeUsers: 42,
  },
  {
    code: 'DAVINVIP10',
    partner: 'Marcus Vance',
    generatedDate: '2026-07-15',
    firstRedeemed: '2026-07-16',
    velocity: '0.9 redemptions/day',
    totalUsed: 28,
    activeUsers: 28,
  },
  {
    code: 'SUMMERTRADER',
    partner: 'Elena Rostova',
    generatedDate: '2026-05-10',
    firstRedeemed: '2026-05-12',
    velocity: '0.2 redemptions/day',
    totalUsed: 8,
    activeUsers: 0,
  },
];

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function defaultReportRange(): { start: string; end: string } {
  const now = new Date();
  return {
    start: `${now.getFullYear()}-01-01`,
    end: toLocalDateString(now),
  };
}

export default function AdminReportCodeFlowsPage() {
  const { t } = useLocale();
  const defaultRange = defaultReportRange();
  const [start, setStart] = useState(defaultRange.start);
  const [end, setEnd] = useState(defaultRange.end);

  const flows = useMemo(
    () =>
      FLOWS.filter((f) => f.generatedDate >= start && f.generatedDate <= end),
    [start, end]
  );

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t('Admin Report: Promotional Code Flows')}
        subtitle={t(
          'Redemption Velocity, Conversion Lag & Attribution Flow Analytics'
        )}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <Link
            href="/admin/affiliates"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-400"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t('Back to Affiliates Directory')}</span>
          </Link>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label
                htmlFor="flows-start"
                className="mb-1 block text-[11px] font-medium text-slate-400"
              >
                {t('Start')}
              </label>
              <Input
                id="flows-start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="h-9 border-slate-800 bg-[#090b14] text-xs text-slate-200"
              />
            </div>
            <div>
              <label
                htmlFor="flows-end"
                className="mb-1 block text-[11px] font-medium text-slate-400"
              >
                {t('End')}
              </label>
              <Input
                id="flows-end"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="h-9 border-slate-800 bg-[#090b14] text-xs text-slate-200"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => alert('Exporting Code Flows CSV...')}
              className="border-slate-800 bg-[#090b14] text-xs text-slate-300 hover:bg-slate-800"
            >
              <Download className="mr-1.5 h-3.5 w-3.5 text-amber-400" />
              {t('Export CSV Report')}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#090b14]/60 px-4 py-2.5 text-xs text-slate-400">
          {t('Period')}: {start} &ndash; {end} &middot;{' '}
          <strong className="text-slate-200">{flows.length}</strong>{' '}
          {t('codes issued in this window')}
        </div>

        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Promo Code')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Assigned Partner')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Issued Date')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('First Redeemed')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Redemption Velocity')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Total Redemptions')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Active Retention')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flows.length === 0 && (
                <TableRow className="border-slate-800/60 hover:bg-transparent">
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-xs text-slate-500"
                  >
                    {t('No codes issued in this period')}
                  </TableCell>
                </TableRow>
              )}
              {flows.map((f) => (
                <TableRow
                  key={f.code}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell className="font-mono text-xs font-bold text-amber-400">
                    {f.code}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-slate-200">
                    {f.partner}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">
                    {f.generatedDate}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">
                    {f.firstRedeemed}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-cyan-400">
                    {f.velocity}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-slate-200">
                    {f.totalUsed}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge className="border-emerald-500/40 bg-emerald-500/20 text-[10px] text-emerald-400">
                      {f.activeUsers} Active
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
