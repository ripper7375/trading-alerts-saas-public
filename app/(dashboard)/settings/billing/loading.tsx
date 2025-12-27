import { Skeleton } from '@/components/ui/skeleton';

/**
 * Billing Settings Loading Skeleton
 *
 * Displays skeleton placeholders matching the billing settings layout.
 */
export default function BillingSettingsLoading(): React.JSX.Element {
  return (
    <div className="animate-pulse">
      {/* Page Title */}
      <Skeleton className="h-8 w-48 mb-6" />

      {/* Current Plan Card */}
      <div className="border-2 rounded-xl p-6 mb-8">
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-28 mb-2" />
        <div className="flex items-baseline gap-2 mb-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="space-y-2 mb-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      {/* Payment Method */}
      <section className="mb-8">
        <Skeleton className="h-6 w-36 mb-4" />
        <div className="border rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-12 rounded" />
            <div>
              <Skeleton className="h-5 w-40 mb-1" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
      </section>

      {/* Separator */}
      <Skeleton className="h-px w-full my-8" />

      {/* Usage Statistics */}
      <section className="mb-8">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <div className="flex justify-between mb-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </section>

      {/* Separator */}
      <Skeleton className="h-px w-full my-8" />

      {/* Invoice History */}
      <section>
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="border rounded-lg overflow-hidden">
          {/* Table Header */}
          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 flex gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32 flex-1" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
          {/* Table Rows */}
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="px-4 py-3 flex items-center gap-4 border-t"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-8 w-8" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
