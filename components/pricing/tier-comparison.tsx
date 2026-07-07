'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

/**
 * TierComparison Component — V8 single-symbol architecture
 *
 * FREE and PRO share identical data access (XAUUSD, M5/M15, all columns).
 * PRO adds: 100 alerts, drawing-engine line alerts, multi-timeframe
 * visualization, notifications, higher rate limit, export, support.
 *
 * Pricing is fetched dynamically from SystemConfig via useAffiliateConfig hook.
 */
export function TierComparison(): React.ReactElement {
  // Get dynamic PRO price from SystemConfig
  const { regularPrice } = useAffiliateConfig();
  const yearlyPrice = Math.round(regularPrice * 10); // 10 months for yearly (save 2 months)
  const yearlySavings = regularPrice * 12 - yearlyPrice;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 dark:bg-gray-800">
            <th className="p-4 text-left font-semibold text-gray-900 dark:text-white">
              Feature
            </th>
            <th className="p-4 text-center font-semibold text-gray-900 dark:text-white">
              Free
            </th>
            <th className="bg-blue-50 p-4 text-center font-semibold text-gray-900 dark:bg-blue-900/30 dark:text-white">
              Pro
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {/* Symbol */}
          <tr className="border-b dark:border-gray-700">
            <td className="p-4 font-medium text-gray-900 dark:text-white">
              Trading Symbol
            </td>
            <td className="p-4 text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                XAUUSD
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Gold — our specialist focus
              </div>
            </td>
            <td className="bg-blue-50 p-4 text-center dark:bg-blue-900/30">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                XAUUSD
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Gold — our specialist focus
              </div>
            </td>
          </tr>

          {/* Timeframes */}
          <tr className="border-b dark:border-gray-700">
            <td className="p-4 font-medium text-gray-900 dark:text-white">
              Timeframes
            </td>
            <td className="p-4 text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                M5, M15
              </div>
            </td>
            <td className="bg-blue-50 p-4 text-center dark:bg-blue-900/30">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                M5, M15
              </div>
            </td>
          </tr>

          {/* Market data */}
          <tr className="border-b dark:border-gray-700">
            <td className="p-4 font-medium text-gray-900 dark:text-white">
              Market Data & Indicators
            </td>
            <td className="p-4 text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                Full access
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Every indicator column — same data as Pro
              </div>
            </td>
            <td className="bg-blue-50 p-4 text-center dark:bg-blue-900/30">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                Full access
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Every indicator column
              </div>
            </td>
          </tr>

          {/* Alert limits */}
          <tr className="border-b dark:border-gray-700">
            <td className="p-4 font-medium text-gray-900 dark:text-white">
              Price Alerts
            </td>
            <td className="p-4 text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                —
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                PRO feature
              </div>
            </td>
            <td className="bg-blue-50 p-4 text-center dark:bg-blue-900/30">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                100
              </div>
            </td>
          </tr>

          {/* Drawing line alerts */}
          <tr className="border-b dark:border-gray-700">
            <td className="p-4 font-medium text-gray-900 dark:text-white">
              Drawing Engine Line Alerts
            </td>
            <td className="p-4 text-center text-red-500">
              <span className="text-xl">✗</span>
            </td>
            <td className="bg-blue-50 p-4 text-center text-green-600 dark:bg-blue-900/30">
              <span className="text-xl">✓</span>
            </td>
          </tr>

          {/* Multi-timeframe visualization */}
          <tr className="border-b dark:border-gray-700">
            <td className="p-4 font-medium text-gray-900 dark:text-white">
              Multi-Timeframe Visualization
            </td>
            <td className="p-4 text-center text-red-500">
              <span className="text-xl">✗</span>
            </td>
            <td className="bg-blue-50 p-4 text-center text-green-600 dark:bg-blue-900/30">
              <span className="text-xl">✓</span>
            </td>
          </tr>

          {/* Notifications */}
          <tr className="border-b dark:border-gray-700">
            <td className="p-4 font-medium text-gray-900 dark:text-white">
              Alert Notifications (Email, Push, SMS)
            </td>
            <td className="p-4 text-center text-red-500">
              <span className="text-xl">✗</span>
            </td>
            <td className="bg-blue-50 p-4 text-center text-green-600 dark:bg-blue-900/30">
              <span className="text-xl">✓</span>
            </td>
          </tr>

          {/* Rate limits */}
          <tr className="border-b dark:border-gray-700">
            <td className="p-4 font-medium text-gray-900 dark:text-white">
              API Rate Limit
            </td>
            <td className="p-4 text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                60/hour
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                1 per minute avg
              </div>
            </td>
            <td className="bg-blue-50 p-4 text-center dark:bg-blue-900/30">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                300/hour
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                5 per minute avg
              </div>
            </td>
          </tr>

          {/* Data Export */}
          <tr className="border-b dark:border-gray-700">
            <td className="p-4 font-medium text-gray-900 dark:text-white">
              Data Export
            </td>
            <td className="p-4 text-center text-red-500">
              <span className="text-xl">✗</span>
            </td>
            <td className="bg-blue-50 p-4 text-center text-green-600 dark:bg-blue-900/30">
              <span className="text-xl">✓</span>
            </td>
          </tr>

          {/* Priority Support */}
          <tr className="border-b dark:border-gray-700">
            <td className="p-4 font-medium text-gray-900 dark:text-white">
              Priority Support
            </td>
            <td className="p-4 text-center text-red-500">
              <span className="text-xl">✗</span>
            </td>
            <td className="bg-blue-50 p-4 text-center text-green-600 dark:bg-blue-900/30">
              <span className="text-xl">✓</span>
            </td>
          </tr>

          {/* Pricing */}
          <tr className="bg-gray-50 dark:bg-gray-800/50">
            <td className="p-4 font-bold text-gray-900 dark:text-white">
              Price
            </td>
            <td className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                $0
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Free Forever
              </div>
            </td>
            <td className="bg-blue-50 p-4 text-center dark:bg-blue-900/30">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                ${regularPrice}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                per month
              </div>
              <div className="mt-1 text-sm font-medium text-blue-600 dark:text-blue-400">
                or ${yearlyPrice}/year (save ${yearlySavings})
              </div>
              <div className="mt-1 text-sm font-medium text-green-600 dark:text-green-400">
                7-day free trial
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* CTA Buttons */}
      <div className="mt-6 flex flex-col justify-center gap-4 sm:flex-row">
        <Link href="/register">
          <Button variant="outline" className="w-full sm:w-auto">
            Get Started Free
          </Button>
        </Link>
        <Link href="/pricing">
          <Button className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto">
            Start 7-Day Free Trial
          </Button>
        </Link>
      </div>
    </div>
  );
}
