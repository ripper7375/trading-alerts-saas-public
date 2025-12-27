import { Skeleton } from '@/components/ui/skeleton';

/**
 * Account Settings Loading Skeleton
 *
 * Displays skeleton placeholders matching the account settings layout.
 */
export default function AccountSettingsLoading(): React.JSX.Element {
  return (
    <div className="animate-pulse">
      {/* Page Title */}
      <Skeleton className="h-8 w-40 mb-6" />

      {/* Change Password Section */}
      <section className="mb-8">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="space-y-4">
          <div>
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-28 mb-1" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-36 mb-1" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
      </section>

      {/* Separator */}
      <Skeleton className="h-px w-full my-8" />

      {/* Two-Factor Authentication */}
      <section className="mb-8">
        <Skeleton className="h-6 w-52 mb-4" />
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-5 w-24 mb-2" />
              <Skeleton className="h-4 w-56" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        </div>
      </section>

      {/* Separator */}
      <Skeleton className="h-px w-full my-8" />

      {/* Active Sessions */}
      <section className="mb-8">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-5" />
                <div>
                  <Skeleton className="h-4 w-36 mb-1" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
        <Skeleton className="h-10 w-40 mt-4" />
      </section>

      {/* Separator */}
      <Skeleton className="h-px w-full my-8" />

      {/* Danger Zone */}
      <section>
        <Skeleton className="h-6 w-28 mb-4" />
        <div className="border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-5 w-28 mb-2" />
              <Skeleton className="h-4 w-80" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </section>
    </div>
  );
}
