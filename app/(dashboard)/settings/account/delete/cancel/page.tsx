'use client';

import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * Account deletion cancellation landing page — the destination for the
 * cancel link sent in a deletion request/confirmation email. Deliberately
 * reachable without a session (middleware.ts carries an exact-pathname
 * allow-list for this route).
 *
 * `deletion-cancel` is dual-mode by design (its own route handler):
 * a token in the URL identifies the request directly; with no token, the
 * API falls back to the caller's session (a logged-in user cancelling their
 * own pending request, e.g. from a bookmarked/retried link). Cancelling is
 * non-destructive either way, so this fires automatically on load rather
 * than requiring a click — unlike the confirm page's human-in-the-loop gate.
 */

type CancelState = 'submitting' | 'success' | 'error';

function DeleteCancelContent(): JSX.Element {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [state, setState] = useState<CancelState>('submitting');
  const [errorMessage, setErrorMessage] = useState('');
  const announceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    announceRef.current?.focus();
  }, [state]);

  useEffect(() => {
    const cancelDeletion = async (): Promise<void> => {
      try {
        const response = await fetch('/api/user/account/deletion-cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(token ? { token } : {}),
        });
        const data = await response.json();

        if (!response.ok) {
          setErrorMessage(
            data.message ||
              data.error ||
              'Failed to cancel account deletion. Please try again.'
          );
          setState('error');
          return;
        }

        setState('success');
      } catch (err) {
        console.error('Account deletion cancel error:', err);
        setErrorMessage('Failed to cancel account deletion. Please try again.');
        setState('error');
      }
    };

    cancelDeletion();
    // Runs once on mount for the token this page loaded with — deliberately
    // not re-run on token changes, since this is a one-shot landing action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'submitting') {
    return (
      <div ref={announceRef} tabIndex={-1} className="text-center outline-none">
        <Loader2
          className="mx-auto h-8 w-8 animate-spin text-gray-400"
          aria-hidden="true"
        />
        <p className="mt-4 text-gray-600 dark:text-gray-400">
          Cancelling your deletion request...
        </p>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div
        ref={announceRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="outline-none"
      >
        <Card className="border-green-200 dark:border-green-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              Account Deletion Cancelled
            </CardTitle>
            <CardDescription>
              Your account remains active. Nothing further will happen —
              you&apos;re free to keep using Trading Alerts as normal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button variant="outline">Return to Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // error
  return (
    <div
      ref={announceRef}
      tabIndex={-1}
      role="alert"
      aria-live="assertive"
      className="outline-none"
    >
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <XCircle className="h-5 w-5" aria-hidden="true" />
            Cancellation Failed
          </CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login">
            <Button variant="outline">Go to Sign In</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DeleteCancelPage(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-900">
      <div className="w-full max-w-lg">
        <Suspense
          fallback={
            <div className="text-center">
              <Loader2
                className="mx-auto h-8 w-8 animate-spin text-gray-400"
                aria-hidden="true"
              />
              <p className="mt-4 text-gray-600 dark:text-gray-400">
                Loading...
              </p>
            </div>
          }
        >
          <DeleteCancelContent />
        </Suspense>
      </div>
    </div>
  );
}
