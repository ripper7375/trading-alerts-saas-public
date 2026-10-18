'use client';

import { SegmentErrorCard } from '@/components/ui/segment-error-card';

/**
 * Error boundary of the BI dashboard suite. It renders inside
 * `dashboards/layout.tsx`, so the header and the tab bar stay and only the
 * failed dashboard is replaced by the recovery card.
 */
export default function AdminDashboardsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}): React.ReactElement {
  return (
    <SegmentErrorCard error={error} retry={retry} segment="admin/dashboards" />
  );
}
