'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BatchStatusBadge,
  TransactionStatusBadge,
  AuditStatusBadge,
  type BatchStatus,
  type TransactionStatus,
  type AuditLogStatus,
} from '@/components/disbursement/status-badge';
import { useLocale } from '@/lib/context/locale-context';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES & SEED DATA — keyed by the same batch ids used on the batches
// list page, so navigating list → detail resolves to matching data.
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface BatchTransaction {
  id: string;
  transactionId: string;
  partner: string;
  providerTxId: string | null;
  amount: number;
  fee: number;
  status: TransactionStatus;
  retryCount: number;
}

interface AuditLogEntry {
  id: string;
  action: string;
  actor: string;
  status: AuditLogStatus;
  createdAt: string;
}

interface BatchDetail {
  batchNumber: string;
  provider: 'WISE' | 'RISE' | 'MOCK';
  currency: string;
  status: BatchStatus;
  totalAmount: number;
  paymentCount: number;
  createdAt: string;
  executedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
  transactions: BatchTransaction[];
  auditLogs: AuditLogEntry[];
}

const BATCH_DETAILS: Record<string, BatchDetail> = {
  'batch-2026-08a': {
    batchNumber: 'BATCH-2026-08A',
    provider: 'WISE',
    currency: 'USD',
    status: 'PENDING',
    totalAmount: 14250.0,
    paymentCount: 18,
    createdAt: '2026-08-15T09:00:00Z',
    executedAt: null,
    completedAt: null,
    failedAt: null,
    errorMessage: null,
    transactions: [
      {
        id: 'tx-1',
        transactionId: 'WISE-TR-99824',
        partner: 'Alex Morgan',
        providerTxId: null,
        amount: 617.4,
        fee: 2.5,
        status: 'PENDING',
        retryCount: 0,
      },
      {
        id: 'tx-2',
        transactionId: 'WISE-TR-99825',
        partner: 'Marcus Vance',
        providerTxId: null,
        amount: 411.6,
        fee: 2.5,
        status: 'PENDING',
        retryCount: 0,
      },
    ],
    auditLogs: [
      {
        id: 'aud-1',
        action: 'batch.created',
        actor: 'admin_sys',
        status: 'INFO',
        createdAt: '2026-08-15T09:00:00Z',
      },
    ],
  },
  'batch-2026-07b': {
    batchNumber: 'BATCH-2026-07B',
    provider: 'RISE',
    currency: 'USDC',
    status: 'COMPLETED',
    totalAmount: 8400.0,
    paymentCount: 9,
    createdAt: '2026-07-30T10:00:00Z',
    executedAt: '2026-07-31T00:00:00Z',
    completedAt: '2026-07-31T00:05:00Z',
    failedAt: null,
    errorMessage: null,
    transactions: [
      {
        id: 'tx-3',
        transactionId: 'RISE-TR-44120',
        partner: 'Elena Rostova',
        providerTxId: 'rise_tx_88213',
        amount: 196.0,
        fee: 0,
        status: 'COMPLETED',
        retryCount: 0,
      },
    ],
    auditLogs: [
      {
        id: 'aud-2',
        action: 'batch.created',
        actor: 'admin_sys',
        status: 'INFO',
        createdAt: '2026-07-30T10:00:00Z',
      },
      {
        id: 'aud-3',
        action: 'batch.executed',
        actor: 'admin_sys',
        status: 'SUCCESS',
        createdAt: '2026-07-31T00:00:00Z',
      },
      {
        id: 'aud-4',
        action: 'batch.completed',
        actor: 'riseworks_webhook',
        status: 'SUCCESS',
        createdAt: '2026-07-31T00:05:00Z',
      },
    ],
  },
  'batch-2026-06': {
    batchNumber: 'BATCH-2026-06',
    provider: 'WISE',
    currency: 'USD',
    status: 'COMPLETED',
    totalAmount: 5194.0,
    paymentCount: 7,
    createdAt: '2026-06-29T10:00:00Z',
    executedAt: '2026-06-30T00:00:00Z',
    completedAt: '2026-06-30T00:05:00Z',
    failedAt: null,
    errorMessage: null,
    transactions: [
      {
        id: 'tx-4',
        transactionId: 'WISE-TR-87211',
        partner: 'Marcus Vance',
        providerTxId: 'wise_tx_5510221',
        amount: 323.4,
        fee: 2.5,
        status: 'COMPLETED',
        retryCount: 0,
      },
      {
        id: 'tx-5',
        transactionId: 'WISE-TR-76120',
        partner: 'Priya Nair',
        providerTxId: null,
        amount: 118.0,
        fee: 2.5,
        status: 'FAILED',
        retryCount: 2,
      },
    ],
    auditLogs: [
      {
        id: 'aud-5',
        action: 'batch.created',
        actor: 'admin_sys',
        status: 'INFO',
        createdAt: '2026-06-29T10:00:00Z',
      },
      {
        id: 'aud-6',
        action: 'transaction.failed',
        actor: 'wise_webhook',
        status: 'FAILURE',
        createdAt: '2026-06-30T00:04:00Z',
      },
    ],
  },
};

