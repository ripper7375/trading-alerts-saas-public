'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Loader2, ArrowUpRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { TIER_CONFIG, type Tier } from '@/types/tier';

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
  watchlists: number;
}

export default function SettingsPage(): React.ReactElement {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [usageData, setUsageData] = useState<UsageData>({
    alerts: 0,
    watchlists: 0,
  });

  const tier = (session?.user?.tier || 'FREE') as Tier;
  const tierConfig = TIER_CONFIG[tier] ?? TIER_CONFIG.FREE;

  useEffect(() => {
    // Simulate fetching usage data
    const timer = setTimeout(() => {
      setUsageData({
        alerts: 3, // Mock data - would come from API
        watchlists: 1,
      });
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
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
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
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
              <div className="text-gray-600 dark:text-gray-400 mt-1">
                {tier === 'FREE' ? 'Free Forever' : '$29/month'}
              </div>
            </div>

            {tier === 'FREE' && (
              <Link href="/pricing">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Upgrade to Pro
                  <ArrowUpRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            )}
          </div>

          {/* Current Usage with CORRECT limits */}
          <div className="mt-6 space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-700 dark:text-gray-300">Symbols</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {tier === 'FREE' ? '5 included' : '15 included'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-700 dark:text-gray-300">
                Timeframes
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {tier === 'FREE' ? '3 included' : '9 included'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-700 dark:text-gray-300">Alerts</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {usageData.alerts} / {tier === 'FREE' ? '5' : '20'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-700 dark:text-gray-300">
                Watchlists
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {usageData.watchlists} / {tier === 'FREE' ? '1' : '5'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-700 dark:text-gray-300">
                Indicators
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {tier === 'FREE' ? '2 basic' : '8 total'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-gray-700 dark:text-gray-300">
                API Rate Limit
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {tier === 'FREE' ? '60/hour' : '300/hour'}
              </span>
            </div>
          </div>

          {/* Upgrade Prompt for FREE users */}
          {tier === 'FREE' && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Unlock More with Pro
              </h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  15 symbols (vs 5 on Free)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  9 timeframes (vs 3 on Free)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  135 chart combinations (vs 15 on Free)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  20 alerts (vs 5 on Free)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>8 indicators
                  including Keltner Channels, Momentum Candles
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  5 watchlists with 50 items each
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

          {/* PRO tier info */}
          {tier === 'PRO' && (
            <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
              <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                You have Pro Access
              </h3>
              <p className="text-sm text-green-800 dark:text-green-200">
                Enjoy full access to all 15 symbols, 9 timeframes, 135 chart
                combinations, and 8 technical indicators.
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/settings/profile">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
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
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
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
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
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
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
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
      </div>
    </div>
  );
}
