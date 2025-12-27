'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { DisbursementDashboardSkeleton } from '@/components/admin/disbursement-skeletons';
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
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setIsLoading(false);
      }
    }

    void fetchData();
  }, []);

  if (isLoading) {
    return <DisbursementDashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-8" role="alert" aria-live="polite">
        <p className="text-red-400 mb-4">{error}</p>
        <Button
          onClick={() => window.location.reload()}
          className="bg-green-600 hover:bg-green-700"
          aria-label="Retry loading disbursement data"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Disbursement Overview
          </h1>
          <p className="text-gray-400 mt-1">
            RiseWorks payment system dashboard
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/disbursement/batches" aria-label="Navigate to create payment batch">
            <Button className="bg-green-600 hover:bg-green-700" aria-label="Create new payment batch">
              Create Batch
            </Button>
          </Link>
        </div>
      </div>

      {/* System Health Card */}
      {health && (
        <Card
          className={`border ${health.healthy ? 'border-green-600 bg-green-900/20' : 'border-red-600 bg-red-900/20'}`}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                System Health
                {health.healthy ? (
                  <Badge className="bg-green-600">Healthy</Badge>
                ) : (
                  <Badge className="bg-red-600">Unhealthy</Badge>
                )}
              </CardTitle>
              <span className="text-gray-400 text-sm">
                {new Date(health.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 text-sm" role="list" aria-label="System health checks">
              <div className="flex items-center gap-2" role="listitem">
                <span
                  className={`w-2 h-2 rounded-full ${health.checks.database ? 'bg-green-500' : 'bg-red-500'}`}
                  role="img"
                  aria-label={health.checks.database ? 'Database healthy' : 'Database unhealthy'}
                />
                <span className="text-gray-300">Database</span>
              </div>
              <div className="flex items-center gap-2" role="listitem">
                <span
                  className={`w-2 h-2 rounded-full ${health.checks.provider ? 'bg-green-500' : 'bg-red-500'}`}
                  role="img"
                  aria-label={health.checks.provider ? 'Provider healthy' : 'Provider unhealthy'}
                />
                <span className="text-gray-300">Provider</span>
              </div>
              {health.checks.pendingBatches > 0 && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-yellow-600">
                    {health.checks.pendingBatches} Pending
                  </Badge>
                </div>
              )}
              {health.checks.failedTransactions > 0 && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-600">
                    {health.checks.failedTransactions} Failed
                  </Badge>
                </div>
              )}
            </div>
            {health.warnings.length > 0 && (
              <div className="mt-3 space-y-1">
                {health.warnings.map((warning, i) => (
                  <p key={i} className="text-yellow-400 text-sm">
                    ⚠️ {warning}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Paid */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400">
              Total Paid (All Time)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl sm:text-4xl font-bold text-green-400">
              {formatCurrency(summary?.amounts.totalPaid ?? 0)}
            </div>
            <p className="text-gray-400 text-sm mt-1">
              {summary?.transactions.completed ?? 0} transactions
            </p>
          </CardContent>
        </Card>

        {/* Pending Payout */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400">
              Pending Payout
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl sm:text-4xl font-bold text-yellow-400">
              {formatCurrency(
                payableSummary?.totalPendingAmount ??
                  summary?.amounts.totalPending ??
                  0
              )}
            </div>
            <p className="text-gray-400 text-sm mt-1">
              {payableSummary?.readyForPayout ?? 0} affiliates ready
            </p>
          </CardContent>
        </Card>

        {/* Batches */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400 flex items-center gap-2">
              Payment Batches
              {summary && (
                <Badge className="bg-blue-600 text-white text-xs">
                  {summary.batches.successRate.toFixed(1)}% success
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl sm:text-4xl font-bold text-white">
              {summary?.batches.total ?? 0}
            </div>
            <p className="text-gray-400 text-sm mt-1">
              {summary?.batches.completed ?? 0} completed,{' '}
              {summary?.batches.pending ?? 0} pending
            </p>
          </CardContent>
        </Card>

        {/* Transactions */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400 flex items-center gap-2">
              Transactions
              {summary && summary.transactions.failed > 0 && (
                <Badge className="bg-red-600 text-white text-xs">
                  {summary.transactions.failed} failed
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl sm:text-4xl font-bold text-white">
              {summary?.transactions.total ?? 0}
            </div>
            <p className="text-green-400 text-sm mt-1">
              {summary?.transactions.successRate.toFixed(1) ?? 0}% success rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Quick Actions */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Quick Actions</CardTitle>
            <CardDescription className="text-gray-400">
              Common disbursement tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2" role="navigation" aria-label="Quick actions">
            <Link
              href="/admin/disbursement/affiliates"
              className="block w-full text-left px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
              aria-label="View affiliates with pending payouts"
            >
              👥 View Payable Affiliates
            </Link>
            <Link
              href="/admin/disbursement/batches"
              className="block w-full text-left px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
              aria-label="Manage payment batches"
            >
              📦 Manage Payment Batches
            </Link>
            <Link
              href="/admin/disbursement/transactions?status=FAILED"
              className="block w-full text-left px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
              aria-label="View failed transactions"
            >
              🚨 View Failed Transactions
            </Link>
            <Link
              href="/admin/disbursement/accounts"
              className="block w-full text-left px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
              aria-label="Manage RiseWorks blockchain accounts"
            >
              🔗 Manage RiseWorks Accounts
            </Link>
          </CardContent>
        </Card>

        {/* Batch Success Rate */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Batch Performance</CardTitle>
            <CardDescription className="text-gray-400">
              Payment batch success metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold text-green-400 mb-4">
              {summary?.batches.successRate.toFixed(1) ?? 0}%
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Completed</span>
                  <span className="text-white">
                    {summary?.batches.completed ?? 0}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-500"
                    style={{
                      width: summary?.batches.total
                        ? `${(summary.batches.completed / summary.batches.total) * 100}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Pending</span>
                  <span className="text-white">
                    {summary?.batches.pending ?? 0}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-yellow-500 h-2 rounded-full transition-all duration-500"
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
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Affiliates Ready</CardTitle>
            <CardDescription className="text-gray-400">
              Affiliates with pending payouts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold text-blue-400 mb-4">
              {payableSummary?.readyForPayout ?? 0}
            </div>
            <p className="text-gray-400 mb-4">
              Total affiliates: {payableSummary?.totalAffiliates ?? 0}
            </p>
            {payableSummary && payableSummary.readyForPayout > 0 && (
              <Link href="/admin/disbursement/affiliates" aria-label={`View and process ${payableSummary.readyForPayout} ready payouts`}>
                <Button className="w-full bg-green-600 hover:bg-green-700" aria-label="View and process affiliate payouts">
                  View & Process Payouts
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">
            About RiseWorks Disbursement
          </CardTitle>
        </CardHeader>
        <CardContent className="text-gray-300 space-y-2">
          <p>
            This system handles affiliate commission payouts using RiseWorks
            blockchain infrastructure (USDC).
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-400">
            <li>Commissions are aggregated from approved affiliate sales</li>
            <li>
              Payment batches group multiple payouts for efficient processing
            </li>
            <li>All transactions are logged for audit compliance</li>
            <li>Webhook events update transaction status in real-time</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
