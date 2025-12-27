'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  CreditCard,
  Download,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowUpRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { TIER_CONFIG, type Tier } from '@/types/tier';

/**
 * Billing Settings Page
 *
 * Features:
 * - Current subscription card (FREE/PRO)
 * - Upgrade/Cancel buttons
 * - Payment method display
 * - Invoice history table
 * - Usage statistics (alerts, watchlist, API calls)
 * - Affiliate discount display
 */

interface InvoiceRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  hasDiscount: boolean;
}

interface UsageStats {
  alerts: { current: number; max: number };
  watchlist: { current: number; max: number };
  apiCalls: { current: number; max: number };
}

// Mock invoice data
const mockInvoices: InvoiceRecord[] = [
  {
    id: 'INV-001',
    date: 'Dec 15, 2024',
    description: 'Pro Plan - Monthly',
    amount: 29.0,
    status: 'paid',
    hasDiscount: false,
  },
  {
    id: 'INV-002',
    date: 'Nov 15, 2024',
    description: 'Pro Plan - Monthly',
    amount: 29.0,
    status: 'paid',
    hasDiscount: false,
  },
  {
    id: 'INV-003',
    date: 'Oct 15, 2024',
    description: 'Pro Plan - Monthly',
    amount: 29.0,
    status: 'paid',
    hasDiscount: false,
  },
];

export default function BillingSettingsPage(): React.ReactElement {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [invoices] = useState<InvoiceRecord[]>(mockInvoices);

  const userTier = (session?.user?.tier || 'FREE') as Tier;
  const tierConfig = TIER_CONFIG[userTier] ?? TIER_CONFIG.FREE;

  // Mock usage data - in real app, fetch from API
  const [usageStats] = useState<UsageStats>({
    alerts: { current: 3, max: tierConfig.maxAlerts },
    watchlist: { current: 12, max: tierConfig.maxWatchlists * 10 },
    apiCalls: { current: 42, max: 60 },
  });

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setIsLoading(false), 500);
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
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Billing & Subscription
      </h2>

      {/* Current Plan Card */}
      <Card
        className={`mb-8 ${
          userTier === 'PRO'
            ? 'border-2 border-blue-600 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20'
            : 'border-2 border-gray-200 dark:border-gray-700'
        }`}
      >
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge
              className={
                userTier === 'PRO'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
              }
            >
              {userTier === 'PRO' ? 'PRO TIER' : 'FREE TIER'}
            </Badge>
            <Badge className="bg-green-100 text-green-800">Active</Badge>
          </div>

          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {userTier === 'PRO' ? 'Pro Plan' : 'Free Plan'}
          </h3>

          {/* Pricing */}
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-4xl font-bold text-gray-900 dark:text-white">
              ${userTier === 'PRO' ? '29.00' : '0'}
            </span>
            <span className="text-gray-600 dark:text-gray-400">/month</span>
          </div>

          {/* Features */}
          <ul className="space-y-2 mb-6">
            <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <CheckCircle className="w-4 h-4 text-green-600" />
              {tierConfig.allowedSymbols.length} Symbols
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <CheckCircle className="w-4 h-4 text-green-600" />
              {tierConfig.allowedTimeframes.length} Timeframes
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <CheckCircle className="w-4 h-4 text-green-600" />
              {tierConfig.maxAlerts} Alerts
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <CheckCircle className="w-4 h-4 text-green-600" />
              {tierConfig.maxWatchlists * 10} Watchlist Items
            </li>
          </ul>

          {/* Action Buttons */}
          {userTier === 'FREE' ? (
            <Link href="/pricing">
              <Button className="bg-blue-600 hover:bg-blue-700">
                Upgrade to PRO
                <ArrowUpRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          ) : (
            <div className="flex gap-3">
              <Button variant="outline">Manage Subscription</Button>
              <Button
                variant="ghost"
                className="text-red-600 hover:text-red-700"
              >
                Cancel Plan
              </Button>
            </div>
          )}

          {userTier === 'PRO' && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
              Next billing date: January 15, 2025
            </p>
          )}
        </CardContent>
      </Card>

      {/* Payment Method */}
      {userTier === 'PRO' && (
        <>
          <section className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Payment Method
            </h3>
            <Card>
              <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-8 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      Visa ending in ****4242
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Expires: 12/2026
                    </p>
                  </div>
                </div>
                <Button variant="outline">Update Card</Button>
              </CardContent>
            </Card>
          </section>

          <Separator className="my-8" />
        </>
      )}

      {/* Usage Statistics */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Usage This Month
        </h3>
        <div className="space-y-4">
          {/* Alerts */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Active Alerts
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {usageStats.alerts.current}/{usageStats.alerts.max}
              </span>
            </div>
            <Progress
              value={(usageStats.alerts.current / usageStats.alerts.max) * 100}
              className="h-2"
            />
          </div>

          {/* Watchlist */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Watchlist Items
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {usageStats.watchlist.current}/{usageStats.watchlist.max}
              </span>
            </div>
            <Progress
              value={
                (usageStats.watchlist.current / usageStats.watchlist.max) * 100
              }
              className="h-2"
            />
          </div>

          {/* API Calls */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                API Calls (this hour)
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {usageStats.apiCalls.current}/{usageStats.apiCalls.max}
              </span>
            </div>
            <Progress
              value={
                (usageStats.apiCalls.current / usageStats.apiCalls.max) * 100
              }
              className="h-2"
            />
          </div>
        </div>
      </section>

      <Separator className="my-8" />

      {/* Invoice History */}
      {userTier === 'PRO' && (
        <section>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Invoice History
          </h3>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                        Description
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400">
                        Status
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400">
                        Invoice
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {invoices.map((invoice) => (
                      <tr
                        key={invoice.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {invoice.date}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {invoice.description}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 dark:text-white">
                          ${invoice.amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            className={
                              invoice.status === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : invoice.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                            }
                          >
                            {invoice.status === 'paid' && (
                              <CheckCircle className="w-3 h-3 mr-1" />
                            )}
                            {invoice.status === 'failed' && (
                              <AlertCircle className="w-3 h-3 mr-1" />
                            )}
                            {invoice.status.charAt(0).toUpperCase() +
                              invoice.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button variant="ghost" size="sm">
                            <Download className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Upgrade Prompt for FREE users */}
      {userTier === 'FREE' && (
        <Card className="bg-gradient-to-r from-blue-600 to-purple-600 border-0 text-white">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="text-4xl">🚀</div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-xl font-bold mb-2">Unlock More with PRO</h3>
                <p className="text-white/90 mb-4">
                  Get 15 symbols, 9 timeframes, 20 alerts, and priority support
                  for just $29/month.
                </p>
                <Link href="/pricing">
                  <Button className="bg-white text-blue-600 hover:bg-white/90 font-semibold">
                    View Pricing Plans
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
