'use client';

import React, { use, useState } from 'react';
import Link from 'next/link';
import {
  Layers,
  ArrowLeft,
  Send,
  CheckCircle2,
  AlertTriangle,
  Download,
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

interface AdminDisbursementBatchDetailProps {
  params: Promise<{ batchId: string }>;
}

export default function AdminDisbursementBatchDetailPage({
  params,
}: AdminDisbursementBatchDetailProps) {
  const resolvedParams = use(params);
  const batchId = resolvedParams.batchId;
  const { t } = useLocale();

  const [isExecuting, setIsExecuting] = useState(false);
  const [success, setSuccess] = useState('');

  const batchRecipients = [
    {
      id: 'aff-101',
      name: 'Alex Morgan',
      recipientId: 'wise_recp_98421098',
      amount: 617.4,
      fee: 2.5,
      net: 614.9,
      status: 'QUEUED',
    },
    {
      id: 'aff-102',
      name: 'Marcus Vance',
      recipientId: 'wise_recp_33190812',
      amount: 411.6,
      fee: 2.5,
      net: 409.1,
      status: 'QUEUED',
    },
  ];

  const handleExecuteBatch = () => {
    setIsExecuting(true);
    setTimeout(() => {
      setIsExecuting(false);
      setSuccess(
        t('Disbursement batch executed successfully via Wise Business API!')
      );
      setTimeout(() => setSuccess(''), 4000);
    }, 1000);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t('Admin Disbursement: Batch Review & Execution')}
        subtitle={t(`Inspecting Batch: ${batchId}`)}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <Link
            href="/admin/disbursement/batches"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-400"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t('Back to Batches Roster')}</span>
          </Link>

          <Button
            onClick={handleExecuteBatch}
            disabled={isExecuting}
            className="bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
          >
            {isExecuting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-4 w-4" />
            )}
            {t('Execute Batch Now ($1,029.00)')}
          </Button>
        </div>

        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Partner')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Wise Recipient ID')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Gross Amount')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Fee')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Net Transfer')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Status')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batchRecipients.map((r) => (
                <TableRow
                  key={r.id}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell className="text-xs font-bold text-slate-200">
                    {r.name}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">
                    {r.recipientId}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">
                    ${r.amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">
                    ${r.fee.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-400">
                    ${r.net.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge className="border-amber-500/40 bg-amber-500/20 text-[10px] text-amber-400">
                      {r.status}
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
