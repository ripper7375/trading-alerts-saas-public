'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Layers,
  Send,
  CheckCircle2,
  Clock,
  Eye,
  Plus,
  Landmark,
  Download,
  AlertTriangle,
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

export default function AdminDisbursementBatchesPage() {
  const { t } = useLocale();

  const batches = [
    {
      id: 'BATCH-2026-08',
      date: '2026-08-31',
      partnerCount: 2,
      totalAmount: 1029.0,
      method: 'Wise Business',
      status: 'QUEUED',
    },
    {
      id: 'BATCH-2026-07',
      date: '2026-07-31',
      partnerCount: 3,
      totalAmount: 960.4,
      method: 'Wise Business',
      status: 'SETTLED',
    },
    {
      id: 'BATCH-2026-06',
      date: '2026-06-30',
      partnerCount: 2,
      totalAmount: 519.4,
      method: 'Wise Business',
      status: 'SETTLED',
    },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t('Admin Disbursement: Payout Batches')}
        subtitle={t(
          'Automated & Manual Monthly Payout Batches, Multi-Recipient Processing & Settlement History'
        )}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Badge className="border-amber-500/40 bg-amber-500/20 text-xs text-amber-400">
              {t('1 Batch Pending Execution')}
            </Badge>
          </div>

          <Button
            onClick={() => alert('Create new disbursement batch')}
            className="self-start bg-amber-500 font-bold text-slate-950 hover:bg-amber-400 sm:self-auto"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {t('Generate New Payout Batch')}
          </Button>
        </div>

        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Batch ID')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Scheduled Execution')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Recipient Count')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Total Disbursement')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Gateway Method')}
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
              {batches.map((b) => (
                <TableRow
                  key={b.id}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell className="font-mono text-xs font-bold text-slate-200">
                    {b.id}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">
                    {b.date}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">
                    {b.partnerCount} Partners
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-400">
                    ${b.totalAmount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-xs text-slate-300">
                    {b.method}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`text-[10px] ${
                        b.status === 'SETTLED'
                          ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-400'
                          : 'border-amber-500/40 bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {b.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/disbursement/batches/${b.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-amber-400 hover:bg-amber-500/10"
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        <span>{t('View Batch')}</span>
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
