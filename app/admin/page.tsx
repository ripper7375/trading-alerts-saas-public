'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="py-8 text-center">
        <p className="mb-4 text-red-500">{error || 'Failed to load metrics'}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          Dashboard
        </h1>
        <p className="mt-1 text-muted-foreground">
          System overview and key metrics
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
        {/* Total Users */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground">
              Total Users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground sm:text-4xl">
              {metrics.overview.totalUsers.toLocaleString()}
            </div>
            <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">
              +{metrics.growth.newUsersThisMonth} this month
            </p>
          </CardContent>
        </Card>

        {/* FREE Users */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-muted-foreground">
              FREE Users
              <Badge className="bg-muted text-xs text-muted-foreground hover:bg-muted">
                {metrics.overview.freePercentage.toFixed(1)}%
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground sm:text-4xl">
              {metrics.overview.freeUsers.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        {/* PRO Users */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-muted-foreground">
              PRO Users
              <Badge className="bg-primary text-xs text-primary-foreground hover:bg-primary">
                {metrics.overview.proPercentage.toFixed(1)}%
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary sm:text-4xl">
              {metrics.overview.proUsers.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        {/* MRR */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground">
              Monthly Recurring Revenue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 sm:text-4xl">
              {formatCurrency(metrics.revenue.mrr)}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              ARR: {formatCurrency(metrics.revenue.arr)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Business Intelligence Suite */}
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col items-start justify-between gap-4 px-6 sm:flex-row sm:items-center">
          <div>
            <CardTitle className="text-foreground">
              📈 Business Intelligence Dashboards
            </CardTitle>
            <CardDescription className="mt-1 text-muted-foreground">
              5 executive dashboards synthesizing all 25 business metrics --
              Revenue, Customer Funnel, Regional &amp; Tax, Affiliate Network,
              and a unified Executive Command Center.
            </CardDescription>
          </div>
          <Link
            href="/admin/dashboards/executive"
            className="hover:bg-primary/90 shrink-0 whitespace-nowrap rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors"
          >
            Business Intelligence →
          </Link>
        </CardContent>
      </Card>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Conversion Rate */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Conversion Rate</CardTitle>
            <CardDescription className="text-muted-foreground">
              FREE to PRO conversion
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary sm:text-5xl">
              {metrics.revenue.conversionRate.toFixed(1)}%
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {metrics.overview.proUsers} PRO out of{' '}
              {metrics.overview.totalUsers} total users
            </p>
          </CardContent>
        </Card>

        {/* Tier Distribution */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Tier Distribution</CardTitle>
            <CardDescription className="text-muted-foreground">
              User breakdown by tier
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* FREE Bar */}
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-muted-foreground">FREE</span>
                  <span className="text-foreground">
                    {metrics.overview.freePercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-muted">
                  <div
                    className="bg-muted-foreground/50 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${metrics.overview.freePercentage}%` }}
                  />
                </div>
              </div>

              {/* PRO Bar */}
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-muted-foreground">PRO</span>
                  <span className="text-foreground">
                    {metrics.overview.proPercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-muted">
                  <div
                    className="h-3 rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${metrics.overview.proPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Quick Actions</CardTitle>
            <CardDescription className="text-muted-foreground">
              Common admin tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/admin/errors"
              className="hover:bg-accent/70 block w-full rounded-lg bg-accent px-4 py-3 text-left text-foreground transition-colors"
            >
              🚨 View Latest Errors
            </Link>
            <Link
              href="/admin/users?tier=PRO"
              className="hover:bg-accent/70 block w-full rounded-lg bg-accent px-4 py-3 text-left text-foreground transition-colors"
            >
              👥 View PRO Users
            </Link>
            <Link
              href="/admin/api-usage"
              className="hover:bg-accent/70 block w-full rounded-lg bg-accent px-4 py-3 text-left text-foreground transition-colors"
            >
              📊 API Usage Stats
            </Link>
            <Link
              href="/admin/system/terminals"
              className="hover:bg-accent/70 block w-full rounded-lg bg-accent px-4 py-3 text-left text-foreground transition-colors"
            >
              🖥️ System Status &amp; Terminals
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* System Status & Infrastructure Operations */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-foreground">
                System Status &amp; Infrastructure Operations
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Core services, Flask API terminals, scheduled cron jobs, and
                event outbox queue
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/admin/system/terminals"
              className="bg-accent/50 rounded-lg border border-border p-4 transition-colors hover:bg-accent"
            >
              <div className="mb-1 text-xl">🖥️</div>
              <div className="font-semibold text-foreground">
                Flask API Terminals
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Real-time terminal connections &amp; telemetry
              </p>
            </Link>
            <Link
              href="/admin/system/jobs"
              className="bg-accent/50 rounded-lg border border-border p-4 transition-colors hover:bg-accent"
            >
              <div className="mb-1 text-xl">⏱️</div>
              <div className="font-semibold text-foreground">
                Scheduled Jobs
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Cron jobs, maintenance tasks &amp; schedules
              </p>
            </Link>
            <Link
              href="/admin/system/outbox"
              className="bg-accent/50 rounded-lg border border-border p-4 transition-colors hover:bg-accent"
            >
              <div className="mb-1 text-xl">📤</div>
              <div className="font-semibold text-foreground">Outbox Queue</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Reliable event processing &amp; retry engine
              </p>
            </Link>
            <Link
              href="/admin/system/config-history"
              className="bg-accent/50 rounded-lg border border-border p-4 transition-colors hover:bg-accent"
            >
              <div className="mb-1 text-xl">📜</div>
              <div className="font-semibold text-foreground">
                Config History
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Audit log of system &amp; commission configs
              </p>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Fraud Alerts */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Recent Fraud Alerts</CardTitle>
          <CardDescription className="text-muted-foreground">
            Latest fraud alerts across all users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activityError ? (
            <p className="py-4 text-center text-red-500">{activityError}</p>
          ) : recentAlerts.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">
              No recent fraud alerts
            </p>
          ) : (
            <div className="space-y-3">
              {recentAlerts.map((alert) => (
                <Link
                  key={alert.id}
                  href={`/admin/fraud-alerts/${alert.id}`}
                  className="bg-accent/50 flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-accent"
                >
                  <span className="text-xl">
                    {alert.severity === 'CRITICAL' && '🚨'}
                    {alert.severity === 'HIGH' && '⚠️'}
                    {alert.severity === 'MEDIUM' && '🔶'}
                    {alert.severity === 'LOW' && '🔔'}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-foreground">
                      {alert.description}
                    </p>
                    {alert.userEmail && (
                      <p className="text-xs text-muted-foreground">
                        {alert.userEmail}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(alert.createdAt).toLocaleTimeString()}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
