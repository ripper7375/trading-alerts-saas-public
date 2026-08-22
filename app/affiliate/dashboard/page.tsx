/**
 * Affiliate Dashboard Page
 *
 * Main dashboard showing affiliate statistics, recent activity,
 * and quick actions.
 *
 * @module app/affiliate/dashboard/page
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

import { StatsCard } from '@/components/affiliate/stats-card';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE DEFINITIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface DashboardStats {
  activeCodes: number;
  usedCodes: number;
  expiredCodes: number;
  totalEarnings: number;
  pendingBalance: number;
  paidBalance: number;
  conversionRate: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Affiliate Dashboard Page
 * Shows overview statistics and quick actions
 */
export default function AffiliateDashboardPage(): React.ReactElement {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch dynamic config from SystemConfig
  const {
    discountPercent,
    commissionPercent,
    regularPrice,
    calculateCommissionAmount,
  } = useAffiliateConfig();

  useEffect(() => {
    const fetchStats = async (): Promise<void> => {
      try {
        const response = await fetch('/api/affiliate/dashboard/stats');

        if (!response.ok) {
          throw new Error('Failed to load dashboard stats');
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-amber-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-600 dark:text-red-400">
        <p>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-sm underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to your affiliate dashboard
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Active Codes"
          value={String(stats?.activeCodes || 0)}
          icon={
            <svg
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
          }
        />

        <StatsCard
          title="Used Codes"
          value={String(stats?.usedCodes || 0)}
          icon={
            <svg
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />

        <StatsCard
          title="Total Earnings"
          value={`$${(stats?.totalEarnings || 0).toFixed(2)}`}
          icon={
            <svg
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />

        <StatsCard
          title="Pending Balance"
          value={`$${(stats?.pendingBalance || 0).toFixed(2)}`}
          icon={
            <svg
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <StatsCard
          title="Conversion Rate"
          value={`${(stats?.conversionRate || 0).toFixed(1)}%`}
        />
        <StatsCard
          title="Paid Balance"
          value={`$${(stats?.paidBalance || 0).toFixed(2)}`}
        />
        <StatsCard
          title="Expired Codes"
          value={String(stats?.expiredCodes || 0)}
        />
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link
            href="/affiliate/dashboard/codes"
            className="flex items-center rounded-lg border border-border bg-background p-4 transition-colors hover:bg-accent"
          >
            <div className="mr-4 rounded-lg bg-amber-500/15 p-3">
              <svg
                className="h-6 w-6 text-amber-600 dark:text-amber-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </div>
            <div>
              <p className="font-medium text-foreground">View My Codes</p>
              <p className="text-sm text-muted-foreground">
                Manage your affiliate codes
              </p>
            </div>
          </Link>

          <Link
            href="/affiliate/dashboard/commissions"
            className="flex items-center rounded-lg border border-border bg-background p-4 transition-colors hover:bg-accent"
          >
            <div className="mr-4 rounded-lg bg-green-500/15 p-3">
              <svg
                className="h-6 w-6 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <div>
              <p className="font-medium text-foreground">View Commissions</p>
              <p className="text-sm text-muted-foreground">
                Track your earnings history
              </p>
            </div>
          </Link>

          <Link
            href="/affiliate/dashboard/profile"
            className="flex items-center rounded-lg border border-border bg-background p-4 transition-colors hover:bg-accent"
          >
            <div className="mr-4 rounded-lg bg-blue-500/15 p-3">
              <svg
                className="h-6 w-6 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <div>
              <p className="font-medium text-foreground">Edit Profile</p>
              <p className="text-sm text-muted-foreground">
                Update your affiliate profile
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* Info Box */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-6">
        <h3 className="mb-2 font-semibold text-amber-800 dark:text-amber-300">
          How the Affiliate Program Works
        </h3>
        <ul className="space-y-1 text-sm text-amber-800/90 dark:text-amber-200/90">
          <li>- Share your unique codes with potential customers</li>
          <li>- They get {discountPercent}% off their subscription</li>
          <li>
            - You earn {commissionPercent}% commission on each successful
            referral (${calculateCommissionAmount(regularPrice).toFixed(2)})
          </li>
          <li>- Payouts are processed monthly for balances over $50</li>
        </ul>
      </div>
    </div>
  );
}
