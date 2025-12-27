'use client';

/**
 * Alert Loading Skeleton Components
 *
 * Provides loading state UI for alert list and cards.
 *
 * @module components/alerts/alert-skeleton
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Single alert card skeleton
 */
export function AlertCardSkeleton(): React.JSX.Element {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex items-center justify-between pt-2 border-t">
          <Skeleton className="h-4 w-28" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Alert list skeleton
 */
export function AlertListSkeleton({
  count = 3,
}: {
  count?: number;
}): React.JSX.Element {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <AlertCardSkeleton key={index} />
      ))}
    </div>
  );
}

/**
 * Compact alert row skeleton for tables
 */
export function AlertRowSkeleton(): React.JSX.Element {
  return (
    <div className="flex items-center justify-between p-4 border-b last:border-b-0">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-6 w-14 rounded-full" />
        <Skeleton className="h-8 w-8 rounded" />
      </div>
    </div>
  );
}

/**
 * Alert table skeleton
 */
export function AlertTableSkeleton({
  rows = 5,
}: {
  rows?: number;
}): React.JSX.Element {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {Array.from({ length: rows }).map((_, index) => (
          <AlertRowSkeleton key={index} />
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Alert form skeleton
 */
export function AlertFormSkeleton(): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress bar skeleton */}
        <div className="p-4 rounded-lg border bg-gray-50">
          <div className="flex justify-between items-center mb-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-2 w-full rounded" />
        </div>

        {/* Form fields skeleton */}
        <div className="space-y-4">
          {/* Symbol field */}
          <div>
            <Skeleton className="h-4 w-16 mb-2" />
            <Skeleton className="h-10 w-full rounded" />
            <Skeleton className="h-3 w-40 mt-1" />
          </div>

          {/* Timeframe field */}
          <div>
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-10 w-full rounded" />
          </div>

          {/* Condition type field */}
          <div>
            <Skeleton className="h-4 w-28 mb-2" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </div>

          {/* Target value field */}
          <div>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-10 w-full rounded" />
          </div>

          {/* Alert name field */}
          <div>
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-10 w-full rounded" />
          </div>
        </div>

        {/* Buttons skeleton */}
        <div className="flex gap-4 pt-4 border-t">
          <Skeleton className="h-10 flex-1 rounded" />
          <Skeleton className="h-10 flex-1 rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Loading overlay for alert operations
 */
export function AlertLoadingOverlay({
  message = 'Processing...',
}: {
  message?: string;
}): React.JSX.Element {
  return (
    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        <p className="text-sm text-gray-600 font-medium">{message}</p>
      </div>
    </div>
  );
}

/**
 * Inline loading indicator for alert actions
 */
export function AlertActionLoading({
  action,
}: {
  action: 'toggle' | 'delete' | 'update';
}): React.JSX.Element {
  const messages: Record<string, string> = {
    toggle: 'Toggling...',
    delete: 'Deleting...',
    update: 'Saving...',
  };

  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
      <span className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full" />
      {messages[action]}
    </span>
  );
}

/**
 * Empty state with loading hint
 */
export function AlertEmptyState({
  isLoading,
  message = 'No alerts found',
  actionLabel = 'Create Alert',
  onAction,
}: {
  isLoading?: boolean;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}): React.JSX.Element {
  if (isLoading) {
    return <AlertListSkeleton count={3} />;
  }

  return (
    <Card className="p-8">
      <div className="text-center">
        <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-6 h-6 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">{message}</h3>
        <p className="text-sm text-gray-500 mb-4">
          Create your first alert to get started
        </p>
        {onAction && (
          <button
            onClick={onAction}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            {actionLabel}
          </button>
        )}
      </div>
    </Card>
  );
}
