'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';

/**
 * TierComparison Component
 *
 * Displays a comparison table of FREE vs PRO tier features.
 * Uses correct values from tier configuration:
 *
 * FREE: 5 symbols, 3 timeframes, 15 combinations
 * PRO: 15 symbols, 9 timeframes, 135 combinations
 */
export function TierComparison(): React.ReactElement {
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
            <th className="p-4 text-center bg-blue-50 dark:bg-blue-900/30 font-semibold text-gray-900 dark:text-white">
              Pro
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {/* Symbol counts */}
          <tr className="border-b dark:border-gray-700">
            <td className="p-4 font-medium text-gray-900 dark:text-white">
              Trading Symbols
            </td>
            <td className="p-4 text-center">
              <div className="font-bold text-lg text-gray-900 dark:text-white">
                5
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                BTCUSD, EURUSD, USDJPY, US30, XAUUSD
              </div>
            </td>
            <td className="p-4 text-center bg-blue-50 dark:bg-blue-900/30">
              <div className="font-bold text-lg text-blue-600 dark:text-blue-400">
                15
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                All forex majors & crosses, crypto (BTC, ETH), indices (US30,
                NDX100), commodities (Gold, Silver)
              </div>
            </td>
          </tr>

          {/* Timeframe counts */}
          <tr className="border-b dark:border-gray-700">
            <td className="p-4 font-medium text-gray-900 dark:text-white">
              Timeframes
            </td>
            <td className="p-4 text-center">
              <div className="font-bold text-lg text-gray-900 dark:text-white">
                3
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                H1, H4, D1
              </div>
            </td>
            <td className="p-4 text-center bg-blue-50 dark:bg-blue-900/30">
              <div className="font-bold text-lg text-blue-600 dark:text-blue-400">
                9
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                M5, M15, M30, H1, H2, H4, H8, H12, D1
              </div>
            </td>
          </tr>

          {/* Chart combinations */}
          <tr className="border-b dark:border-gray-700">
            <td className="p-4 font-medium text-gray-900 dark:text-white">
              Chart Combinations
            </td>
            <td className="p-4 text-center">
              <div className="font-bold text-lg text-gray-900 dark:text-white">
                15
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                5 symbols × 3 timeframes
              </div>
            </td>
            <td className="p-4 text-center bg-blue-50 dark:bg-blue-900/30">
              <div className="font-bold text-lg text-blue-600 dark:text-blue-400">
                135
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                15 symbols × 9 timeframes
              </div>
            </td>
          </tr>

          {/* Alert limits */}
          <tr className="border-b dark:border-gray-700">
            <td className="p-4 font-medium text-gray-900 dark:text-white">
              Trading Alerts
            </td>
            <td className="p-4 text-center">
              <div className="font-bold text-lg text-gray-900 dark:text-white">
                5
              </div>
            </td>
            <td className="p-4 text-center bg-blue-50 dark:bg-blue-900/30">
              <div className="font-bold text-lg text-blue-600 dark:text-blue-400">
                20
              </div>
            </td>
          </tr>

          {/* Watchlist limits */}
          <tr className="border-b dark:border-gray-700">
            <td className="p-4 font-medium text-gray-900 dark:text-white">
              Watchlists
            </td>
            <td className="p-4 text-center">
              <div className="font-bold text-lg text-gray-900 dark:text-white">
                1
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Max 5 items
              </div>
            </td>
            <td className="p-4 text-center bg-blue-50 dark:bg-blue-900/30">
              <div className="font-bold text-lg text-blue-600 dark:text-blue-400">
                5
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Max 50 items each
              </div>
            </td>
          </tr>

          {/* Indicator counts */}
          <tr className="border-b dark:border-gray-700">
            <td className="p-4 font-medium text-gray-900 dark:text-white">
              Technical Indicators
            </td>
            <td className="p-4 text-center">
              <div className="font-bold text-lg text-gray-900 dark:text-white">
                2
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Fractals, Trendlines
              </div>
            </td>
            <td className="p-4 text-center bg-blue-50 dark:bg-blue-900/30">
              <div className="font-bold text-lg text-blue-600 dark:text-blue-400">
                8
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                + Momentum Candles, Keltner Channels, TEMA, HRMA, SMMA, ZigZag
              </div>
            </td>
          </tr>

          {/* Rate limits */}
          <tr className="border-b dark:border-gray-700">
            <td className="p-4 font-medium text-gray-900 dark:text-white">
              API Rate Limit
            </td>
            <td className="p-4 text-center">
              <div className="font-bold text-lg text-gray-900 dark:text-white">
                60/hour
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                1 per minute avg
              </div>
            </td>
            <td className="p-4 text-center bg-blue-50 dark:bg-blue-900/30">
              <div className="font-bold text-lg text-blue-600 dark:text-blue-400">
                300/hour
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                5 per minute avg
              </div>
            </td>
          </tr>

          {/* Advanced Charts */}
          <tr className="border-b dark:border-gray-700">
            <td className="p-4 font-medium text-gray-900 dark:text-white">
              Advanced Charts
            </td>
            <td className="p-4 text-center text-red-500">
              <span className="text-xl">✗</span>
            </td>
            <td className="p-4 text-center bg-blue-50 dark:bg-blue-900/30 text-green-600">
              <span className="text-xl">✓</span>
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
            <td className="p-4 text-center bg-blue-50 dark:bg-blue-900/30 text-green-600">
              <span className="text-xl">✓</span>
            </td>
          </tr>

          {/* API Access */}
          <tr className="border-b dark:border-gray-700">
            <td className="p-4 font-medium text-gray-900 dark:text-white">
              API Access
            </td>
            <td className="p-4 text-center text-red-500">
              <span className="text-xl">✗</span>
            </td>
            <td className="p-4 text-center bg-blue-50 dark:bg-blue-900/30 text-green-600">
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
            <td className="p-4 text-center bg-blue-50 dark:bg-blue-900/30 text-green-600">
              <span className="text-xl">✓</span>
            </td>
          </tr>

          {/* Pricing */}
          <tr className="bg-gray-50 dark:bg-gray-800/50">
            <td className="p-4 font-bold text-gray-900 dark:text-white">
              Price
            </td>
            <td className="p-4 text-center">
              <div className="font-bold text-2xl text-gray-900 dark:text-white">
                $0
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Free Forever
              </div>
            </td>
            <td className="p-4 text-center bg-blue-50 dark:bg-blue-900/30">
              <div className="font-bold text-2xl text-blue-600 dark:text-blue-400">
                $29
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                per month
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400 font-medium mt-1">
                or $290/year (save $58)
              </div>
              <div className="text-sm text-green-600 dark:text-green-400 font-medium mt-1">
                7-day free trial
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 mt-6 justify-center">
        <Link href="/register">
          <Button variant="outline" className="w-full sm:w-auto">
            Get Started Free
          </Button>
        </Link>
        <Link href="/pricing">
          <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
            Start 7-Day Free Trial
          </Button>
        </Link>
      </div>
    </div>
  );
}
