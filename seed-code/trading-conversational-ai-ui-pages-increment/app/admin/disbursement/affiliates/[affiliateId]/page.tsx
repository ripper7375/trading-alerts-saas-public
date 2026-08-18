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
  KycStatusBadge,
  type BatchStatus,
  type TransactionStatus,
  type KycStatus,
} from '@/components/disbursement/status-badge';
import { useLocale } from '@/lib/context/locale-context';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SEED DATA — keyed by the same affiliate ids used on the Payable
// Affiliates list page.
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface RecentTransaction {
  id: string;
  transactionId: string;
  amount: number;
  status: TransactionStatus;
  batchNumber: string | null;
  batchStatus: BatchStatus | null;
  createdAt: string;
}

interface AffiliateDetail {
  name: string;
  email: string;
  country: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
  readyForPayout: boolean;
  wiseRecipientId: string;
  bankSummary: string;
  minimumThreshold: number;
  stats: {
    totalEarnings: number;
    totalPending: number;
    totalPaid: number;
    codesDistributed: number;
    codesUsed: number;
  };
  pendingCommissions: {
    count: number;
    totalAmount: number;
    oldestDate: string | null;
    meetsThreshold: boolean;
  };
  riseAccount: { kycStatus: KycStatus; riseId: string } | null;
  recentTransactions: RecentTransaction[];
}

const AFFILIATE_DETAILS: Record<string, AffiliateDetail> = {
  'aff-101': {
    name: 'Alex Morgan',
    email: 'alex.trader@gmail.com',
    country: 'TH',
    status: 'ACTIVE',
    readyForPayout: true,
    wiseRecipientId: 'wise_recp_98421098',
    bankSummary: 'Bangkok Bank PLC (USD Account)',
    minimumThreshold: 50,
    stats: {
      totalEarnings: 2469.6,
      totalPending: 617.4,
      totalPaid: 1852.2,
      codesDistributed: 14,
      codesUsed: 9,
    },
    pendingCommissions: {
      count: 6,
      totalAmount: 617.4,
      oldestDate: '2026-07-18',
      meetsThreshold: true,
    },
    riseAccount: { kycStatus: 'EXPIRED', riseId: 'rise_alex_morgan_101' },
    recentTransactions: [
      {
        id: 'tx-1',
        transactionId: 'WISE-TR-91099',
        amount: 320.0,
        status: 'COMPLETED',
        batchNumber: 'BATCH-2026-06',
        batchStatus: 'COMPLETED',
        createdAt: '2026-06-30T00:05:00Z',
      },
      {
        id: 'tx-2',
        transactionId: 'WISE-TR-99901',
        amount: 617.4,
        status: 'PENDING',
        batchNumber: 'BATCH-2026-08A',
        batchStatus: 'PENDING',
        createdAt: '2026-08-15T09:00:00Z',
      },
    ],
  },
  'aff-102': {
    name: 'Marcus Vance',
    email: 'marcus.fx@capital.io',
    country: 'DE',
    status: 'ACTIVE',
    readyForPayout: true,
    wiseRecipientId: 'wise_recp_33190812',
    bankSummary: 'Deutsche Bank AG (EUR Account)',
    minimumThreshold: 50,
    stats: {
      totalEarnings: 1234.8,
      totalPending: 411.6,
      totalPaid: 823.2,
      codesDistributed: 10,
      codesUsed: 6,
    },
    pendingCommissions: {
      count: 4,
      totalAmount: 411.6,
      oldestDate: '2026-07-22',
      meetsThreshold: true,
    },
    riseAccount: null,
    recentTransactions: [
      {
        id: 'tx-3',
        transactionId: 'WISE-TR-87211',
        amount: 320.9,
        status: 'COMPLETED',
        batchNumber: 'BATCH-2026-07B',
        batchStatus: 'COMPLETED',
        createdAt: '2026-08-01T02:15:00Z',
      },
    ],
  },
  'aff-103': {
    name: 'Elena Rostova',
    email: 'elena@quantumforex.ru',
    country: 'CY',
    status: 'ACTIVE',
    readyForPayout: false,
    wiseRecipientId: 'rise_recp_77182901',
    bankSummary: 'RiseWorks Custodial (USDC)',
    minimumThreshold: 50,
    stats: {
      totalEarnings: 352.8,
      totalPending: 117.6,
      totalPaid: 235.2,
      codesDistributed: 5,
      codesUsed: 3,
    },
    pendingCommissions: {
      count: 3,
      totalAmount: 117.6,
      oldestDate: '2026-07-29',
      meetsThreshold: true,
    },
    riseAccount: { kycStatus: 'SUBMITTED', riseId: 'rise_elena_rostova_77' },
    recentTransactions: [
      {
        id: 'tx-4',
        transactionId: 'RISE-TR-44120',
        amount: 193.0,
        status: 'COMPLETED',
        batchNumber: 'BATCH-2026-07B',
        batchStatus: 'COMPLETED',
        createdAt: '2026-07-31T00:05:00Z',
      },
    ],
  },
};

