'use client';

import { SegmentErrorCard } from '@/components/ui/segment-error-card';

/**
 * Error boundary of the PRO terminal. The terminal layout has no chrome of
 * its own (the workspace is the whole screen), so the card offers a way home.
 */
export default function TerminalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}): React.ReactElement {
  return (
    <SegmentErrorCard error={error} retry={retry} segment="terminal" homeLink />
  );
}
