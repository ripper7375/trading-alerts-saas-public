'use client';

import { SegmentErrorCard } from '@/components/ui/segment-error-card';

/**
 * Error boundary of the PRO currency-index cockpit (and its `compare` page).
 * The layout has no chrome of its own, so the card offers a way home.
 */
export default function CurrencyIndexProError({
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
      segment="pro/currency-index"
      homeLink
    />
  );
}
