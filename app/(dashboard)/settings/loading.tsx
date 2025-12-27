import { Skeleton } from '@/components/ui/skeleton';

/**
 * Settings Loading Skeleton
 *
 * Displays skeleton placeholders while settings content loads.
 * Matches the general layout of settings pages.
 */
export default function SettingsLoading(): React.JSX.Element {
  return (
    <div className="animate-pulse">
      {/* Page Title */}
      <Skeleton className="h-8 w-48 mb-6" />

      {/* Profile Photo Section */}
      <div className="mb-6">
        <Skeleton className="h-4 w-24 mb-3" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div>
            <Skeleton className="h-9 w-28 mb-2" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </div>

      {/* Separator */}
      <Skeleton className="h-px w-full my-6" />

      {/* Form Fields */}
      <div className="space-y-4">
        {/* Field 1 */}
        <div>
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Field 2 */}
        <div>
          <Skeleton className="h-4 w-16 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Field 3 */}
        <div>
          <Skeleton className="h-4 w-28 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Textarea Field */}
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 mt-8">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-28" />
      </div>
    </div>
  );
}
