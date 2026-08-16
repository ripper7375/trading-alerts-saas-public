'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  Download,
  Calendar,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Landmark,
} from 'lucide-react';
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

export default function AdminDisbursementTransactionsPage() {
  const { t } = useLocale();
  const [search, setSearch] = useState('');

  const transactions = [
    {
      id: 'WISE-TR-99824',
      date: '2026-08-01 02:14 UTC',
      partner: 'Alex Morgan',
      gross: 441.0,
      fee: 2.5,
      net: 438.5,
      reference: 'BATCH-2026-07',
      status: 'SETTLED',
    },
    {
      id: 'WISE-TR-87211',
      date: '2026-08-01 02:15 UTC',
      partner: 'Marcus Vance',
      gross: 323.4,
      fee: 2.5,
      net: 320.9,
      reference: 'BATCH-2026-07',
      status: 'SETTLED',
    },
    {
      id: 'WISE-TR-76120',
      date: '2026-08-01 02:16 UTC',
      partner: 'Elena Rostova',
      gross: 196.0,
      fee: 2.5,
      net: 193.5,
      reference: 'BATCH-2026-07',
      status: 'SETTLED',
    },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t('Admin Disbursement: Bank Transfer Transactions')}
        subtitle={t(
          'Individual Bank Transfer Receipts, Settlement Confirmations & Fee Deductions'
        )}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="relative max-w-xs">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder={t('Search transaction...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 border-slate-800 bg-[#090b14] pl-9 text-xs text-slate-200"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => alert('Exporting Transactions CSV...')}
            className="self-start border-slate-800 bg-[#090b14] text-xs text-slate-300 hover:bg-slate-800 sm:self-auto"
          >
            <Download className="mr-1.5 h-3.5 w-3.5 text-amber-400" />
            {t('Export CSV Ledger')}
          </Button>
        </div>

        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Transaction ID')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Date & Time')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Partner')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Gross')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Gateway Fee')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Net Disbursed')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Batch Ref')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Status')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow
                  key={tx.id}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell className="font-mono text-xs font-bold text-amber-400">
                    {tx.id}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">
                    {tx.date}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-slate-200">
                    {tx.partner}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">
                    ${tx.gross.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">
                    ${tx.fee.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-400">
                    ${tx.net.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">
                    {tx.reference}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge className="border-emerald-500/40 bg-emerald-500/20 text-[10px] text-emerald-400">
                      {tx.status}
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
