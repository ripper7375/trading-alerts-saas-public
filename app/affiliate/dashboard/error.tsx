'use client';

import { SegmentErrorCard } from '@/components/ui/segment-error-card';

/**
 * Error boundary of the affiliate dashboard. It renders inside
 * `dashboard/layout.tsx`, so the affiliate navigation stays and only the
 * failed page is replaced by the recovery card.
 */
export default function AffiliateDashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}): React.ReactElement {
  return (
    <SegmentErrorCard
      error={error}
      retry={retry}
      segment="affiliate/dashboard"
    />
  );
}
