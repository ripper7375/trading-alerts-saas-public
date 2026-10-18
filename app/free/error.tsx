'use client';

import { SegmentErrorCard } from '@/components/ui/segment-error-card';

/**
 * Error boundary of the FREE workspace. Like the terminal's layout, this one
 * has no chrome of its own, so the card offers a way home.
 */
export default function FreeError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}): React.ReactElement {
  return (
    <SegmentErrorCard error={error} retry={retry} segment="free" homeLink />
  );
}
