'use client';

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

interface AdminMetrics {
  overview: {
    totalUsers: number;
    freeUsers: number;
    proUsers: number;
    freePercentage: number;
    proPercentage: number;
  };
  revenue: {
    mrr: number;
    arr: number;
    conversionRate: number;
    pricePerUser: number;
  };
  growth: {
    newUsersThisMonth: number;
    churnedThisMonth: number;
  };
}

interface RecentFraudAlert {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  pattern: string;
  description: string;
  createdAt: string;
  userEmail: string | null;
}

interface FraudAlertsListResponse {
  alerts: Array<{
    id: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    pattern: string;
    description: string;
    createdAt: string;
    userEmail: string | null;
  }>;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN DASHBOARD PAGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Admin Dashboard Overview Page - Client Component
 *
 * Features:
 * - Metric cards: Total Users, FREE users, PRO users, MRR
 * - Tier distribution visualization
 * - Recent activity feed
 * - Quick action buttons
 *
 * Data fetching:
 * - Fetches analytics from /api/admin/analytics
 * - Refreshes on initial load
 */
export default function AdminDashboardPage(): React.ReactElement {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<RecentFraudAlert[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics(): Promise<void> {
      try {
        const response = await fetch('/api/admin/analytics');
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch analytics');
        }
        const data = await response.json();
        setMetrics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    async function fetchRecentFraudAlerts(): Promise<void> {
      try {
        // pageSize has a hard minimum of 10 (route's own querySchema) — fetch
        // the smallest allowed page and show the 5 most recent here.
        const response = await fetch(
          '/api/admin/fraud-alerts?page=1&pageSize=10'
        );
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch fraud alerts');
        }
        const data: FraudAlertsListResponse = await response.json();
        setRecentAlerts(data.alerts.slice(0, 5));
        setActivityError(null);
      } catch (err) {
        setActivityError(
          err instanceof Error ? err.message : 'Failed to load recent activity'
        );
      }
    }

    void fetchMetrics();
    void fetchRecentFraudAlerts();
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="py-8 text-center">
        <p className="mb-4 text-red-400">{error || 'Failed to load metrics'}</p>
        <Button
          onClick={() => window.location.reload()}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Dashboard</h1>
        <p className="mt-1 text-gray-400">System overview and key metrics</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
        {/* Total Users */}
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400">
              Total Users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white sm:text-4xl">
              {metrics.overview.totalUsers.toLocaleString()}
            </div>
            <p className="mt-1 text-sm text-green-400">
              +{metrics.growth.newUsersThisMonth} this month
            </p>
          </CardContent>
        </Card>

        {/* FREE Users */}
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-gray-400">
              FREE Users
              <Badge className="bg-gray-600 text-xs text-white hover:bg-gray-600">
                {metrics.overview.freePercentage.toFixed(1)}%
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white sm:text-4xl">
              {metrics.overview.freeUsers.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        {/* PRO Users */}
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-gray-400">
              PRO Users
              <Badge className="bg-blue-600 text-xs text-white hover:bg-blue-600">
                {metrics.overview.proPercentage.toFixed(1)}%
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-400 sm:text-4xl">
              {metrics.overview.proUsers.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        {/* MRR */}
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400">
              Monthly Recurring Revenue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400 sm:text-4xl">
              {formatCurrency(metrics.revenue.mrr)}
            </div>
            <p className="mt-1 text-sm text-gray-400">
              ARR: {formatCurrency(metrics.revenue.arr)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Conversion Rate */}
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Conversion Rate</CardTitle>
            <CardDescription className="text-gray-400">
              FREE to PRO conversion
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-400 sm:text-5xl">
              {metrics.revenue.conversionRate.toFixed(1)}%
            </div>
            <p className="mt-2 text-sm text-gray-400">
              {metrics.overview.proUsers} PRO out of{' '}
              {metrics.overview.totalUsers} total users
            </p>
          </CardContent>
        </Card>

        {/* Tier Distribution */}
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Tier Distribution</CardTitle>
            <CardDescription className="text-gray-400">
              User breakdown by tier
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* FREE Bar */}
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-gray-400">FREE</span>
                  <span className="text-white">
                    {metrics.overview.freePercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-gray-700">
                  <div
                    className="h-3 rounded-full bg-gray-500 transition-all duration-500"
                    style={{ width: `${metrics.overview.freePercentage}%` }}
                  />
                </div>
              </div>

              {/* PRO Bar */}
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-gray-400">PRO</span>
                  <span className="text-white">
                    {metrics.overview.proPercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-gray-700">
                  <div
                    className="h-3 rounded-full bg-blue-600 transition-all duration-500"
                    style={{ width: `${metrics.overview.proPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Quick Actions</CardTitle>
            <CardDescription className="text-gray-400">
              Common admin tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="/admin/errors"
              className="block w-full rounded-lg bg-gray-700 px-4 py-3 text-left text-white transition-colors hover:bg-gray-600"
            >
              🚨 View Latest Errors
            </a>
            <a
              href="/admin/users?tier=PRO"
              className="block w-full rounded-lg bg-gray-700 px-4 py-3 text-left text-white transition-colors hover:bg-gray-600"
            >
              👥 View PRO Users
            </a>
            <a
              href="/admin/api-usage"
              className="block w-full rounded-lg bg-gray-700 px-4 py-3 text-left text-white transition-colors hover:bg-gray-600"
            >
              📊 API Usage Stats
            </a>
            <a
              href="/admin/system/terminals"
              className="block w-full rounded-lg bg-gray-700 px-4 py-3 text-left text-white transition-colors hover:bg-gray-600"
            >
              🖥️ System Status &amp; Terminals
            </a>
          </CardContent>
        </Card>
      </div>

      {/* System Status & Infrastructure Operations */}
      <Card className="border-gray-700 bg-gray-800">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-white">
                System Status &amp; Infrastructure Operations
              </CardTitle>
              <CardDescription className="text-gray-400">
                Core services, Flask API terminals, scheduled cron jobs, and
                event outbox queue
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <a
              href="/admin/system/terminals"
              className="rounded-lg border border-gray-700 bg-gray-700/50 p-4 transition-colors hover:bg-gray-700"
            >
              <div className="mb-1 text-xl">🖥️</div>
              <div className="font-semibold text-white">
                Flask API Terminals
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Real-time terminal connections &amp; telemetry
              </p>
            </a>
            <a
              href="/admin/system/jobs"
              className="rounded-lg border border-gray-700 bg-gray-700/50 p-4 transition-colors hover:bg-gray-700"
            >
              <div className="mb-1 text-xl">⏱️</div>
              <div className="font-semibold text-white">Scheduled Jobs</div>
              <p className="mt-1 text-xs text-gray-400">
                Cron jobs, maintenance tasks &amp; schedules
              </p>
            </a>
            <a
              href="/admin/system/outbox"
              className="rounded-lg border border-gray-700 bg-gray-700/50 p-4 transition-colors hover:bg-gray-700"
            >
              <div className="mb-1 text-xl">📤</div>
              <div className="font-semibold text-white">Outbox Queue</div>
              <p className="mt-1 text-xs text-gray-400">
                Reliable event processing &amp; retry engine
              </p>
            </a>
            <a
              href="/admin/system/config-history"
              className="rounded-lg border border-gray-700 bg-gray-700/50 p-4 transition-colors hover:bg-gray-700"
            >
              <div className="mb-1 text-xl">📜</div>
              <div className="font-semibold text-white">Config History</div>
              <p className="mt-1 text-xs text-gray-400">
                Audit log of system &amp; commission configs
              </p>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Recent Fraud Alerts */}
      <Card className="border-gray-700 bg-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Recent Fraud Alerts</CardTitle>
          <CardDescription className="text-gray-400">
            Latest fraud alerts across all users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activityError ? (
            <p className="py-4 text-center text-red-400">{activityError}</p>
          ) : recentAlerts.length === 0 ? (
            <p className="py-4 text-center text-gray-400">
              No recent fraud alerts
            </p>
          ) : (
            <div className="space-y-3">
              {recentAlerts.map((alert) => (
                <a
                  key={alert.id}
                  href={`/admin/fraud-alerts/${alert.id}`}
                  className="flex items-center gap-4 rounded-lg bg-gray-700/50 p-3 transition-colors hover:bg-gray-700"
                >
                  <span className="text-xl">
                    {alert.severity === 'CRITICAL' && '🚨'}
                    {alert.severity === 'HIGH' && '⚠️'}
                    {alert.severity === 'MEDIUM' && '🔶'}
                    {alert.severity === 'LOW' && '🔔'}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-white">{alert.description}</p>
                    {alert.userEmail && (
                      <p className="text-xs text-gray-400">{alert.userEmail}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(alert.createdAt).toLocaleTimeString()}
                  </span>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
