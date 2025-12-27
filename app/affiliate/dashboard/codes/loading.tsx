import { Skeleton } from '@/components/ui/skeleton';

/**
 * Affiliate Codes Loading Skeleton
 *
 * Displays skeleton placeholders for the affiliate codes list.
 */
export default function AffiliateCodesLoading(): React.JSX.Element {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-8 w-36 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Codes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="bg-white rounded-lg border border-gray-200 p-6"
          >
            {/* Code Header */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <Skeleton className="h-6 w-28 mb-2" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>

            {/* Code Details */}
            <div className="space-y-3 mb-4">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-12" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
