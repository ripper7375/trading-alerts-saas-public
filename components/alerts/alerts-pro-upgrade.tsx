/**
 * Alerts PRO Upgrade Landing — V8
 *
 * Shown to FREE users in place of the alerts list/creation UI.
 * Alerts are a PRO-exclusive feature in the V8 architecture.
 *
 * @module components/alerts/alerts-pro-upgrade
 */

import { Bell, PenLine, Layers, ArrowRight, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export function AlertsProUpgrade(): React.JSX.Element {
  return (
    <div className="max-w-3xl mx-auto space-y-8 py-8">
      {/* Hero */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/40 mb-4">
          <Bell className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Alerts are a PRO feature
        </h1>
        <p className="mt-3 text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
          Never miss a move on Gold. PRO members get the full alert and
          notification system for XAUUSD on M5 and M15 — up to 100 alerts,
          delivered by email, push, and SMS.
        </p>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <Bell className="w-6 h-6 text-blue-600 mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
            100 Price Alerts
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Set price-above, price-below, and crossing conditions on XAUUSD
            M5/M15.
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <PenLine className="w-6 h-6 text-blue-600 mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
            Drawing Line Alerts
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Draw a trendline or level on the chart and get alerted the moment
            price touches it.
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <Layers className="w-6 h-6 text-blue-600 mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
            Multi-Timeframe View
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Overlay M5 structure on M15 charts to time entries with
            higher-timeframe context.
          </p>
        </div>
      </div>

      {/* What you keep on FREE */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6">
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Your FREE plan already includes:
        </p>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            XAUUSD (Gold) charts on M5 and M15
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            Full market data and every indicator overlay — same data as PRO
          </li>
        </ul>
      </div>

      {/* CTA */}
      <div className="text-center">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
        >
          Start 7-Day Free Trial
          <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Full PRO access during the trial. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
