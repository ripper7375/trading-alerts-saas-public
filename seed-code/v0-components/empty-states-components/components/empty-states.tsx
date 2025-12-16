'use client';

import type React from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode | string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  illustration?: React.ReactNode;
  fullHeight?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  illustration,
  fullHeight = false,
  className,
}: EmptyStateProps) {
  const containerClasses = cn(
    'bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center',
    fullHeight && 'min-h-96 flex items-center justify-center',
    'animate-in fade-in duration-500',
    className
  );

  return (
    <Card className={containerClasses}>
      <div className="max-w-2xl mx-auto">
        {illustration ? (
          illustration
        ) : typeof icon === 'string' ? (
          <div className="text-8xl md:text-8xl sm:text-6xl opacity-30 mb-6 animate-in zoom-in duration-700">
            {icon}
          </div>
        ) : (
          icon && <div className="mb-6">{icon}</div>
        )}

        <h2 className="text-2xl md:text-2xl sm:text-xl font-bold text-gray-500 mb-2">
          {title}
        </h2>
        <p className="text-gray-400 mb-8 max-w-md mx-auto">{description}</p>

        {action && (
          <Button
            onClick={action.onClick}
            className={cn(
              'px-8 py-3 rounded-lg text-lg font-semibold shadow-lg',
              action.variant === 'secondary'
                ? 'bg-gray-600 hover:bg-gray-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            )}
          >
            {action.label}
          </Button>
        )}

        {secondaryAction && (
          <div className="mt-4">
            <button
              onClick={secondaryAction.onClick}
              className="text-blue-600 hover:underline text-sm cursor-pointer"
            >
              {secondaryAction.label}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

// VARIANT 1: No Watchlist Items
export function NoWatchlistItems({
  onAddSymbol,
  onBrowseSymbols,
}: {
  onAddSymbol: () => void;
  onBrowseSymbols: () => void;
}) {
  return (
    <div className="animate-in fade-in duration-500">
      <Card className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
        <div className="text-8xl md:text-8xl sm:text-6xl opacity-30 mb-6 animate-in zoom-in duration-700">
          📋
        </div>
        <h2 className="text-2xl md:text-2xl sm:text-xl font-bold text-gray-500 mt-6 mb-2">
          No symbols in your watchlist
        </h2>
        <p className="text-gray-400 mb-8 max-w-md mx-auto">
          Add your first symbol to start monitoring price movements
        </p>
        <Button
          onClick={onAddSymbol}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 shadow-lg"
        >
          + Add Symbol to Watchlist
        </Button>
        <div className="mt-4">
          <button
            onClick={onBrowseSymbols}
            className="text-blue-600 hover:underline text-sm cursor-pointer"
          >
            Browse all symbols
          </button>
        </div>
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 mt-8 text-sm text-blue-800 text-left max-w-lg mx-auto">
          💡 Quick Tip: Start with popular symbols like XAUUSD (Gold) or EURUSD
        </div>
      </Card>
    </div>
  );
}

// VARIANT 2: No Active Alerts
export function NoActiveAlerts({
  onCreateAlert,
  onViewCharts,
}: {
  onCreateAlert: () => void;
  onViewCharts: () => void;
}) {
  return (
    <div className="animate-in fade-in duration-500">
      <Card className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
        <div className="text-8xl md:text-8xl sm:text-6xl opacity-30 mb-6">
          🔔
        </div>
        <h2 className="text-2xl md:text-2xl sm:text-xl font-bold text-gray-500 mt-6 mb-2">
          No active alerts
        </h2>
        <p className="text-gray-400 mb-8">
          Create your first alert to get notified when price reaches key levels
        </p>
        <Button
          onClick={onCreateAlert}
          className="bg-green-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-green-700 shadow-lg"
        >
          Create Your First Alert
        </Button>
        <div className="mt-4">
          <button
            onClick={onViewCharts}
            className="text-blue-600 hover:underline text-sm cursor-pointer"
          >
            View charts
          </button>
        </div>

        {/* Steps Guide */}
        <Card className="bg-white rounded-xl shadow-md p-6 mt-8 max-w-2xl mx-auto text-left">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            How to create an alert:
          </h3>
          <ol className="space-y-2 list-decimal list-inside text-gray-700">
            <li>Go to Live Charts and select a symbol</li>
            <li>Click on a fractal line (support/resistance)</li>
            <li>Configure your alert settings and tolerance</li>
            <li>Choose notification methods (email, push, SMS)</li>
            <li>Click &apos;Create Alert&apos; and wait for notifications!</li>
          </ol>
        </Card>
      </Card>
    </div>
  );
}

// VARIANT 3: No Notifications
export function NoNotifications({
  onCreateAlert,
}: {
  onCreateAlert: () => void;
}) {
  return (
    <div className="animate-in fade-in duration-500">
      <Card className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
        <div className="text-8xl md:text-8xl sm:text-6xl opacity-30 mb-6">
          🔕
        </div>
        <h2 className="text-2xl md:text-2xl sm:text-xl font-bold text-gray-500 mt-6 mb-2">
          No notifications yet
        </h2>
        <p className="text-gray-400 mb-8">
          You&apos;ll see all your notifications here once you start receiving
          them
        </p>
        <Button
          onClick={onCreateAlert}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
        >
          Create an Alert
        </Button>
        <p className="text-sm text-green-600 mt-6">
          ✓ Email and push notifications are enabled
        </p>
      </Card>
    </div>
  );
}

// VARIANT 4: No Search Results
export function NoSearchResults({
  searchQuery,
  onClearSearch,
  onViewAll,
}: {
  searchQuery: string;
  onClearSearch: () => void;
  onViewAll: () => void;
}) {
  return (
    <div className="animate-in fade-in duration-500">
      <Card className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
        <div className="text-8xl md:text-8xl sm:text-6xl opacity-30 mb-6">
          🔍
        </div>
        <h2 className="text-2xl md:text-2xl sm:text-xl font-bold text-gray-500 mt-6 mb-2">
          No results found
        </h2>
        <p className="text-gray-400 mb-8">
          We couldn&apos;t find any matches for &apos;{searchQuery}&apos;
        </p>

        {/* Suggestions */}
        <Card className="bg-white rounded-lg border-2 border-gray-200 p-6 mt-6 max-w-md mx-auto text-left">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Try these suggestions:
          </h3>
          <ul className="space-y-1 text-sm text-gray-600 list-disc list-inside">
            <li>Check your spelling</li>
            <li>Use different keywords</li>
            <li>Try more general terms</li>
            <li>Browse all symbols instead</li>
          </ul>
        </Card>

        <Button
          onClick={onClearSearch}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 mt-6"
        >
          Clear Search
        </Button>
        <div className="mt-4">
          <button
            onClick={onViewAll}
            className="text-blue-600 hover:underline text-sm cursor-pointer"
          >
            View all symbols
          </button>
        </div>
      </Card>
    </div>
  );
}

// VARIANT 5: No Billing History
export function NoBillingHistory() {
  return (
    <div className="animate-in fade-in duration-500">
      <Card className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
        <div className="text-8xl md:text-8xl sm:text-6xl opacity-30 mb-6">
          📄
        </div>
        <h2 className="text-2xl md:text-2xl sm:text-xl font-bold text-gray-500 mt-6 mb-2">
          No billing history
        </h2>
        <p className="text-gray-400 mb-8">
          You haven&apos;t been charged yet. Invoices will appear here after
          your first payment.
        </p>

        {/* Info Card */}
        <Card className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-4 max-w-lg mx-auto">
          <p className="text-sm text-yellow-800">
            🎁 You&apos;re currently on a 7-day free trial. Your first charge
            will be on January 22, 2025.
          </p>
        </Card>
      </Card>
    </div>
  );
}

// VARIANT 6: No Triggered Alerts
export function NoTriggeredAlerts({
  activeAlerts = 3,
  maxAlerts = 5,
  watchingSymbols = ['XAUUSD', 'EURUSD', 'BTCUSD'],
  onViewActiveAlerts,
}: {
  activeAlerts?: number;
  maxAlerts?: number;
  watchingSymbols?: string[];
  onViewActiveAlerts: () => void;
}) {
  return (
    <div className="animate-in fade-in duration-500">
      <Card className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
        <div className="text-8xl md:text-8xl sm:text-6xl opacity-30 mb-6">
          ✅
        </div>
        <h2 className="text-2xl md:text-2xl sm:text-xl font-bold text-gray-500 mt-6 mb-2">
          No alerts triggered recently
        </h2>
        <p className="text-gray-400 mb-8">
          None of your alerts have been triggered in the last 7 days
        </p>

        {/* Stats */}
        <div className="space-y-1 mb-6">
          <p className="text-sm text-gray-600">
            Active alerts: {activeAlerts}/{maxAlerts}
          </p>
          <p className="text-xs text-gray-500">
            Watching: {watchingSymbols.join(', ')}
          </p>
        </div>

        <Button
          onClick={onViewActiveAlerts}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
        >
          View Active Alerts
        </Button>
      </Card>
    </div>
  );
}

// VARIANT 7: Connection Error / Failed to Load
export function ConnectionError({
  onRetry,
  onReportIssue,
  errorCode = 'NET_001',
}: {
  onRetry: () => void;
  onReportIssue?: () => void;
  errorCode?: string;
}) {
  return (
    <div className="animate-in fade-in duration-500">
      <Card className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
        <div className="text-8xl md:text-8xl sm:text-6xl text-orange-500 mb-6">
          ⚠️
        </div>
        <h2 className="text-2xl md:text-2xl sm:text-xl font-bold text-gray-700 mt-6 mb-2">
          Failed to load data
        </h2>
        <p className="text-gray-600 mb-8">
          We couldn&apos;t load this content. Please check your connection and
          try again.
        </p>
        <Button
          onClick={onRetry}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="w-5 h-5 mr-2 inline" />
          Retry
        </Button>
        {onReportIssue && (
          <div className="mt-4">
            <button
              onClick={onReportIssue}
              className="text-blue-600 hover:underline text-sm cursor-pointer"
            >
              Report issue
            </button>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-6 font-mono">
          Error code: {errorCode}
        </p>
      </Card>
    </div>
  );
}

// VARIANT 8: Feature Coming Soon
export function ComingSoon({
  featureName,
  expectedDate = 'Q1 2025',
  onSubscribe,
}: {
  featureName?: string;
  expectedDate?: string;
  onSubscribe?: () => void;
}) {
  return (
    <div className="animate-in fade-in duration-500">
      <Card className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
        <div className="text-8xl md:text-8xl sm:text-6xl opacity-40 mb-6">
          🚧
        </div>
        <h2 className="text-2xl md:text-2xl sm:text-xl font-bold text-gray-600 mt-6 mb-2">
          Coming Soon
        </h2>
        <p className="text-gray-500 mb-8">
          {featureName
            ? `${featureName} is currently under development. Check back soon!`
            : 'This feature is currently under development. Check back soon!'}
        </p>

        {/* Timeline Badge */}
        <span className="bg-purple-100 text-purple-800 px-4 py-2 rounded-full text-sm font-semibold inline-block mb-6">
          Expected: {expectedDate}
        </span>

        {/* Notification Opt-in */}
        {onSubscribe && (
          <div className="mt-6">
            <label className="flex items-center justify-center gap-2 text-sm text-gray-700 mb-4 cursor-pointer">
              <input type="checkbox" className="rounded" />
              Notify me when this feature launches
            </label>
            <Button
              onClick={onSubscribe}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
            >
              Subscribe to Updates
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

// VARIANT 9: Access Denied / Upgrade Required
export function UpgradeRequired({
  onUpgrade,
  onComparePlans,
}: {
  onUpgrade: () => void;
  onComparePlans?: () => void;
}) {
  return (
    <div className="animate-in fade-in duration-500">
      <Card className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
        <div className="text-8xl md:text-8xl sm:text-6xl text-gray-400 mb-6">
          🔒
        </div>
        <h2 className="text-2xl md:text-2xl sm:text-xl font-bold text-gray-700 mt-6 mb-2">
          PRO Feature
        </h2>
        <p className="text-gray-600 mb-8">
          This feature is only available for PRO subscribers
        </p>

        {/* Benefits List */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 max-w-md mx-auto mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Unlock with PRO:
          </h3>
          <ul className="space-y-2 text-left text-gray-700">
            <li className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              15 Trading Symbols
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-600">✅</span>9 Timeframes (M5-D1)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              20 Active Alerts
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              Priority Chart Updates
            </li>
          </ul>
          <div className="mt-6 text-center">
            <p className="text-3xl font-bold text-gray-900 mb-2">$29/month</p>
            <p className="text-sm text-green-600 font-semibold mb-6">
              7-day free trial
            </p>
          </div>
        </Card>

        <Button
          onClick={onUpgrade}
          className="bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-bold hover:bg-blue-700 shadow-lg"
        >
          Upgrade to PRO
        </Button>
        {onComparePlans && (
          <div className="mt-4">
            <button
              onClick={onComparePlans}
              className="text-blue-600 hover:underline text-sm cursor-pointer"
            >
              Compare plans
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}

// VARIANT 10: Maintenance Mode
export function MaintenanceMode({
  estimatedTime = '15 minutes',
  onCheckStatus,
}: {
  estimatedTime?: string;
  onCheckStatus?: () => void;
}) {
  return (
    <div className="animate-in fade-in duration-500">
      <Card className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
        <div className="text-8xl md:text-8xl sm:text-6xl opacity-40 mb-6">
          🛠️
        </div>
        <h2 className="text-2xl md:text-2xl sm:text-xl font-bold text-gray-700 mt-6 mb-2">
          Under Maintenance
        </h2>
        <p className="text-gray-600 mb-8">
          We&apos;re performing scheduled maintenance. We&apos;ll be back
          shortly.
        </p>

        {/* Countdown */}
        {estimatedTime && (
          <p className="text-lg font-mono text-blue-600 mb-6">
            Estimated time: {estimatedTime}
          </p>
        )}

        {/* Status Page Link */}
        {onCheckStatus && (
          <Button
            onClick={onCheckStatus}
            variant="outline"
            className="border-2 border-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:border-blue-600 hover:text-blue-600 bg-transparent"
          >
            Check Status Page
          </Button>
        )}
      </Card>
    </div>
  );
}

// LOADING SKELETON VARIANT
export function LoadingSkeleton({
  type = 'cards',
}: {
  type?: 'cards' | 'list';
}) {
  if (type === 'cards') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="bg-gray-200 animate-pulse rounded-lg h-32"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="bg-gray-200 animate-pulse rounded-lg h-20"
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  );
}
