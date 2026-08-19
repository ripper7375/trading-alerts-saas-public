'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, RefreshCw } from 'lucide-react';

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  type BatchStatus,
} from '@/components/disbursement/status-badge';
import { useLocale } from '@/lib/context/locale-context';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES & SEED DATA
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PaymentBatch {
  id: string;
  batchNumber: string;
  paymentCount: number;
  totalAmount: number;
  provider: 'WISE' | 'RISE' | 'MOCK';
  status: BatchStatus;
  createdAt: string;
}

const INITIAL_BATCHES: PaymentBatch[] = [
  {
    id: 'batch-2026-08a',
    batchNumber: 'BATCH-2026-08A',
    paymentCount: 18,
    totalAmount: 14250.0,
    provider: 'WISE',
    status: 'PENDING',
    createdAt: '2026-08-15T09:00:00Z',
  },
  {
    id: 'batch-2026-07b',
    batchNumber: 'BATCH-2026-07B',
    paymentCount: 9,
    totalAmount: 8400.0,
    provider: 'RISE',
    status: 'COMPLETED',
    createdAt: '2026-07-31T00:05:00Z',
  },
  {
    id: 'batch-2026-06',
    batchNumber: 'BATCH-2026-06',
    paymentCount: 7,
    totalAmount: 5194.0,
    provider: 'WISE',
    status: 'COMPLETED',
    createdAt: '2026-06-30T00:05:00Z',
  },
];

interface BatchPreviewItem {
  affiliateId: string;
  affiliateName: string;
  commissionCount: number;
  totalAmount: number;
  eligible: boolean;
  reason?: string;
}

const BATCH_PREVIEW: BatchPreviewItem[] = [
  {
    affiliateId: 'aff-101',
    affiliateName: 'Alex Morgan',
    commissionCount: 6,
    totalAmount: 617.4,
    eligible: true,
  },
  {
    affiliateId: 'aff-102',
    affiliateName: 'Marcus Vance',
    commissionCount: 4,
    totalAmount: 411.6,
    eligible: true,
  },
  {
    affiliateId: 'aff-103',
    affiliateName: 'Elena Rostova',
    commissionCount: 2,
    totalAmount: 32.5,
    eligible: false,
    reason: 'Below $50.00 minimum threshold',
  },
];

const STATUS_OPTIONS: Array<BatchStatus | 'ALL'> = [
  'ALL',
  'PENDING',
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
];

