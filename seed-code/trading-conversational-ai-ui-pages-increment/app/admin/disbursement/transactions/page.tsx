'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  TransactionStatusBadge,
  type TransactionStatus,
} from '@/components/disbursement/status-badge';
import { useLocale } from '@/lib/context/locale-context';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SEED DATA
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface DisbursementTransaction {
  id: string;
  transactionId: string;
  partner: string;
  amount: number;
  provider: 'WISE' | 'RISE' | 'MOCK';
  providerTxId: string | null;
  batchRef: string;
  retryCount: number;
  status: TransactionStatus;
  errorMessage: string | null;
  createdAt: string;
}

const TRANSACTIONS: DisbursementTransaction[] = [
  {
    id: 'tx-1',
    transactionId: 'WISE-TR-99824',
    partner: 'Alex Morgan',
    amount: 438.5,
    provider: 'WISE',
    providerTxId: 'wise_tx_5510198',
    batchRef: 'BATCH-2026-07B',
    retryCount: 0,
    status: 'COMPLETED',
    errorMessage: null,
    createdAt: '2026-08-01T02:14:00Z',
  },
  {
    id: 'tx-2',
    transactionId: 'WISE-TR-87211',
    partner: 'Marcus Vance',
    amount: 320.9,
    provider: 'WISE',
    providerTxId: 'wise_tx_5510221',
    batchRef: 'BATCH-2026-07B',
    retryCount: 0,
    status: 'COMPLETED',
    errorMessage: null,
    createdAt: '2026-08-01T02:15:00Z',
  },
  {
    id: 'tx-3',
    transactionId: 'WISE-TR-76120',
    partner: 'Priya Nair',
    amount: 193.5,
    provider: 'WISE',
    providerTxId: null,
    batchRef: 'BATCH-2026-06',
    retryCount: 2,
    status: 'FAILED',
    errorMessage: 'Recipient bank rejected transfer: invalid IBAN checksum',
    createdAt: '2026-06-30T00:04:00Z',
  },
  {
    id: 'tx-4',
    transactionId: 'RISE-TR-44120',
    partner: 'Elena Rostova',
    amount: 193.0,
    provider: 'RISE',
    providerTxId: 'rise_tx_88213',
    batchRef: 'BATCH-2026-07B',
    retryCount: 0,
    status: 'COMPLETED',
    errorMessage: null,
    createdAt: '2026-07-31T00:05:00Z',
  },
  {
    id: 'tx-5',
    transactionId: 'WISE-TR-99901',
    partner: 'Alex Morgan',
    amount: 617.4,
    provider: 'WISE',
    providerTxId: null,
    batchRef: 'BATCH-2026-08A',
    retryCount: 0,
    status: 'PENDING',
    errorMessage: null,
    createdAt: '2026-08-15T09:00:00Z',
  },
  {
    id: 'tx-6',
    transactionId: 'WISE-TR-99902',
    partner: 'Marcus Vance',
    amount: 411.6,
    provider: 'WISE',
    providerTxId: null,
    batchRef: 'BATCH-2026-08A',
    retryCount: 0,
    status: 'PENDING',
    errorMessage: null,
    createdAt: '2026-08-15T09:00:00Z',
  },
  {
    id: 'tx-7',
    transactionId: 'WISE-TR-91188',
    partner: 'Priya Nair',
    amount: 88.2,
    provider: 'WISE',
    providerTxId: null,
    batchRef: 'BATCH-2026-05',
    retryCount: 1,
    status: 'PROCESSING',
    errorMessage: null,
    createdAt: '2026-08-16T11:22:00Z',
  },
  {
    id: 'tx-8',
    transactionId: 'WISE-TR-91050',
    partner: 'Sofia Reyes',
    amount: 64.0,
    provider: 'WISE',
    providerTxId: null,
    batchRef: 'BATCH-2026-05',
    retryCount: 0,
    status: 'CANCELLED',
    errorMessage: null,
    createdAt: '2026-08-05T08:00:00Z',
  },
];

