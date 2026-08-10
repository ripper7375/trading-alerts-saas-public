'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangleIcon } from 'lucide-react';

import './globals.css';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Root error boundary (Next.js App Router convention). Only ever renders
 * when an error escapes app/layout.tsx itself, so unlike app/error.tsx it
 * must define its own <html>/<body> — the root layout does not render
 * around it. Deliberately minimal: no Providers, no font loader, since
 * this is the last line of defense if the app's own providers are what
 * threw.
 */
export default function GlobalError({
  error,
  reset,
}: GlobalErrorProps): React.ReactElement {
  useEffect(() => {
    console.error('Global application error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
          <div className="border-destructive/20 w-full max-w-md rounded-xl border-2 bg-card p-8 text-center shadow-sm">
            <div className="bg-destructive/10 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full">
              <AlertTriangleIcon
                className="h-8 w-8 text-destructive"
                aria-hidden="true"
              />
            </div>

            <h1 className="mb-2 text-2xl font-bold text-foreground">
              Something went wrong
            </h1>
            <p className="mb-6 text-muted-foreground">
              A critical error occurred and the application couldn&apos;t
              recover on its own. Trying again usually fixes it.
            </p>

            {error.digest && (
              <p className="mb-6 text-xs text-muted-foreground">
                Error ID: {error.digest}
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={reset}
                className="hover:bg-primary/90 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
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

            <p className="mt-8 text-sm text-muted-foreground">
              If the problem persists, please{' '}
              <a
                href="mailto:support@tradingalerts.com"
                className="hover:text-primary/80 text-primary underline underline-offset-4"
              >
                contact support
              </a>
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
