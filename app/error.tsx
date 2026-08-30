'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { AlertOctagon, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Route-segment error boundary (Next.js App Router convention) — catches
 * exceptions thrown inside `app/layout.tsx`'s tree, unlike `app/global-error.tsx`
 * which only catches throws from the root layout itself. Unlike global-error,
 * this file renders inside the normal provider tree, so it uses semantic design
 * tokens (theme/accent-reactive) rather than hardcoded colors.
 */
export default function Error({
  error,
  reset,
}: ErrorPageProps): React.ReactElement {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Card className="border-destructive/30 w-full max-w-md text-center">
        <CardContent className="flex flex-col items-center p-8">
          <div className="border-destructive/40 bg-destructive/10 mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border text-destructive">
            <AlertOctagon className="h-8 w-8" aria-hidden="true" />
          </div>

          <h1 className="mb-2 text-2xl font-bold text-foreground">
            Something went wrong
          </h1>
          <p className="mb-6 text-muted-foreground">
            {error.message || 'An unexpected error occurred. Please try again.'}
          </p>

          {error.digest && (
            <p className="mb-6 font-mono text-xs text-muted-foreground">
              Error ID: {error.digest}
            </p>
          )}

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={reset} className="w-full sm:w-auto">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
            <Link href="/" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full">
                <Home className="mr-2 h-4 w-4" />
                Go to Homepage
              </Button>
            </Link>
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            If the problem persists, please{' '}
            <a
              href="mailto:support@davintrade.app"
              className="hover:text-primary/80 text-primary underline underline-offset-4"
            >
              contact support
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
