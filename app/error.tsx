'use client';

import Link from 'next/link';
import { useEffect } from 'react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({
  error,
  reset,
}: ErrorPageProps): React.ReactElement {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center">
        {/* Error icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <svg
            className="h-8 w-8 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Error message */}
        <h1 className="mb-2 text-2xl font-bold text-foreground">
          Something went wrong
        </h1>
        <p className="mb-6 text-muted-foreground">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>

        {/* Error digest (for debugging) */}
        {error.digest && (
          <p className="mb-6 text-xs text-muted-foreground">
            Error ID: {error.digest}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            Go to Homepage
          </Link>
        </div>

        {/* Help text */}
        <p className="mt-8 text-sm text-muted-foreground">
          If the problem persists, please{' '}
          <a
            href="mailto:support@tradingalerts.com"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            contact support
          </a>
        </p>
      </div>
    </div>
  );
}
