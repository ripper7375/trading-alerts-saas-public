'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Loader2,
  ArrowUpRight,
  UserCircle,
  ShieldCheck,
  HelpCircle,
  Languages,
  FileText,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';
import { type Tier } from '@/types/tier';

/**
 * Settings Page
 *
 * Main settings landing page that displays:
 * - Current tier/plan information
 * - Usage statistics with CORRECT tier limits
 * - Upgrade prompt for FREE users
 */

interface UsageData {
  alerts: number;
}

export default function SettingsPage(): React.ReactElement {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [usageData, setUsageData] = useState<UsageData>({
    alerts: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const tier = (session?.user?.tier || 'FREE') as Tier;
  const { regularPrice } = useAffiliateConfig();

  useEffect(() => {
    let cancelled = false;

    async function fetchAlertCount(): Promise<void> {
      try {
        const response = await fetch('/api/alerts');
        if (!response.ok) {
          throw new Error('Failed to fetch alert count');
        }
        const data = await response.json();
        if (!cancelled) {
          setUsageData({
            alerts: Array.isArray(data.alerts) ? data.alerts.length : 0,
          });
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to fetch alert count'
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void fetchAlertCount();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        Your Plan
      </h2>

      {/* Current Plan Display */}
      <Card
        className={`${
          tier === 'PRO'
            ? 'border-2 border-blue-600 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20'
            : 'border-2 border-gray-200 dark:border-gray-700'
        }`}
      >
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <Badge
                  className={
                    tier === 'PRO'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                  }
                >
                  {tier} TIER
                </Badge>
                <Badge className="bg-green-100 text-green-800">Active</Badge>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {tier} Plan
              </div>
              <div className="mt-1 text-gray-600 dark:text-gray-400">
                {tier === 'FREE' ? 'Free Forever' : `$${regularPrice}/month`}
              </div>
            </div>

            {tier === 'FREE' && (
              <Link href="/pricing">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Upgrade to Pro
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>

          {/* Current Usage with CORRECT limits */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 py-2 dark:border-gray-700">
              <span className="text-gray-700 dark:text-gray-300">Symbol</span>
              <span className="font-medium text-gray-900 dark:text-white">
                XAUUSD (Gold)
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-gray-100 py-2 dark:border-gray-700">
              <span className="text-gray-700 dark:text-gray-300">
                Timeframes
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                M5, M15
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-gray-100 py-2 dark:border-gray-700">
              <span className="text-gray-700 dark:text-gray-300">Alerts</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {tier === 'FREE'
                  ? 'PRO feature'
                  : error
                    ? 'Unable to load'
                    : `${usageData.alerts} / 100`}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-gray-100 py-2 dark:border-gray-700">
              <span className="text-gray-700 dark:text-gray-300">
                Indicators
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                All included
              </span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-gray-700 dark:text-gray-300">
                API Rate Limit
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {tier === 'FREE' ? '60/hour' : '300/hour'}
              </span>
            </div>
          </div>

          {/* Upgrade Prompt for FREE users (non-affiliate) */}
          {tier === 'FREE' &&
            (session?.user as { role?: string })?.role !== 'AFFILIATE' && (
              <div className="mt-6 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/30">
                <h3 className="mb-2 font-semibold text-blue-900 dark:text-blue-100">
                  Unlock More with Pro
                </h3>
                <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    100 price alerts on XAUUSD M5/M15
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    Drawing engine line alerts
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    Multi-timeframe visualization
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    Full alert &amp; notification system
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    5x API rate limit
                  </li>
                </ul>
                <Link href="/pricing">
                  <Button className="mt-4 w-full bg-blue-600 hover:bg-blue-700">
                    Start 7-Day Free Trial
                  </Button>
                </Link>
              </div>
            )}

          {/* Affiliate Partner Hub Card */}
          {(session?.user as { role?: string })?.role === 'AFFILIATE' && (
            <div className="mt-6 rounded-lg bg-indigo-50 p-4 dark:bg-indigo-900/30">
              <h3 className="mb-2 font-semibold text-indigo-900 dark:text-indigo-100">
                Affiliate Partner Hub
              </h3>
              <p className="text-sm text-indigo-800 dark:text-indigo-200">
                You are enrolled in the Affiliate Partner Program. Distribute
                promo discount codes and track commission disbursements.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  asChild
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Link href="/affiliate/dashboard">Partner Dashboard</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/affiliate/settings/payout">Payout Settings</Link>
                </Button>
              </div>
            </div>
          )}

          {/* PRO tier info */}
          {tier === 'PRO' && (
            <div className="mt-6 rounded-lg bg-green-50 p-4 dark:bg-green-900/30">
              <h3 className="mb-2 font-semibold text-green-900 dark:text-green-100">
                You have Pro Access
              </h3>
              <p className="text-sm text-green-800 dark:text-green-200">
                Enjoy 100 price alerts, drawing engine line alerts, and
                multi-timeframe visualization on XAUUSD M5/M15.
              </p>
              <Link href="/settings/billing">
                <Button
                  variant="outline"
                  className="mt-4 border-green-600 text-green-700 hover:bg-green-50"
                >
                  Manage Subscription
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/settings/profile">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Profile Settings
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Update your name, email, and profile picture
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/billing">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Billing & Invoices
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Manage payment methods and view invoices
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/appearance">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Appearance
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Customize theme and display preferences
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/privacy">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Privacy & Security
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Manage privacy settings and security options
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/account">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-start gap-3 p-4">
              <UserCircle className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Account Settings
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Manage your account details and sign-in methods
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/security">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-start gap-3 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Security Settings
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Two-factor authentication and active sessions
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/help">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-start gap-3 p-4">
              <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Help & Support
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Get help, contact support, or browse FAQs
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/language">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-start gap-3 p-4">
              <Languages className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Language & Region
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Choose your preferred display language
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/terms">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-start gap-3 p-4">
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Terms of Service
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Review the terms governing your use of this platform
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