const FALLBACK_BATCH: BatchDetail = {
  batchNumber: 'BATCH-UNKNOWN',
  provider: 'WISE',
  currency: 'USD',
  status: 'PENDING',
  totalAmount: 0,
  paymentCount: 0,
  createdAt: new Date().toISOString(),
  executedAt: null,
  completedAt: null,
  failedAt: null,
  errorMessage: null,
  transactions: [],
  auditLogs: [],
};

interface BatchDetailPageProps {
  params: Promise<{ batchId: string }>;
}

export default function BatchDetailsPage({ params }: BatchDetailPageProps) {
  const resolvedParams = use(params);
  const batchId = resolvedParams.batchId;
  const { t, formatCurrency, formatDate } = useLocale();

  const [batch, setBatch] = useState<BatchDetail>(
    () => BATCH_DETAILS[batchId] ?? { ...FALLBACK_BATCH, batchNumber: batchId }
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showExecuteConfirm, setShowExecuteConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);

  const completedCount = batch.transactions.filter(
    (tx) => tx.status === 'COMPLETED'
  ).length;
  const failedCount = batch.transactions.filter(
    (tx) => tx.status === 'FAILED'
  ).length;

  const handleExecuteBatch = (): void => {
    setIsProcessing(true);
    setShowExecuteConfirm(false);
    setTimeout(() => {
      setBatch((prev) => ({
        ...prev,
        status: 'COMPLETED',
        executedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        transactions: prev.transactions.map((tx) => ({
          ...tx,
          status: 'COMPLETED',
        })),
        auditLogs: [
          {
            id: `aud-${Date.now()}`,
            action: 'batch.executed',
            actor: 'admin_sys',
            status: 'SUCCESS',
            createdAt: new Date().toISOString(),
          },
          ...prev.auditLogs,
        ],
      }));
      setIsProcessing(false);
      setSuccessMessage(
        `Batch executed: ${batch.transactions.length} succeeded, 0 failed`
      );
      setTimeout(() => setSuccessMessage(null), 4000);
    }, 1200);
  };

  const handleDeleteBatch = (): void => {
    setShowDeleteConfirm(false);
    setIsDeleted(true);
  };

  if (isDeleted) {
    return (
      <div className="py-12 text-center">
        <p className="mb-4 text-sm text-slate-400">
          {t('Batch deleted successfully.')}
        </p>
        <Link href="/admin/disbursement/batches">
          <Button
            variant="outline"
            className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800"
          >
            {t('Back to Batches')}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin/disbursement/batches"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('Back to Batches')}
          </Link>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-bold text-slate-100 sm:text-3xl">
            {batch.batchNumber}
            <BatchStatusBadge status={batch.status} />
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            {t('Created')} {formatDate(batch.createdAt)}
          </p>
        </div>
        {batch.status === 'PENDING' && (
          <div className="flex gap-2">
            <Button
              onClick={() => setShowExecuteConfirm(true)}
              disabled={isProcessing}
              className="bg-emerald-600 font-bold text-white hover:bg-emerald-500"
            >
              {isProcessing ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-4 w-4" />
              )}
              {isProcessing ? t('Executing...') : t('Execute Batch')}
            </Button>
            <Button
              variant="destructive"
              disabled={isProcessing}
              onClick={() => setShowDeleteConfirm(true)}
            >
              {t('Delete')}
            </Button>
          </div>
        )}
      </div>

      {successMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-emerald-300">
          {t(successMessage)}
        </div>
      )}

      {/* Batch Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-slate-800/80 bg-[#090c14]">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">
              {t('Total Amount')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-bold text-emerald-400">
              {formatCurrency(batch.totalAmount)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-800/80 bg-[#090c14]">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">
              {t('Payments')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">
              {batch.paymentCount}
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-800/80 bg-[#090c14]">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">
              {t('Completed')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">
              {completedCount}
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-800/80 bg-[#090c14]">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">
              {t('Failed')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-400">
              {failedCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Batch Details */}
      <Card className="border-slate-800/80 bg-[#090c14]">
        <CardHeader>
          <CardTitle className="text-sm text-slate-100">
            {t('Batch Details')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
            <div>
              <p className="text-slate-400">{t('Provider')}</p>
              <p className="mt-0.5 text-slate-200">{batch.provider}</p>
            </div>
            <div>
              <p className="text-slate-400">{t('Currency')}</p>
              <p className="mt-0.5 text-slate-200">{batch.currency}</p>
            </div>
            {batch.executedAt && (
              <div>
                <p className="text-slate-400">{t('Executed At')}</p>
                <p className="mt-0.5 text-slate-200">
                  {formatDate(batch.executedAt)}
                </p>
              </div>
            )}
            {batch.completedAt && (
              <div>
                <p className="text-slate-400">{t('Completed At')}</p>
                <p className="mt-0.5 text-slate-200">
                  {formatDate(batch.completedAt)}
                </p>
              </div>
            )}
            {batch.errorMessage && (
              <div className="sm:col-span-2">
                <p className="text-slate-400">{t('Error Message')}</p>
                <p className="mt-0.5 text-rose-400">{batch.errorMessage}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm text-slate-100">
            {t('Transactions')}
            <Badge className="border-slate-600/40 bg-slate-600/15 text-[10px] text-slate-300">
              {batch.transactions.length}
            </Badge>
          </CardTitle>
          <CardDescription className="text-slate-400">
            {t('Individual payment transactions in this batch')}
          </CardDescription>
        </CardHeader>
        {batch.transactions.length > 0 ? (
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Transaction ID')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Partner')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Amount')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Fee')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Provider TX')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Retries')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Status')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batch.transactions.map((tx) => (
                <TableRow
                  key={tx.id}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell className="font-mono text-xs text-slate-300">
                    {tx.transactionId}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-slate-200">
                    {tx.partner}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-400">
                    {formatCurrency(tx.amount)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">
                    {formatCurrency(tx.fee)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">
                    {tx.providerTxId || '—'}
                  </TableCell>
                  <TableCell
                    className={
                      tx.retryCount > 0
                        ? 'text-xs text-amber-400'
                        : 'text-xs text-slate-400'
                    }
                  >
                    {tx.retryCount}
                  </TableCell>
                  <TableCell className="text-right">
                    <TransactionStatusBadge status={tx.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <CardContent className="py-6 text-center text-xs text-slate-400">
            {t('No transactions yet.')}
          </CardContent>
        )}
      </Card>

      {/* Audit Logs */}
      {batch.auditLogs.length > 0 && (
        <Card className="border-slate-800/80 bg-[#090c14]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-slate-100">
              {t('Audit Logs')}
              <Badge className="border-slate-600/40 bg-slate-600/15 text-[10px] text-slate-300">
                {batch.auditLogs.length}
              </Badge>
            </CardTitle>
            <CardDescription className="text-slate-400">
              {t('Activity history for this batch')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {batch.auditLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 rounded-lg bg-slate-800/40 p-3"
              >
                <div className="mt-0.5">
                  <AuditStatusBadge status={log.status} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-200">
                    {log.action}
                  </p>
                  <p className="text-[11px] text-slate-400">by {log.actor}</p>
                </div>
                <span className="text-[11px] text-slate-500">
                  {formatDate(log.createdAt)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Execute Confirmation */}
      <AlertDialog
        open={showExecuteConfirm}
        onOpenChange={setShowExecuteConfirm}
      >
        <AlertDialogContent className="border-slate-800 bg-[#0b0e17] text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('Execute this batch?')} ({formatCurrency(batch.totalAmount)})
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {t(
                'This dispatches real payouts to every recipient in the batch via'
              )}{' '}
              {batch.provider}. {t('This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800">
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExecuteBatch}
              className="bg-emerald-600 text-white hover:bg-emerald-500"
            >
              {t('Execute Batch')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="border-slate-800 bg-[#0b0e17] text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete this batch?')}</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {t('This permanently removes the batch and cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800">
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBatch}
              className="bg-rose-600 text-white hover:bg-rose-500"
            >
              {t('Delete Batch')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
