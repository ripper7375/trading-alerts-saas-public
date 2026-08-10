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
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            Disbursement Overview
          </h1>
          <p className="mt-1 text-gray-400">
            RiseWorks payment system dashboard
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/disbursement/batches">
            <Button className="bg-green-600 hover:bg-green-700">
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
              <CardTitle className="flex items-center gap-2 text-white">
                System Health
                {health.healthy ? (
                  <Badge className="bg-green-600">Healthy</Badge>
                ) : (
                  <Badge className="bg-red-600">Unhealthy</Badge>
                )}
              </CardTitle>
              <span className="text-sm text-gray-400">
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
                <span className="text-gray-300">Database</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${health.checks.provider ? 'bg-green-500' : 'bg-red-500'}`}
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
                  <p key={i} className="text-sm text-yellow-400">
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
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400">
              Total Paid (All Time)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400 sm:text-4xl">
              {formatCurrency(summary?.amounts.totalPaid ?? 0)}
            </div>
            <p className="mt-1 text-sm text-gray-400">
              {summary?.transactions.completed ?? 0} transactions
            </p>
          </CardContent>
        </Card>

        {/* Pending Payout */}
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400">
              Pending Payout
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
            <p className="mt-1 text-sm text-gray-400">
              {payableSummary?.readyForPayout ?? 0} affiliates ready
            </p>
          </CardContent>
        </Card>

        {/* Batches */}
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-gray-400">
              Payment Batches
              {summary && (
                <Badge className="bg-blue-600 text-xs text-white">
                  {summary.batches.successRate.toFixed(1)}% success
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white sm:text-4xl">
              {summary?.batches.total ?? 0}
            </div>
            <p className="mt-1 text-sm text-gray-400">
              {summary?.batches.completed ?? 0} completed,{' '}
              {summary?.batches.pending ?? 0} pending
            </p>
          </CardContent>
        </Card>

        {/* Transactions */}
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-gray-400">
              Transactions
              {summary && summary.transactions.failed > 0 && (
                <Badge className="bg-red-600 text-xs text-white">
                  {summary.transactions.failed} failed
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white sm:text-4xl">
              {summary?.transactions.total ?? 0}
            </div>
            <p className="mt-1 text-sm text-green-400">
              {summary?.transactions.successRate.toFixed(1) ?? 0}% success rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Quick Actions</CardTitle>
            <CardDescription className="text-gray-400">
              Common disbursement tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/admin/disbursement/affiliates"
              className="block w-full rounded-lg bg-gray-700 px-4 py-3 text-left text-white transition-colors hover:bg-gray-600"
            >
              👥 View Payable Affiliates
            </Link>
            <Link
              href="/admin/disbursement/batches"
              className="block w-full rounded-lg bg-gray-700 px-4 py-3 text-left text-white transition-colors hover:bg-gray-600"
            >
              📦 Manage Payment Batches
            </Link>
            <Link
              href="/admin/disbursement/transactions?status=FAILED"
              className="block w-full rounded-lg bg-gray-700 px-4 py-3 text-left text-white transition-colors hover:bg-gray-600"
            >
              🚨 View Failed Transactions
            </Link>
            <Link
              href="/admin/disbursement/recipients"
              className="block w-full rounded-lg bg-gray-700 px-4 py-3 text-left text-white transition-colors hover:bg-gray-600"
            >
              🏦 Manage Payout Accounts
            </Link>
          </CardContent>
        </Card>

        {/* Batch Success Rate */}
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Batch Performance</CardTitle>
            <CardDescription className="text-gray-400">
              Payment batch success metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 text-5xl font-bold text-green-400">
              {summary?.batches.successRate.toFixed(1) ?? 0}%
            </div>
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-gray-400">Completed</span>
                  <span className="text-white">
                    {summary?.batches.completed ?? 0}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-700">
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
                  <span className="text-gray-400">Pending</span>
                  <span className="text-white">
                    {summary?.batches.pending ?? 0}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-700">
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
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Affiliates Ready</CardTitle>
            <CardDescription className="text-gray-400">
              Affiliates with pending payouts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 text-5xl font-bold text-blue-400">
              {payableSummary?.readyForPayout ?? 0}
            </div>
            <p className="mb-4 text-gray-400">
              Total affiliates: {payableSummary?.totalAffiliates ?? 0}
            </p>
            {payableSummary && payableSummary.readyForPayout > 0 && (
              <Link href="/admin/disbursement/affiliates">
                <Button className="w-full bg-green-600 hover:bg-green-700">
                  View & Process Payouts
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="border-gray-700 bg-gray-800">
        <CardHeader>
          <CardTitle className="text-white">
            About RiseWorks Disbursement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-gray-300">
          <p>
            This system handles affiliate commission payouts using RiseWorks
            blockchain infrastructure (USDC).
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm text-gray-400">
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
