'use client';

import Link from 'next/link';
import {
  Users,
  Package,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useLocale } from '@/lib/context/locale-context';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mock dashboard summary — mirrors the shape Codebase 1's Overview page
// derives from `GET /api/disbursement/reports/summary`,
// `/api/disbursement/health` and `/api/disbursement/affiliates/payable`.
// Codebase 2 is frontend-only, so this is static seed data rather than a
// live fetch, matching the rest of this admin suite's convention.
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SUMMARY = {
  batches: { total: 3, completed: 2, pending: 1, successRate: 92.3 },
  transactions: { total: 24, completed: 21, failed: 1, successRate: 95.8 },
  amounts: { totalPaid: 18452.3, totalPending: 3204.1 },
};

const HEALTH = {
  healthy: true,
  database: true,
  provider: true,
  pendingBatches: 1,
  failedTransactions: 1,
  warnings: ['1 transaction has been retried twice and needs manual review'],
};

const PAYABLE_SUMMARY = {
  totalAffiliates: 12,
  totalPendingAmount: 3204.1,
  readyForPayout: 4,
};

export default function AdminDisbursementPage() {
  const { t, formatCurrency } = useLocale();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl dark:text-slate-100">
            {t('Disbursement Overview')}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t('Wise & RiseWorks payment system dashboard')}
          </p>
        </div>
        <Link href="/admin/disbursement/batches">
          <Button className="bg-amber-500 font-bold text-slate-950 hover:bg-amber-400">
            {t('Create Batch')}
          </Button>
        </Link>
      </div>

      {/* System Health */}
      <Card
        className={
          HEALTH.healthy
            ? 'border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/10'
            : 'border-rose-500/30 bg-rose-500/10 dark:bg-rose-950/10'
        }
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-900 dark:text-slate-100">
              {HEALTH.healthy ? (
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              )}
              {t('System Health')}
              <Badge
                className={
                  HEALTH.healthy
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-[10px] text-emerald-700 dark:text-emerald-300'
                    : 'border-rose-500/40 bg-rose-500/15 text-[10px] text-rose-700 dark:text-rose-300'
                }
              >
                {HEALTH.healthy ? t('Healthy') : t('Unhealthy')}
              </Badge>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${HEALTH.database ? 'bg-emerald-500' : 'bg-rose-500'}`}
              />
              <span className="text-slate-700 dark:text-slate-300">
                {t('Database')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${HEALTH.provider ? 'bg-emerald-500' : 'bg-rose-500'}`}
              />
              <span className="text-slate-700 dark:text-slate-300">
                {t('Provider')}
              </span>
            </div>
            {HEALTH.pendingBatches > 0 && (
              <Badge className="border-amber-500/40 bg-amber-500/15 text-[10px] text-amber-700 dark:text-amber-300">
                {HEALTH.pendingBatches} {t('Pending')}
              </Badge>
            )}
            {HEALTH.failedTransactions > 0 && (
              <Badge className="border-rose-500/40 bg-rose-500/15 text-[10px] text-rose-700 dark:text-rose-300">
                {HEALTH.failedTransactions} {t('Failed')}
              </Badge>
            )}
          </div>
          {HEALTH.warnings.length > 0 && (
            <div className="mt-3 space-y-1">
              {HEALTH.warnings.map((warning) => (
                <p
                  key={warning}
                  className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400"
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {t(warning)}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#090c14]">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-600 dark:text-slate-400">
              {t('Total Paid (All Time)')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-extrabold text-emerald-700 sm:text-3xl dark:text-emerald-400">
              {formatCurrency(SUMMARY.amounts.totalPaid)}
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {SUMMARY.transactions.completed} {t('transactions')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#090c14]">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-600 dark:text-slate-400">
              {t('Pending Payout')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-extrabold text-amber-700 sm:text-3xl dark:text-amber-400">
              {formatCurrency(PAYABLE_SUMMARY.totalPendingAmount)}
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {PAYABLE_SUMMARY.readyForPayout} {t('affiliates ready')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#090c14]">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              {t('Payment Batches')}
              <Badge className="border-blue-500/40 bg-blue-500/15 text-[9px] text-blue-700 dark:text-blue-300">
                {SUMMARY.batches.successRate.toFixed(1)}% {t('success')}
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-slate-100">
              {SUMMARY.batches.total}
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {SUMMARY.batches.completed} {t('completed')},{' '}
              {SUMMARY.batches.pending} {t('pending')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#090c14]">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              {t('Transactions')}
              {SUMMARY.transactions.failed > 0 && (
                <Badge className="border-rose-500/40 bg-rose-500/15 text-[9px] text-rose-700 dark:text-rose-300">
                  {SUMMARY.transactions.failed} {t('failed')}
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-slate-100">
              {SUMMARY.transactions.total}
            </div>
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
              {SUMMARY.transactions.successRate.toFixed(1)}% {t('success rate')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Statistics */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#090c14]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-900 dark:text-slate-100">
              {t('Quick Actions')}
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              {t('Common disbursement tasks')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/admin/disbursement/affiliates"
              className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              {t('View Payable Affiliates')}
            </Link>
            <Link
              href="/admin/disbursement/batches"
              className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Package className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              {t('Manage Payment Batches')}
            </Link>
            <Link
              href="/admin/disbursement/transactions?status=FAILED"
              className="flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/5 dark:text-rose-300 dark:hover:bg-rose-500/15"
            >
              <AlertTriangle className="h-4 w-4" />
              {t('View Failed Transactions')}
            </Link>
            <Link
              href="/admin/disbursement/recipients"
              className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              {t('Manage Payout Accounts')}
            </Link>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#090c14]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-900 dark:text-slate-100">
              {t('Batch Performance')}
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              {t('Payment batch success metrics')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 font-mono text-4xl font-extrabold text-emerald-700 dark:text-emerald-400">
              {SUMMARY.batches.successRate.toFixed(1)}%
            </div>
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">
                    {t('Completed')}
                  </span>
                  <span className="text-slate-900 dark:text-slate-200">
                    {SUMMARY.batches.completed}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-emerald-500 transition-all duration-500"
                    style={{
                      width: `${(SUMMARY.batches.completed / SUMMARY.batches.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">
                    {t('Pending')}
                  </span>
                  <span className="text-slate-900 dark:text-slate-200">
                    {SUMMARY.batches.pending}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-amber-500 transition-all duration-500"
                    style={{
                      width: `${(SUMMARY.batches.pending / SUMMARY.batches.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#090c14]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-900 dark:text-slate-100">
              {t('Affiliates Ready')}
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              {t('Affiliates with pending payouts')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 font-mono text-4xl font-extrabold text-blue-700 dark:text-blue-400">
              {PAYABLE_SUMMARY.readyForPayout}
            </div>
            <p className="mb-4 text-xs text-slate-600 dark:text-slate-400">
              {t('Total affiliates')}: {PAYABLE_SUMMARY.totalAffiliates}
            </p>
            {PAYABLE_SUMMARY.readyForPayout > 0 && (
              <Link href="/admin/disbursement/affiliates">
                <Button className="w-full bg-amber-500 font-bold text-slate-950 hover:bg-amber-400">
                  {t('View & Process Payouts')}
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#090c14]">
        <CardHeader>
          <CardTitle className="text-sm text-slate-900 dark:text-slate-100">
            {t('About Wise & RiseWorks Disbursement')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
          <p>
            {t(
              'This system handles affiliate commission payouts using Wise Business (live) and a historical RiseWorks (USDC) record.'
            )}
          </p>
          <ul className="list-inside list-disc space-y-1 text-slate-600 dark:text-slate-400">
            <li>
              {t('Commissions are aggregated from approved affiliate sales')}
            </li>
            <li>
              {t(
                'Payment batches group multiple payouts for efficient processing'
              )}
            </li>
            <li>{t('All transactions are logged for audit compliance')}</li>
            <li>
              {t('Webhook events update transaction status in real-time')}
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
