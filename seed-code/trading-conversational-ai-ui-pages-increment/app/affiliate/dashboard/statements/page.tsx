'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  DollarSign,
  FileText,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AffiliateNav } from '@/components/affiliate/affiliate-nav';
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

interface Statement {
  id: string;
  month: string;
  grossSales: number;
  commission: number;
  fees: number;
  netPayout: number;
  status: 'PAID' | 'PROCESSING';
  pdfUrl: string;
}

export default function AffiliateStatementsPage() {
  const { t, formatCurrency } = useLocale();

  const statements: Statement[] = [
    {
      id: 'STMT-2026-07',
      month: 'July 2026',
      grossSales: 1470.0,
      commission: 441.0,
      fees: 2.5,
      netPayout: 438.5,
      status: 'PAID',
      pdfUrl: '#',
    },
    {
      id: 'STMT-2026-06',
      month: 'June 2026',
      grossSales: 1078.0,
      commission: 323.4,
      fees: 2.5,
      netPayout: 320.9,
      status: 'PAID',
      pdfUrl: '#',
    },
    {
      id: 'STMT-2026-05',
      month: 'May 2026',
      grossSales: 653.33,
      commission: 196.0,
      fees: 2.5,
      netPayout: 193.5,
      status: 'PAID',
      pdfUrl: '#',
    },
  ];

  const downloadStatement = (st: Statement) => {
    const header = [
      'Statement ID',
      'Billing Period',
      'Gross Referred Sales',
      'Earned Commission',
      'Transfer Fee',
      'Net Disbursed',
      'Status',
    ];
    const row = [
      st.id,
      st.month,
      st.grossSales.toFixed(2),
      st.commission.toFixed(2),
      st.fees.toFixed(2),
      st.netPayout.toFixed(2),
      st.status,
    ];
    const csv = [header, row]
      .map((cells) =>
        cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${st.id}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#06070a] text-slate-100 select-none">
      <AppHeader
        title={t('Affiliate Monthly Statements')}
        subtitle={t(
          'Official Tax Statements, Revenue Breakdown & CSV Download Archives'
        )}
      />

      <AffiliateNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Statement ID')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Billing Period')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Gross Referred Sales')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Earned Commission (30%)')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Transfer Fee')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Net Disbursed')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Status')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Document')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statements.map((st) => (
                <TableRow
                  key={st.id}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell className="font-mono text-xs font-bold text-amber-400">
                    {st.id}
                  </TableCell>
                  <TableCell className="text-xs font-semibold text-slate-300">
                    {t(st.month)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">
                    {formatCurrency(st.grossSales)}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-400">
                    {formatCurrency(st.commission)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">
                    {formatCurrency(st.fees)}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-300">
                    {formatCurrency(st.netPayout)}
                  </TableCell>
                  <TableCell>
                    <Badge className="border-emerald-500/40 bg-emerald-500/20 text-[10px] text-emerald-400">
                      {t(st.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadStatement(st)}
                      className="border-slate-700 bg-[#06080e] text-xs text-slate-300 hover:bg-slate-800 hover:text-amber-400"
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      <span>{t('CSV')}</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Tax Summary Note */}
        <Card className="border-slate-800/80 bg-[#090b14]/90 p-6">
          <h3 className="mb-2 text-sm font-bold text-slate-100">
            {t('Tax Summary Note')}
          </h3>
          <p className="text-xs leading-relaxed text-slate-400">
            {t(
              'These statements summarize commission activity and are not official tax documents. Amounts shown are in USD before any local withholding or currency-conversion fees applied by our payout provider. Consult a tax advisor in your jurisdiction to determine your reporting obligations.'
            )}
          </p>
        </Card>
      </main>
    </div>
  );
}