export default function PaymentBatchesPage() {
  const { t, formatCurrency, formatDate } = useLocale();

  const [batches, setBatches] = useState<PaymentBatch[]>(INITIAL_BATCHES);
  const [statusFilter, setStatusFilter] = useState<BatchStatus | 'ALL'>('ALL');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const eligiblePreview = BATCH_PREVIEW.filter((item) => item.eligible);
  const previewTotal = eligiblePreview.reduce(
    (sum, item) => sum + item.totalAmount,
    0
  );

  const filteredBatches =
    statusFilter === 'ALL'
      ? batches
      : batches.filter((b) => b.status === statusFilter);

  const handleCreateBatch = (): void => {
    setIsProcessing(true);
    setTimeout(() => {
      const newBatch: PaymentBatch = {
        id: `batch-${Date.now()}`,
        batchNumber: `BATCH-2026-09-${String(batches.length + 1).padStart(2, '0')}`,
        paymentCount: eligiblePreview.length,
        totalAmount: previewTotal,
        provider: 'WISE',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };
      setBatches((prev) => [newBatch, ...prev]);
      setIsProcessing(false);
      setShowCreateDialog(false);
      setSuccessMessage(`${t('Batch created:')} ${newBatch.batchNumber}`);
      setTimeout(() => setSuccessMessage(null), 4000);
    }, 900);
  };

  const handleExecuteBatch = (batchId: string): void => {
    setIsProcessing(true);
    setTimeout(() => {
      setBatches((prev) =>
        prev.map((b) =>
          b.id === batchId ? { ...b, status: 'COMPLETED' as BatchStatus } : b
        )
      );
      setIsProcessing(false);
      setSuccessMessage('Batch executed: all payments succeeded');
      setTimeout(() => setSuccessMessage(null), 4000);
    }, 1000);
  };

  const handleDeleteBatch = (): void => {
    if (!deleteTargetId) return;
    setBatches((prev) => prev.filter((b) => b.id !== deleteTargetId));
    setDeleteTargetId(null);
    setSuccessMessage('Batch deleted successfully');
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl dark:text-slate-100">
            {t('Payment Batches')}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t('Manage and execute payment batches')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-[#090c14] dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {t('Refresh')}
          </Button>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {t('Create Batch')}
          </Button>
        </div>
      </div>

      {successMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          {t(successMessage)}
        </div>
      )}

      {/* Status Filter */}
      <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#090c14]">
        <CardContent className="flex flex-wrap gap-2 py-4">
          {STATUS_OPTIONS.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={statusFilter === status ? 'default' : 'outline'}
              onClick={() => setStatusFilter(status)}
              className={
                statusFilter === status
                  ? 'bg-amber-500 font-bold text-slate-950 hover:bg-amber-400'
                  : 'border-slate-300 bg-slate-50 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800'
              }
            >
              {status === 'ALL' ? t('All Batches') : t(status)}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Batches Table */}
      {filteredBatches.length > 0 ? (
        <Card className="overflow-hidden border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#090b14]/90 dark:backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-[#06080e]">
              <TableRow className="border-slate-200 hover:bg-transparent dark:border-slate-800">
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Batch #')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Status')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Payments')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Amount')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Provider')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Created')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBatches.map((batch) => (
                <TableRow
                  key={batch.id}
                  className="border-slate-200 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/30"
                >
                  <TableCell>
                    <Link
                      href={`/admin/disbursement/batches/${batch.id}`}
                      className="font-mono text-xs font-bold text-amber-700 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300"
                    >
                      {batch.batchNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <BatchStatusBadge status={batch.status} />
                  </TableCell>
                  <TableCell className="text-xs text-slate-700 dark:text-slate-300">
                    {batch.paymentCount}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(batch.totalAmount)}
                  </TableCell>
                  <TableCell>
                    <Badge className="border-slate-300 bg-slate-100 text-[10px] text-slate-700 dark:border-slate-600/40 dark:bg-slate-600/15 dark:text-slate-300">
                      {t(batch.provider)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">
                    {formatDate(batch.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {batch.status === 'PENDING' && (
                        <Button
                          size="sm"
                          disabled={isProcessing}
                          onClick={() => handleExecuteBatch(batch.id)}
                          className="h-7 bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-500"
                        >
                          {t('Execute')}
                        </Button>
                      )}
                      {(batch.status === 'PENDING' ||
                        batch.status === 'CANCELLED' ||
                        batch.status === 'FAILED') && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={isProcessing}
                          onClick={() => setDeleteTargetId(batch.id)}
                          className="h-7 text-xs"
                        >
                          {t('Delete')}
                        </Button>
                      )}
                      <Link href={`/admin/disbursement/batches/${batch.id}`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 border-slate-300 bg-slate-50 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          {t('Details')}
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#090c14]">
          <CardContent className="py-12 text-center text-sm text-slate-600 dark:text-slate-400">
            {t('No batches found.')}
          </CardContent>
        </Card>
      )}

      {/* Create Batch Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-auto border-slate-200 bg-white text-slate-900 shadow-xl dark:border-slate-800 dark:bg-[#0b0e17] dark:text-slate-100">
          <DialogHeader>
            <DialogTitle>{t('Create Payment Batch')}</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              {t('Review the batch preview before creating')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-transparent dark:bg-slate-800/50">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {t('Total Affiliates')}
              </p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {BATCH_PREVIEW.length}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-transparent dark:bg-slate-800/50">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {t('Eligible')}
              </p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                {eligiblePreview.length}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-transparent dark:bg-slate-800/50">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {t('Total Amount')}
              </p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(previewTotal)}
              </p>
            </div>
          </div>

          <div className="max-h-60 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-100 text-slate-700 dark:bg-[#06080e] dark:text-slate-400">
                <tr className="border-b border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-3 py-2 text-left font-medium">
                    {t('Affiliate')}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    {t('Commissions')}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    {t('Amount')}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    {t('Eligible')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {BATCH_PREVIEW.map((item) => (
                  <tr
                    key={item.affiliateId}
                    className="border-b border-slate-200 last:border-0 dark:border-slate-800/50"
                  >
                    <td className="px-3 py-2 text-slate-900 dark:text-slate-200">
                      {item.affiliateName}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      {item.commissionCount}
                    </td>
                    <td className="px-3 py-2 font-mono text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(item.totalAmount)}
                    </td>
                    <td className="px-3 py-2">
                      {item.eligible ? (
                        <Badge className="border-emerald-500/40 bg-emerald-500/15 text-[9px] text-emerald-700 dark:text-emerald-300">
                          {t('Yes')}
                        </Badge>
                      ) : (
                        <Badge className="border-rose-500/40 bg-rose-500/15 text-[9px] text-rose-700 dark:text-rose-300">
                          {item.reason ? t(item.reason) : t('No')}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={() => setShowCreateDialog(false)}
            >
              {t('Cancel')}
            </Button>
            <Button
              disabled={isProcessing || eligiblePreview.length === 0}
              onClick={handleCreateBatch}
              className="bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
            >
              {isProcessing ? t('Creating...') : t('Create Batch')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
      >
        <AlertDialogContent className="border-slate-200 bg-white text-slate-900 shadow-xl dark:border-slate-800 dark:bg-[#0b0e17] dark:text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete this batch?')}</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              {t(
                'This permanently removes the batch and cannot be undone. Only pending, cancelled, or failed batches can be deleted.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800">
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