const STATUS_OPTIONS: Array<TransactionStatus | 'ALL'> = [
  'ALL',
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
];

const PAGE_SIZE = 5;

function TransactionsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, formatCurrency, formatDate } = useLocale();

  const statusFilter =
    (searchParams.get('status') as TransactionStatus | null) ?? null;
  const [page, setPage] = useState(1);

  const filtered = statusFilter
    ? TRANSACTIONS.filter((tx) => tx.status === statusFilter)
    : TRANSACTIONS;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleStatusFilter = (status: TransactionStatus | 'ALL'): void => {
    setPage(1);
    const params = new URLSearchParams();
    if (status !== 'ALL') params.set('status', status);
    router.push(`/admin/disbursement/transactions?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 sm:text-3xl">
            {t('Transactions')}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {t('All disbursement transactions')}
          </p>
        </div>
        <Button
          variant="outline"
          className="border-slate-800 bg-[#090c14] text-slate-300 hover:bg-slate-800"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          {t('Refresh')}
        </Button>
      </div>

      {/* Status Filter */}
      <Card className="border-slate-800/80 bg-[#090c14]">
        <CardContent className="flex flex-wrap gap-2 py-4">
          {STATUS_OPTIONS.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={
                (status === 'ALL' && !statusFilter) || statusFilter === status
                  ? 'default'
                  : 'outline'
              }
              onClick={() => handleStatusFilter(status)}
              className={
                (status === 'ALL' && !statusFilter) || statusFilter === status
                  ? 'bg-amber-500 font-bold text-slate-950 hover:bg-amber-400'
                  : 'border-slate-800 bg-transparent text-xs text-slate-300 hover:bg-slate-800'
              }
            >
              {status === 'ALL' ? t('All Transactions') : t(status)}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Transactions Table */}
      {pageItems.length > 0 ? (
        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
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
                  {t('Provider')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Provider TX')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Retries')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Created')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Status')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((tx) => (
                <TableRow
                  key={tx.id}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell className="font-mono text-xs font-bold text-amber-400">
                    {tx.transactionId}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-slate-200">
                    {tx.partner}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-400">
                    {formatCurrency(tx.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge className="border-slate-600/40 bg-slate-600/15 text-[10px] text-slate-300">
                      {t(tx.provider)}
                    </Badge>
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
                  <TableCell className="font-mono text-xs text-slate-400">
                    {formatDate(tx.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <TransactionStatusBadge status={tx.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3">
            <p className="text-xs text-slate-400">
              {t('Showing')} {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, filtered.length)} {t('of')}{' '}
              {filtered.length}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="border-slate-800 bg-transparent text-xs text-slate-300 hover:bg-slate-800"
              >
                {t('Previous')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="border-slate-800 bg-transparent text-xs text-slate-300 hover:bg-slate-800"
              >
                {t('Next')}
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="border-slate-800/80 bg-[#090c14]">
          <CardContent className="py-12 text-center text-sm text-slate-400">
            {t('No transactions found.')}
          </CardContent>
        </Card>
      )}

      {/* Failed Transaction Details */}
      {statusFilter === 'FAILED' && filtered.length > 0 && (
        <Card className="border-slate-800/80 bg-[#090c14]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-100">
              {t('Failed Transaction Details')}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {t('Error information for failed transactions')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {filtered
              .filter((tx) => tx.errorMessage)
              .map((tx) => (
                <div
                  key={tx.id}
                  className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-200">
                      {tx.transactionId}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDate(tx.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-rose-300">
                    {tx.errorMessage && t(tx.errorMessage)}
                  </p>
                  {tx.retryCount > 0 && (
                    <p className="mt-1 text-[11px] text-amber-400">
                      {t('Retried')} {tx.retryCount} {t('times')}
                    </p>
                  )}
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-amber-500" />
        </div>
      }
    >
      <TransactionsPageContent />
    </Suspense>
  );
}
