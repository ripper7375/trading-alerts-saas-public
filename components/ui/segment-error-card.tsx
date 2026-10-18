'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { AlertOctagon, Home, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLocale } from '@/lib/context/locale-context';

export interface SegmentErrorCardProps {
  error: Error & { digest?: string };
  /**
   * Next's `retry` (stable since 16.3): refreshes the route and re-renders the
   * segment, so a failed Server Component read runs again. `reset` would only
   * re-render the client children from the cached payload and show the same
   * failure again.
   */
  retry: () => void;
  /** Where it happened, for the log line (`admin/dashboards`). */
  segment: string;
  /**
   * A link home, for the full-screen workspaces whose layout has no chrome of
   * its own to navigate away with.
   */
  homeLink?: boolean;
}

/**
 * The inline recovery card of a route segment's `error.tsx`.
 *
 * It renders inside the segment's own layout, so the navigation around it
 * (the BI tabs, the affiliate nav, the admin shell) stays usable and only the
 * failed page is replaced, where the root `app/error.tsx` would replace the
 * whole app. Like it, it never prints `error.message` (a server error can
 * carry internals); the `digest` ties the card to the server log line, and
 * the full error goes to the console with it.
 */
export function SegmentErrorCard({
  error,
  retry,
  segment,
  homeLink = false,
}: SegmentErrorCardProps): React.ReactElement {
  const { t } = useLocale();
  useEffect(() => {
    console.error(`Segment error (${segment}):`, error, {
      digest: error.digest,
    });
  }, [error, segment]);

  return (
    <div
      role="alert"
      data-slot="segment-error"
      className="flex min-h-[50vh] items-center justify-center px-4 py-8"
    >
      <Card className="border-destructive/30 w-full max-w-md text-center">
        <CardContent className="flex flex-col items-center p-8">
          <div className="border-destructive/40 bg-destructive/10 mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border text-destructive">
            <AlertOctagon className="h-7 w-7" aria-hidden="true" />
          </div>

          <h2 className="mb-2 text-xl font-bold text-foreground">
            {t('errors.page.title', 'Something went wrong')}
          </h2>
          <p className="mb-4 text-muted-foreground">
            {t(
              'errors.page.unexpected',
              'An unexpected error occurred. Please try again.'
            )}
          </p>

          {error.digest && (
            <p className="mb-4 font-mono text-xs text-muted-foreground">
              {t('errors.page.error_id', 'Error ID:')} {error.digest}
            </p>
          )}

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={retry} className="w-full sm:w-auto">
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('errors.page.try_again', 'Try again')}
            </Button>
            {homeLink && (
              <Link href="/" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full">
                  <Home className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t('errors.page.go_home', 'Go to Homepage')}
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
