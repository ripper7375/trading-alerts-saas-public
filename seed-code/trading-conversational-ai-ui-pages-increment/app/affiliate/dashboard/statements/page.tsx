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
  const { t } = useLocale();

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

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#06070a] text-slate-100 select-none">
      <AppHeader
        title={t('Affiliate Monthly Statements')}
        subtitle={t(
          'Official Tax Statements, Revenue Breakdown & PDF Download Archives'
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
                    {st.month}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">
                    ${st.grossSales.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-400">
                    ${st.commission.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">
                    ${st.fees.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-300">
                    ${st.netPayout.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge className="border-emerald-500/40 bg-emerald-500/20 text-[10px] text-emerald-400">
                      {st.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        alert(t('Downloading official PDF statement...'))
                      }
                      className="border-slate-700 bg-[#06080e] text-xs text-slate-300 hover:bg-slate-800 hover:text-amber-400"
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      <span>{t('PDF')}</span>
                    </Button>
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
