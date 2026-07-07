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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';
import { TIER_CONFIG, type Tier } from '@/types/tier';

/**
 * Billing Settings Page
 *
 * Features:
 * - Current subscription card (FREE/PRO)
 * - Upgrade/Cancel buttons
 * - Payment method display
 * - Invoice history table
 * - Usage statistics (alerts, API calls)
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
  const [cancellationReason, setCancellationReason] = useState('');

  const userTier = (session?.user?.tier || 'FREE') as Tier;
  const tierConfig = TIER_CONFIG[userTier] ?? TIER_CONFIG.FREE;
  const { regularPrice } = useAffiliateConfig();

  // Mock usage data - in real app, fetch from API
  const [usageStats] = useState<UsageStats>({
    alerts: { current: 3, max: tierConfig.maxAlerts },
    apiCalls: { current: 42, max: 60 },
  });

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
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
          <div className="mb-4 flex flex-wrap gap-2">
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

          <h3 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
            {userTier === 'PRO' ? 'Pro Plan' : 'Free Plan'}
          </h3>

          {/* Pricing */}
          <div className="mb-4 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-gray-900 dark:text-white">
              ${userTier === 'PRO' ? regularPrice.toFixed(2) : '0'}
            </span>
            <span className="text-gray-600 dark:text-gray-400">/month</span>
          </div>

          {/* Features */}
          <ul className="mb-6 space-y-2">
            <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <CheckCircle className="h-4 w-4 text-green-600" />
              XAUUSD (Gold) — M5 &amp; M15
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Full market data &amp; indicators
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <CheckCircle className="h-4 w-4 text-green-600" />
              {userTier === 'PRO'
                ? `${tierConfig.maxAlerts} Price Alerts`
                : 'No Alerts (PRO feature)'}
            </li>
            {userTier === 'PRO' && (
              <>
                <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Drawing Engine Line Alerts
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Multi-Timeframe Visualization
                </li>
              </>
            )}
          </ul>

          {/* Action Buttons */}
          {userTier === 'FREE' ? (
            <Link href="/pricing">
              <Button className="bg-blue-600 hover:bg-blue-700">
                Upgrade to PRO
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <div className="flex gap-3">
              <Button variant="outline">Manage Subscription</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                  >
                    Cancel Plan
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to cancel your PRO subscription? You
                      will lose access to premium features at the end of your
                      billing period.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="py-4">
                    <label
                      htmlFor="cancellation-reason"
                      className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Reason for cancellation (optional)
                    </label>
                    <select
                      id="cancellation-reason"
                      value={cancellationReason}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        setCancellationReason(e.target.value)
                      }
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                    >
                      <option value="">Select a reason...</option>
                      <option value="too_expensive">Too expensive</option>
                      <option value="not_using">Not using enough</option>
                      <option value="missing_features">Missing features</option>
                      <option value="switching">Switching to competitor</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                    <AlertDialogAction className="bg-red-600 hover:bg-red-700">
                      Confirm Cancellation
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {userTier === 'PRO' && (
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              Next billing date: January 15, 2025
            </p>
          )}
        </CardContent>
      </Card>

      {/* Payment Method */}
      {userTier === 'PRO' && (
        <>
          <section className="mb-8">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
              <CreditCard className="h-5 w-5" />
              Payment Method
            </h3>
            <Card>
              <CardContent className="flex flex-col items-start justify-between gap-4 p-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-4">
                  <div className="flex h-8 w-12 items-center justify-center rounded bg-gray-100 dark:bg-gray-700">
                    <CreditCard className="h-6 w-6 text-gray-600 dark:text-gray-400" />
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
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Usage This Month
        </h3>
        <div className="space-y-4">
          {/* Alerts */}
          <div>
            <div className="mb-2 flex justify-between">
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

          {/* API Calls */}
          <div>
            <div className="mb-2 flex justify-between">
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
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Invoice History
          </h3>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
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
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
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
                              <CheckCircle className="mr-1 h-3 w-3" />
                            )}
                            {invoice.status === 'failed' && (
                              <AlertCircle className="mr-1 h-3 w-3" />
                            )}
                            {invoice.status.charAt(0).toUpperCase() +
                              invoice.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
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
        <Card className="border-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <div className="text-4xl">🚀</div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="mb-2 text-xl font-bold">Unlock More with PRO</h3>
                <p className="mb-4 text-white/90">
                  Get 100 price alerts, drawing engine line alerts,
                  multi-timeframe visualization, and priority support for just
                  ${regularPrice}/month.
                </p>
                <Link href="/pricing">
                  <Button className="bg-white font-semibold text-blue-600 hover:bg-white/90">
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
