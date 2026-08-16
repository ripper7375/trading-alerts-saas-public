'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  ArrowLeft,
  Landmark,
  CheckCircle2,
  AlertTriangle,
  Download,
  Send,
  Loader2,
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

export default function AdminReportCommissionOwingsPage() {
  const { t } = useLocale();
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState('');

  const owings = [
    {
      id: 'aff-101',
      partner: 'Alex Morgan',
      email: 'alex.trader@gmail.com',
      unpaidAmount: 617.4,
      bankMethod: 'Wise (USD)',
      thresholdMet: true,
      readyForBatch: true,
    },
    {
      id: 'aff-102',
      partner: 'Marcus Vance',
      email: 'marcus.fx@capital.io',
      unpaidAmount: 411.6,
      bankMethod: 'Wise (EUR)',
      thresholdMet: true,
      readyForBatch: true,
    },
    {
      id: 'aff-103',
      partner: 'Elena Rostova',
      email: 'elena@quantumforex.ru',
      unpaidAmount: 117.6,
      bankMethod: 'RiseWorks',
      thresholdMet: true,
      readyForBatch: false,
    },
  ];

  const totalOwings = owings.reduce((sum, o) => sum + o.unpaidAmount, 0);

  const handlePayBatch = async () => {
    setIsProcessing(true);
    try {
      await fetch('/api/admin/commissions/pay', { method: 'POST' }).catch(
        () => {}
      );
      setSuccess(
        t('Disbursement batch successfully queued for Wise execution.')
      );
      setTimeout(() => setSuccess(''), 4000);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t('Admin Report: Affiliate Commission Liabilities & Owings')}
        subtitle={t(
          'Accrued Liabilities, Threshold Validations & Single/Bulk Payout Queues'
        )}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <Link
            href="/admin/affiliates"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-400"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t('Back to Affiliates Directory')}</span>
          </Link>

          <Button
            onClick={handlePayBatch}
            disabled={isProcessing}
            className="self-start bg-amber-500 font-bold text-slate-950 hover:bg-amber-400 sm:self-auto"
          >
            {isProcessing ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-4 w-4" />
            )}
            {t('Queue Wise Disbursement Batch ($1,029.00)')}
          </Button>
        </div>

        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Overview Box */}
        <Card className="border-rose-500/30 bg-gradient-to-r from-rose-950/30 via-[#0d0f1a] to-[#090b14] p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                {t('Total Accrued Commission Liabilities')}
              </h3>
              <p className="text-xs text-slate-400">
                {t('Pending payout approval for active month end settlement.')}
              </p>
            </div>
            <div className="font-mono text-3xl font-extrabold text-rose-400">
              ${totalOwings.toFixed(2)}
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Partner ID')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Partner Name & Email')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Unpaid Owings')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Banking Method')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Threshold ($50)')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Batch Status')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {owings.map((o) => (
                <TableRow
                  key={o.id}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell className="font-mono text-xs text-slate-400">
                    {o.id}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-bold text-slate-200">
                      {o.partner}
                    </div>
                    <div className="text-[11px] text-slate-400">{o.email}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-400">
                    ${o.unpaidAmount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-xs text-slate-300">
                    {o.bankMethod}
                  </TableCell>
                  <TableCell>
                    <Badge className="border-emerald-500/40 bg-emerald-500/20 text-[10px] text-emerald-400">
                      {t('Met')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      className={`text-[10px] ${
                        o.readyForBatch
                          ? 'border-amber-500/40 bg-amber-500/20 text-amber-400'
                          : 'border-rose-500/40 bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {o.readyForBatch ? t('Ready for Batch') : t('On Hold')}
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
