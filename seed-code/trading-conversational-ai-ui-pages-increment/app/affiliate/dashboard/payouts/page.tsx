'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Landmark,
  CheckCircle2,
  Clock,
  ExternalLink,
  DollarSign,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AffiliateNav } from '@/components/affiliate/affiliate-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLocale } from '@/lib/context/locale-context';

interface PayoutBatchItem {
  id: string;
  date: string;
  method: 'Wise' | 'RiseWorks' | 'Bank Wire';
  currency: string;
  amount: number;
  fee: number;
  netPayout: number;
  status: 'COMPLETED' | 'PROCESSING' | 'SCHEDULED';
  reference: string;
}

export default function AffiliatePayoutsPage() {
  const { t } = useLocale();

  const [currentBalance, setCurrentBalance] = useState(176.4);
  const minThreshold = 50.0;
  const progress = Math.min(100, (currentBalance / minThreshold) * 100);

  const payouts: PayoutBatchItem[] = [
    {
      id: 'batch-jul-26',
      date: '2026-08-01',
      method: 'Wise',
      currency: 'USD',
      amount: 441.0,
      fee: 2.5,
      netPayout: 438.5,
      status: 'COMPLETED',
      reference: 'WISE-TR-99824',
    },
    {
      id: 'batch-jun-26',
      date: '2026-07-01',
      method: 'Wise',
      currency: 'USD',
      amount: 323.4,
      fee: 2.5,
      netPayout: 320.9,
      status: 'COMPLETED',
      reference: 'WISE-TR-87211',
    },
    {
      id: 'batch-may-26',
      date: '2026-06-01',
      method: 'Wise',
      currency: 'USD',
      amount: 196.0,
      fee: 2.5,
      netPayout: 193.5,
      status: 'COMPLETED',
      reference: 'WISE-TR-76120',
    },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#06070a] text-slate-100 select-none">
      <AppHeader
        title={t('Affiliate Payouts & Disbursement History')}
        subtitle={t(
          'Wise Business Automated Transfers, RiseWorks Treasury & Threshold Telemetry'
        )}
      />

      <AffiliateNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        {/* Next Payout Card */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="space-y-4 border-amber-500/30 bg-gradient-to-r from-[#0c0f1e] via-[#111526] to-[#090b14] p-6 md:col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/20 text-amber-400">
                  <Landmark className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    {t('Next Scheduled Disbursement')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {t('Scheduled: September 1, 2026 via Wise')}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="font-mono text-2xl font-extrabold text-emerald-400">
                  ${currentBalance.toFixed(2)}
                </div>
                <div className="text-[10px] tracking-wider text-slate-500 uppercase">
                  {t('Accrued Unpaid Balance')}
                </div>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>{t('Payout Threshold Progress ($50.00 Minimum)')}</span>
                <span className="font-bold text-emerald-400">
                  {t('Threshold Reached')} (100%)
                </span>
              </div>
              <Progress value={progress} className="h-2 bg-slate-800" />
            </div>
          </Card>

          <Card className="flex flex-col justify-between space-y-4 border-slate-800/80 bg-[#090b14]/90 p-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <h4 className="text-xs font-bold tracking-wider text-slate-200 uppercase">
                  {t('Primary Payout Account')}
                </h4>
              </div>
              <p className="text-xs font-medium text-slate-300">
                Wise Recipient •••• 4912
              </p>
              <p className="text-[11px] text-slate-500">
                {t('Managed & verified by Admin Disbursement Team')}
              </p>
            </div>

            <Link href="/help">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-750 w-full text-xs text-slate-300 hover:bg-slate-800"
              >
                {t('Contact Admin to Update Bank Details')}
              </Button>
            </Link>
          </Card>
        </div>

        {/* History Table */}
        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Disbursement Batch')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Date Executed')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Method')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Gross Amount')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Fee')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Net Received')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Reference / Tracking')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Status')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((p) => (
                <TableRow
                  key={p.id}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell className="font-mono text-xs font-bold text-slate-300">
                    {p.id}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">
                    {p.date}
                  </TableCell>
                  <TableCell className="text-xs text-slate-200">
                    {p.method}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">
                    ${p.amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">
                    ${p.fee.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-400">
                    ${p.netPayout.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-amber-400">
                    {p.reference}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge className="border-emerald-500/40 bg-emerald-500/20 text-[10px] text-emerald-400">
                      {p.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Payout Batch Status Guide */}
        <Card className="border-slate-800/80 bg-[#090b14]/90 p-6">
          <h3 className="mb-3 text-sm font-bold text-slate-100">
            {t('Payout Batch Status Guide')}
          </h3>
          <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <Badge className="border-slate-700 bg-slate-800 text-[10px] text-slate-400">
                SCHEDULED
              </Badge>
              <span className="text-slate-400">
                {t('Queued for the next disbursement run')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="border-cyan-500/40 bg-cyan-500/20 text-[10px] text-cyan-400">
                PROCESSING
              </Badge>
              <span className="text-slate-400">
                {t('Transfer initiated with the payout provider')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="border-emerald-500/40 bg-emerald-500/20 text-[10px] text-emerald-400">
                COMPLETED
              </Badge>
              <span className="text-slate-400">
                {t('Funds delivered to your payout account')}
              </span>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
