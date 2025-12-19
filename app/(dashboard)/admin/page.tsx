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

interface RecentActivity {
  id: string;
  type: 'signup' | 'upgrade' | 'downgrade' | 'alert_created' | 'error';
  description: string;
  timestamp: string;
  userEmail?: string;
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
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
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

        // Generate mock recent activity for now
        // In production, this would come from a separate endpoint
        setRecentActivity([
          {
            id: '1',
            type: 'signup',
            description: 'New user registered',
            timestamp: new Date().toISOString(),
            userEmail: 'user@example.com',
          },
          {
            id: '2',
            type: 'upgrade',
            description: 'User upgraded to PRO',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            userEmail: 'pro@example.com',
          },
          {
            id: '3',
            type: 'alert_created',
            description: 'New alert created',
            timestamp: new Date(Date.now() - 7200000).toISOString(),
          },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    void fetchMetrics();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400 mb-4">{error || 'Failed to load metrics'}</p>
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
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">System overview and key metrics</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Users */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400">
              Total Users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl sm:text-4xl font-bold text-white">
              {metrics.overview.totalUsers.toLocaleString()}
            </div>
            <p className="text-green-400 text-sm mt-1">
              +{metrics.growth.newUsersThisMonth} this month
            </p>
          </CardContent>
        </Card>

        {/* FREE Users */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400 flex items-center gap-2">
              FREE Users
              <Badge className="bg-gray-600 hover:bg-gray-600 text-white text-xs">
                {metrics.overview.freePercentage.toFixed(1)}%
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl sm:text-4xl font-bold text-white">
              {metrics.overview.freeUsers.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        {/* PRO Users */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400 flex items-center gap-2">
              PRO Users
              <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-xs">
                {metrics.overview.proPercentage.toFixed(1)}%
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl sm:text-4xl font-bold text-blue-400">
              {metrics.overview.proUsers.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        {/* MRR */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400">
              Monthly Recurring Revenue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl sm:text-4xl font-bold text-green-400">
              {formatCurrency(metrics.revenue.mrr)}
            </div>
            <p className="text-gray-400 text-sm mt-1">
              ARR: {formatCurrency(metrics.revenue.arr)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Conversion Rate */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Conversion Rate</CardTitle>
            <CardDescription className="text-gray-400">
              FREE to PRO conversion
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl sm:text-5xl font-bold text-blue-400">
              {metrics.revenue.conversionRate.toFixed(1)}%
            </div>
            <p className="text-gray-400 text-sm mt-2">
              {metrics.overview.proUsers} PRO out of{' '}
              {metrics.overview.totalUsers} total users
            </p>
          </CardContent>
        </Card>

        {/* Tier Distribution */}
        <Card className="bg-gray-800 border-gray-700">
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
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">FREE</span>
                  <span className="text-white">
                    {metrics.overview.freePercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-gray-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${metrics.overview.freePercentage}%` }}
                  />
                </div>
              </div>

              {/* PRO Bar */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">PRO</span>
                  <span className="text-white">
                    {metrics.overview.proPercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${metrics.overview.proPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Quick Actions</CardTitle>
            <CardDescription className="text-gray-400">
              Common admin tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="/admin/errors"
              className="block w-full text-left px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
            >
              🚨 View Latest Errors
            </a>
            <a
              href="/admin/users?tier=PRO"
              className="block w-full text-left px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
            >
              👥 View PRO Users
            </a>
            <a
              href="/admin/api-usage"
              className="block w-full text-left px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
            >
              📊 API Usage Stats
            </a>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Recent Activity</CardTitle>
          <CardDescription className="text-gray-400">
            Latest system events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-4 p-3 bg-gray-700/50 rounded-lg"
                >
                  <span className="text-xl">
                    {activity.type === 'signup' && '👤'}
                    {activity.type === 'upgrade' && '⬆️'}
                    {activity.type === 'downgrade' && '⬇️'}
                    {activity.type === 'alert_created' && '🔔'}
                    {activity.type === 'error' && '🚨'}
                  </span>
                  <div className="flex-1">
                    <p className="text-white text-sm">{activity.description}</p>
                    {activity.userEmail && (
                      <p className="text-gray-400 text-xs">
                        {activity.userEmail}
                      </p>
                    )}
                  </div>
                  <span className="text-gray-500 text-xs">
                    {new Date(activity.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
