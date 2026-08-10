'use client';

import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
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
 * Account deletion confirmation landing page — the destination for the
 * confirm link sent in a deletion request email. Deliberately reachable
 * without a session (middleware.ts carries an exact-pathname allow-list for
 * this route): the user may be on a different device, logged out, or have
 * an expired session by the time they click the link.
 *
 * Human-in-the-loop gate: `POST /api/user/account/deletion-confirm` is
 * never fired on page load — only after an explicit click, so an email
 * preview prefetcher or security scanner visiting this URL can't trigger it.
 */

type ConfirmState =
  | 'idle'
  | 'submitting'
  | 'success'
  | 'error'
  | 'missing-token';

function DeleteConfirmContent(): JSX.Element {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [state, setState] = useState<ConfirmState>(
    token ? 'idle' : 'missing-token'
  );
  const [errorMessage, setErrorMessage] = useState('');

  // Focus management: the CardTitle/Card primitives are plain function
  // components (not forwardRef), so the announcing ref/tabIndex live on a
  // wrapper div we control directly, not on the primitives themselves.
  const announceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    announceRef.current?.focus();
  }, [state]);

  const handleConfirm = async (): Promise<void> => {
    if (!token) return;
    setState('submitting');

    try {
      const response = await fetch('/api/user/account/deletion-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(
          data.message ||
            data.error ||
            'Failed to confirm account deletion. Please try again.'
        );
        setState('error');
        return;
      }

      setState('success');
    } catch (err) {
      console.error('Account deletion confirm error:', err);
      setErrorMessage('Failed to confirm account deletion. Please try again.');
      setState('error');
    }
  };

  if (state === 'missing-token') {
    return (
      <div
        ref={announceRef}
        tabIndex={-1}
        role="alert"
        aria-live="assertive"
        className="outline-none"
      >
        <Card className="border-amber-200 dark:border-amber-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              Invalid or Missing Token
            </CardTitle>
            <CardDescription>
              This confirmation link is missing its token. Please use the exact
              link from your account deletion email, or sign in and request
              deletion again from Account Settings.
            </CardDescription>
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
              Account Scheduled for Deletion
            </CardTitle>
            <CardDescription>
              Your account will be permanently deleted in 24 hours. Changed your
              mind? You can still cancel during this window — use the cancel
              link in your email, or sign in and cancel from Account Settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Link href="/login">
              <Button variant="outline">Return to Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === 'error') {
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
              Confirmation Failed
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

  // idle / submitting — the human-in-the-loop confirmation gate
  return (
    <div ref={announceRef} tabIndex={-1} className="outline-none">
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            Confirm Account Deletion
          </CardTitle>
          <CardDescription>
            You requested to delete your account. This confirmation link is
            valid for 7 days from your original request. Clicking &quot;Confirm
            Account Deletion&quot; below schedules your account for permanent
            deletion in 24 hours — you&apos;ll still be able to cancel during
            that window.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={state === 'submitting'}
            aria-busy={state === 'submitting'}
          >
            {state === 'submitting' ? (
              <>
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Confirming...
              </>
            ) : (
              'Confirm Account Deletion'
            )}
          </Button>
          <Link href="/settings/account">
            <Button variant="outline" disabled={state === 'submitting'}>
              Cancel, Keep My Account
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DeleteConfirmPage(): JSX.Element {
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
          <DeleteConfirmContent />
        </Suspense>
      </div>
    </div>
  );
}