const FALLBACK_DETAIL: AffiliateDetail = {
  name: 'Unknown Affiliate',
  email: '—',
  country: '—',
  status: 'PENDING',
  readyForPayout: false,
  wiseRecipientId: '—',
  bankSummary: 'No recipient on file',
  minimumThreshold: 50,
  stats: {
    totalEarnings: 0,
    totalPending: 0,
    totalPaid: 0,
    codesDistributed: 0,
    codesUsed: 0,
  },
  pendingCommissions: {
    count: 0,
    totalAmount: 0,
    oldestDate: null,
    meetsThreshold: false,
  },
  riseAccount: null,
  recentTransactions: [],
};

const STATUS_BADGE_TONE: Record<AffiliateDetail['status'], string> = {
  ACTIVE: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  SUSPENDED: 'border-rose-500/40 bg-rose-500/15 text-rose-300',
  PENDING: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
};

interface AffiliateDetailPageProps {
  params: Promise<{ affiliateId: string }>;
}

export default function AffiliateDisbursementDetailPage({
  params,
}: AffiliateDetailPageProps) {
  const resolvedParams = use(params);
  const affiliateId = resolvedParams.affiliateId;
  const { t, formatCurrency, formatDate } = useLocale();

  const [detail, setDetail] = useState<AffiliateDetail>(
    () => AFFILIATE_DETAILS[affiliateId] ?? FALLBACK_DETAIL
  );
  const [isSending, setIsSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState('');

  const handleTriggerPayout = (): void => {
    setIsSending(true);
    setShowConfirm(false);
    setTimeout(() => {
      setDetail((prev) => ({
        ...prev,
        stats: {
          ...prev.stats,
          totalPending: 0,
          totalPaid: prev.stats.totalPaid + prev.pendingCommissions.totalAmount,
        },
        pendingCommissions: {
          count: 0,
          totalAmount: 0,
          oldestDate: null,
          meetsThreshold: false,
        },
      }));
      setIsSending(false);
      setSuccess(t('Individual Wise transfer dispatched successfully.'));
      setTimeout(() => setSuccess(''), 4000);
    }, 800);
  };

  const hasPendingPayout = detail.pendingCommissions.totalAmount > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin/disbursement/affiliates"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('Back to Payable Affiliates')}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-100 sm:text-3xl">
              {detail.name}
            </h1>
            <Badge
              className={`text-[10px] ${STATUS_BADGE_TONE[detail.status]}`}
            >
              {t(detail.status)}
            </Badge>
            {detail.readyForPayout && (
              <Badge className="border-emerald-500/40 bg-emerald-500/15 text-[10px] text-emerald-300">
                {t('Ready for Payout')}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {detail.email} · {detail.country}
          </p>
        </div>

        {hasPendingPayout && (
          <Button
            onClick={() => setShowConfirm(true)}
            disabled={isSending}
            className="bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
          >
            {isSending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-4 w-4" />
            )}
            {isSending
              ? t('Sending...')
              : `${t('Disburse Accrued Balance')} (${formatCurrency(detail.pendingCommissions.totalAmount)})`}
          </Button>
        )}
      </div>

      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-emerald-300">
          {success}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Card className="border-slate-800/80 bg-[#090c14]">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">
              {t('Total Earnings')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-xl font-bold text-slate-100">
              {formatCurrency(detail.stats.totalEarnings)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-800/80 bg-[#090c14]">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">
              {t('Pending')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-xl font-bold text-amber-400">
              {formatCurrency(detail.stats.totalPending)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-800/80 bg-[#090c14]">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">
              {t('Paid')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-xl font-bold text-emerald-400">
              {formatCurrency(detail.stats.totalPaid)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-800/80 bg-[#090c14]">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">
              {t('Codes Distributed')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-slate-100">
              {detail.stats.codesDistributed}
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-800/80 bg-[#090c14]">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">
              {t('Codes Used')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-slate-100">
              {detail.stats.codesUsed}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Pending Commissions */}
        <Card className="border-slate-800/80 bg-[#090c14]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-100">
              {t('Pending Commissions')}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {detail.pendingCommissions.count}{' '}
              {t('commissions awaiting payout')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">{t('Total Amount')}</span>
              <span className="font-mono text-slate-200">
                {formatCurrency(detail.pendingCommissions.totalAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{t('Oldest')}</span>
              <span className="text-slate-200">
                {detail.pendingCommissions.oldestDate
                  ? formatDate(detail.pendingCommissions.oldestDate)
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">
                {t('Meets Payout Threshold')} (
                {formatCurrency(detail.minimumThreshold)})
              </span>
              {detail.pendingCommissions.meetsThreshold ? (
                <Badge className="border-emerald-500/40 bg-emerald-500/15 text-[9px] text-emerald-300">
                  {t('Yes')}
                </Badge>
              ) : (
                <Badge className="border-slate-600/40 bg-slate-600/15 text-[9px] text-slate-400">
                  {t('No')}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Wise recipient + RiseWorks historical */}
        <Card className="border-slate-800/80 bg-[#090c14]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-100">
              {t('Wise Recipient')}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {detail.bankSummary}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">{t('Recipient ID')}</span>
              <span className="font-mono text-slate-300">
                {detail.wiseRecipientId}
              </span>
            </div>
            {detail.riseAccount ? (
              <div className="mt-2 flex items-center justify-between border-t border-slate-800 pt-2">
                <span className="flex items-center gap-1.5 text-slate-400">
                  {t('RiseWorks (Historical)')}
                </span>
                <KycStatusBadge status={detail.riseAccount.kycStatus} />
              </div>
            ) : (
              <p className="mt-2 border-t border-slate-800 pt-2 text-slate-500">
                {t('No RiseWorks account on record.')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-sm text-slate-100">
            {t('Recent Transactions')}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {t('Most recent disbursement transactions for this affiliate')}
          </CardDescription>
        </CardHeader>
        {detail.recentTransactions.length > 0 ? (
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Transaction')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Amount')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Status')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Batch')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Created')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.recentTransactions.map((tx) => (
                <TableRow
                  key={tx.id}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell className="font-mono text-xs text-slate-300">
                    {tx.transactionId}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-400">
                    {formatCurrency(tx.amount)}
                  </TableCell>
                  <TableCell>
                    <TransactionStatusBadge status={tx.status} />
                  </TableCell>
                  <TableCell>
                    {tx.batchNumber ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400">
                          {tx.batchNumber}
                        </span>
                        {tx.batchStatus && (
                          <BatchStatusBadge status={tx.batchStatus} />
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-slate-400">
                    {formatDate(tx.createdAt)}
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

      {/* Payout Confirmation */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="border-slate-800 bg-[#0b0e17] text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('Disburse')}{' '}
              {formatCurrency(detail.pendingCommissions.totalAmount)} {t('to')}{' '}
              {detail.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {t(
                'This dispatches a real payout via Wise to this affiliate’s recipient account. This action cannot be undone.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800">
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTriggerPayout}
              className="bg-emerald-600 text-white hover:bg-emerald-500"
            >
              {t('Disburse Balance')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
