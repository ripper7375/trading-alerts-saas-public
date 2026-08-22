'use client';

import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/**
 * Account deletion cancellation landing page — the destination for the
 * cancel link sent in a deletion request/confirmation email. Deliberately
 * reachable without a session. Lives outside app/(dashboard)/ for the same
 * reason as the confirm page's own module comment explains: that route
 * group's layout.tsx redirects logged-out visitors on its own, separately
 * from middleware.ts's exact-pathname allow-list — both had to be
 * addressed, not just the middleware layer.
 *
 * `deletion-cancel` is dual-mode by design (its own route handler):
 * a token in the URL identifies the request directly; with no token, the
 * API falls back to the caller's session (a logged-in user cancelling their
 * own pending request, e.g. from a bookmarked/retried link). Cancelling is
 * non-destructive either way, so this fires automatically on load rather
 * than requiring a click — unlike the confirm page's human-in-the-loop gate.
 * Session 9-2 restyled the visuals to DavinTrade branding; logic unchanged.
 */

type CancelState = 'submitting' | 'success' | 'error';

function BrandHeader(): JSX.Element {
  return (
    <div className="mb-6 space-y-2 text-center">
      <Link href="/" className="inline-flex items-center gap-2">
        <div className="relative flex h-10 w-10 overflow-hidden rounded-xl border border-amber-500/40 bg-amber-500/20 p-0.5 shadow-lg shadow-amber-500/20">
          <Image
            src="/davintrade-ai-icon.png"
            alt="DavinTrade AI"
            width={40}
            height={40}
            className="h-full w-full rounded-[9px] object-cover"
          />
        </div>
        <span className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 bg-clip-text text-xl font-black text-transparent dark:from-amber-400 dark:to-amber-200">
          DavinTrade AI
        </span>
      </Link>
    </div>
  );
}

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
      <div
        ref={announceRef}
        tabIndex={-1}
        className="w-full max-w-md text-center outline-none"
      >
        <BrandHeader />
        <Loader2
          className="mx-auto h-10 w-10 animate-spin text-amber-600 dark:text-amber-400"
          aria-hidden="true"
        />
        <p className="mt-4 text-xs text-slate-600 dark:text-slate-400">
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
        className="w-full max-w-md outline-none"
      >
        <BrandHeader />
        <Card className="space-y-6 border-emerald-500/30 bg-white p-6 text-center shadow-2xl dark:border-emerald-500/20 dark:bg-[#090b14]/95 dark:backdrop-blur-2xl md:p-8">
          <div className="space-y-4 py-2">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
              </div>
            </div>
            <div className="space-y-1">
              <h1 className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                Account Deletion Cancelled
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Your account remains active. Nothing further will happen —
                you&apos;re free to keep using DavinTrade AI as normal.
              </p>
            </div>
            <div className="pt-2">
              <Link href="/login">
                <Button
                  variant="outline"
                  className="w-full border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Return to Sign In
                </Button>
              </Link>
            </div>
          </div>
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
      className="w-full max-w-md outline-none"
    >
      <BrandHeader />
      <Card className="space-y-6 border-rose-500/30 bg-white p-6 text-center shadow-2xl dark:border-rose-500/20 dark:bg-[#090b14]/95 dark:backdrop-blur-2xl md:p-8">
        <div className="space-y-4 py-2">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-500/20 text-rose-600 dark:text-rose-400">
              <XCircle className="h-8 w-8" aria-hidden="true" />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-bold text-rose-700 dark:text-rose-300">
              Cancellation Failed
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {errorMessage}
            </p>
          </div>
          <div className="pt-2">
            <Link href="/login">
              <Button
                variant="outline"
                className="w-full border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Go to Sign In
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function DeleteCancelPage(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-[#050609]">
      <Suspense
        fallback={
          <div className="text-center">
            <Loader2
              className="mx-auto h-8 w-8 animate-spin text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
            <p className="mt-4 text-slate-600 dark:text-slate-400">
              Loading...
            </p>
          </div>
        }
      >
        <DeleteCancelContent />
      </Suspense>
    </div>
  );
}
