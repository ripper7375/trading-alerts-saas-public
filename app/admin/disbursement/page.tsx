'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { useLocale } from '@/lib/context/locale-context';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface DisbursementSummary {
  batches: {
    total: number;
    completed: number;
    pending: number;
    successRate: number;
  };
  transactions: {
    total: number;
    completed: number;
    failed: number;
    successRate: number;
  };
  amounts: {
    totalPaid: number;
    totalPending: number;
  };
}

interface HealthStatus {
  healthy: boolean;
  timestamp: string;
  checks: {
    database: boolean;
    provider: boolean;
    pendingBatches: number;
    failedTransactions: number;
    lastWebhookReceived: string | null;
  };
  warnings: string[];
}

interface PayableSummary {
  totalAffiliates: number;
  totalPendingAmount: number;
  readyForPayout: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DISBURSEMENT DASHBOARD PAGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Disbursement Dashboard Overview Page - Client Component
 *
 * Features:
 * - Summary statistics: Total paid, pending, batches, transactions
 * - System health status
 * - Quick actions for common tasks
 * - Recent activity overview
 *
 * Data fetching:
 * - Fetches from /api/disbursement/reports/summary
 * - Fetches from /api/disbursement/health
 * - Fetches from /api/disbursement/affiliates/payable
 */
export default function DisbursementDashboardPage(): React.ReactElement {
  const { t } = useLocale();
  const [summary, setSummary] = useState<DisbursementSummary | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [payableSummary, setPayableSummary] = useState<PayableSummary | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData(): Promise<void> {
      try {
        // Fetch all data in parallel
        const [summaryRes, healthRes, payableRes] = await Promise.all([
          fetch('/api/disbursement/reports/summary'),
          fetch('/api/disbursement/health'),
          fetch('/api/disbursement/affiliates/payable'),
        ]);

        // Parse summary response
        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          setSummary(summaryData.summary);
        }

        // Parse health response
        if (healthRes.ok) {
          const healthData = await healthRes.json();
          setHealth(healthData);
        }

        // Parse payable response
        if (payableRes.ok) {
          const payableData = await payableRes.json();
          setPayableSummary(payableData.summary);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t('admin.disbursement.error_fetch_data', 'Failed to fetch data')
        );
      } finally {
        setIsLoading(false);
      }
    }

    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-green-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="mb-4 text-red-400">{error}</p>
        <Button
          onClick={() => window.location.reload()}
          className="bg-green-600 hover:bg-green-700"
        >
          {t('admin.dashboard.retry', 'Retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {t('admin.disbursement.overview_title', 'Disbursement Overview')}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t(
              'admin.disbursement.overview_subtitle',
              'Affiliate payout system dashboard — Wise (live)'
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/disbursement/batches">
            <Button>
              {t('admin.disbursement.create_batch', 'Create Batch')}
            </Button>
          </Link>
        </div>
      </div>

      {/* System Health Card */}
      {health && (
        <Card
          className={`border ${health.healthy ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-red-500/50 bg-red-500/10'}`}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-foreground">
                {t('admin.disbursement.system_health', 'System Health')}
                {health.healthy ? (
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    {t('admin.disbursement.healthy', 'Healthy')}
                  </Badge>
                ) : (
                  <Badge className="bg-red-500/10 text-red-600 dark:text-red-400">
                    {t('admin.disbursement.unhealthy', 'Unhealthy')}
                  </Badge>
                )}
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {new Date(health.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${health.checks.database ? 'bg-green-500' : 'bg-red-500'}`}
                />
                <span className="text-foreground">
                  {t('admin.disbursement.database', 'Database')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${health.checks.provider ? 'bg-green-500' : 'bg-red-500'}`}
                />
                <span className="text-foreground">
                  {t('admin.disbursement.provider', 'Provider')}
                </span>
              </div>
              {health.checks.pendingBatches > 0 && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    {t('admin.disbursement.n_pending', '{n} Pending').replace(
                      '{n}',
                      String(health.checks.pendingBatches)
                    )}
                  </Badge>
                </div>
              )}
              {health.checks.failedTransactions > 0 && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-500/10 text-red-600 dark:text-red-400">
                    {t('admin.disbursement.n_failed', '{n} Failed').replace(
                      '{n}',
                      String(health.checks.failedTransactions)
                    )}
                  </Badge>
                </div>
              )}
            </div>
            {health.warnings.length > 0 && (
              <div className="mt-3 space-y-1">
                {health.warnings.map((warning, i) => (
                  <p key={i} className="text-sm text-amber-500">
                    ⚠️ {warning}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
        {/* Total Paid */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground">
              {t(
                'admin.disbursement.total_paid_all_time',
                'Total Paid (All Time)'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400 sm:text-4xl">
              {formatCurrency(summary?.amounts.totalPaid ?? 0)}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(
                'admin.disbursement.n_transactions',
                '{n} transactions'
              ).replace('{n}', String(summary?.transactions.completed ?? 0))}
            </p>
          </CardContent>
        </Card>

        {/* Pending Payout */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground">
              {t('admin.disbursement.pending_payout', 'Pending Payout')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-400 sm:text-4xl">
              {formatCurrency(
                payableSummary?.totalPendingAmount ??
                  summary?.amounts.totalPending ??
                  0
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(
                'admin.disbursement.n_affiliates_ready',
                '{n} affiliates ready'
              ).replace('{n}', String(payableSummary?.readyForPayout ?? 0))}
            </p>
          </CardContent>
        </Card>

        {/* Batches */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-muted-foreground">
              {t('admin.disbursement.payment_batches', 'Payment Batches')}
              {summary && (
                <Badge className="bg-blue-500/10 text-xs text-blue-600 dark:text-blue-400">
                  {t(
                    'admin.disbursement.n_percent_success',
                    '{n}% success'
                  ).replace('{n}', summary.batches.successRate.toFixed(1))}
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground sm:text-4xl">
              {summary?.batches.total ?? 0}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(
                'admin.disbursement.n_completed_n_pending',
                '{completed} completed, {pending} pending'
              )
                .replace('{completed}', String(summary?.batches.completed ?? 0))
                .replace('{pending}', String(summary?.batches.pending ?? 0))}
            </p>
          </CardContent>
        </Card>

        {/* Transactions */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-muted-foreground">
              {t('admin.disbursement.transactions', 'Transactions')}
              {summary && summary.transactions.failed > 0 && (
                <Badge className="bg-red-500/10 text-xs text-red-600 dark:text-red-400">
                  {t('admin.disbursement.n_failed_lower', '{n} failed').replace(
                    '{n}',
                    String(summary.transactions.failed)
                  )}
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground sm:text-4xl">
              {summary?.transactions.total ?? 0}
            </div>
            <p className="mt-1 text-sm text-green-400">
              {t(
                'admin.disbursement.n_percent_success_rate',
                '{n}% success rate'
              ).replace(
                '{n}',
                summary?.transactions.successRate.toFixed(1) ?? '0'
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">
              {t('admin.dashboard.quick_actions', 'Quick Actions')}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {t(
                'admin.disbursement.common_tasks',
                'Common disbursement tasks'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/admin/disbursement/affiliates"
              className="block w-full rounded-lg bg-muted px-4 py-3 text-left text-foreground transition-colors hover:bg-accent"
            >
              {t(
                'admin.disbursement.view_payable_affiliates',
                '👥 View Payable Affiliates'
              )}
            </Link>
            <Link
              href="/admin/disbursement/batches"
              className="block w-full rounded-lg bg-muted px-4 py-3 text-left text-foreground transition-colors hover:bg-accent"
            >
              {t(
                'admin.disbursement.manage_payment_batches',
                '📦 Manage Payment Batches'
              )}
            </Link>
            <Link
              href="/admin/disbursement/transactions?status=FAILED"
              className="block w-full rounded-lg bg-muted px-4 py-3 text-left text-foreground transition-colors hover:bg-accent"
            >
              {t(
                'admin.disbursement.view_failed_transactions',
                '🚨 View Failed Transactions'
              )}
            </Link>
            <Link
              href="/admin/disbursement/recipients"
              className="block w-full rounded-lg bg-muted px-4 py-3 text-left text-foreground transition-colors hover:bg-accent"
            >
              {t(
                'admin.disbursement.manage_payout_accounts',
                '🏦 Manage Payout Accounts'
              )}
            </Link>
          </CardContent>
        </Card>

        {/* Batch Success Rate */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">
              {t('admin.disbursement.batch_performance', 'Batch Performance')}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {t(
                'admin.disbursement.batch_performance_desc',
                'Payment batch success metrics'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 text-5xl font-bold text-green-400">
              {summary?.batches.successRate.toFixed(1) ?? 0}%
            </div>
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('admin.disbursement.completed', 'Completed')}
                  </span>
                  <span className="text-foreground">
                    {summary?.batches.completed ?? 0}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-green-500 transition-all duration-500"
                    style={{
                      width: summary?.batches.total
                        ? `${(summary.batches.completed / summary.batches.total) * 100}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('admin.fraud.pending', 'Pending')}
                  </span>
                  <span className="text-foreground">
                    {summary?.batches.pending ?? 0}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-yellow-500 transition-all duration-500"
                    style={{
                      width: summary?.batches.total
                        ? `${(summary.batches.pending / summary.batches.total) * 100}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Affiliates Ready */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">
              {t('admin.disbursement.affiliates_ready', 'Affiliates Ready')}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {t(
                'admin.disbursement.affiliates_ready_desc',
                'Affiliates with pending payouts'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 text-5xl font-bold text-primary">
              {payableSummary?.readyForPayout ?? 0}
            </div>
            <p className="mb-4 text-muted-foreground">
              {t(
                'admin.disbursement.total_affiliates_count',
                'Total affiliates: {n}'
              ).replace('{n}', String(payableSummary?.totalAffiliates ?? 0))}
            </p>
            {payableSummary && payableSummary.readyForPayout > 0 && (
              <Link href="/admin/disbursement/affiliates">
                <Button className="w-full">
                  {t(
                    'admin.disbursement.view_process_payouts',
                    'View & Process Payouts'
                  )}
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">
            {t(
              'admin.disbursement.about_title',
              'About Affiliate Disbursement'
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-foreground">
          <p>
            {t(
              'admin.disbursement.about_desc_prefix',
              'This system handles affiliate commission payouts via Wise (live). RiseWorks (blockchain/USDC) is archived — see the'
            )}{' '}
            <Link
              href="/admin/disbursement/recipients"
              className="text-primary hover:underline"
            >
              {t('admin.disbursement.nav_payout_accounts', 'Payout Accounts')}
            </Link>{' '}
            {t(
              'admin.disbursement.about_desc_suffix',
              'page for its read-only historical record.'
            )}
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            <li>
              {t(
                'admin.disbursement.about_bullet_1',
                'Commissions are aggregated from approved affiliate sales'
              )}
            </li>
            <li>
              {t(
                'admin.disbursement.about_bullet_2',
                'Payment batches group multiple payouts for efficient processing'
              )}
            </li>
            <li>
              {t(
                'admin.disbursement.about_bullet_3',
                'All transactions are logged for audit compliance'
              )}
            </li>
            <li>
              {t(
                'admin.disbursement.about_bullet_4',
                'Webhook events update transaction status in real-time'
              )}
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
