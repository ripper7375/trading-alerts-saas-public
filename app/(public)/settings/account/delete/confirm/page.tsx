'use client';

import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLocale } from '@/lib/context/locale-context';

/**
 * Account deletion confirmation landing page — the destination for the
 * confirm link sent in a deletion request email. Deliberately reachable
 * without a session: the user may be on a different device, logged out, or
 * have an expired session by the time they click the link.
 *
 * URL is /settings/account/delete/confirm (route groups are transparent to
 * the URL), but the FILE lives outside app/(dashboard)/ on purpose — that
 * group's own layout.tsx does a server-side `getServerSession` + `redirect`
 * on every page it wraps, which would send a logged-out visitor to /login
 * before this page ever rendered, regardless of middleware.ts's own
 * exact-pathname allow-list for this route (which only stops the earlier,
 * edge-level redirect — the layout-level one is a separate check). Both
 * layers had to be addressed for this page to actually be public.
 *
 * Human-in-the-loop gate: `POST /api/user/account/deletion-confirm` is
 * never fired on page load — only after an explicit click, so an email
 * preview prefetcher or security scanner visiting this URL can't trigger it.
 * Session 9-2 restyled the visuals to DavinTrade branding; seed-code's own
 * version of this page auto-executes the deletion in a useEffect on mount
 * with no confirmation step at all -- NOT ported, per this session's own
 * Decision 5 (Davin-approved) that this gate must be retained.
 */

type ConfirmState =
  | 'idle'
  | 'submitting'
  | 'success'
  | 'error'
  | 'missing-token';

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

function DeleteConfirmContent(): JSX.Element {
  const { t } = useLocale();
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
            t(
              'settings.account_delete.error_confirm_generic',
              'Failed to confirm account deletion. Please try again.'
            )
        );
        setState('error');
        return;
      }

      setState('success');
    } catch (err) {
      console.error('Account deletion confirm error:', err);
      setErrorMessage(
        t(
          'settings.account_delete.error_confirm_generic',
          'Failed to confirm account deletion. Please try again.'
        )
      );
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
        className="w-full max-w-md outline-none"
      >
        <BrandHeader />
        <Card className="space-y-6 border-amber-500/30 bg-white p-6 text-center shadow-2xl dark:border-amber-500/20 dark:bg-[#090b14]/95 dark:backdrop-blur-2xl md:p-8">
          <div className="space-y-4 py-2">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-8 w-8" aria-hidden="true" />
              </div>
            </div>
            <div className="space-y-1">
              <h1 className="text-base font-bold text-amber-700 dark:text-amber-300">
                {t(
                  'settings.account_delete.invalid_missing_token',
                  'Invalid or Missing Token'
                )}
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {t(
                  'settings.account_delete.invalid_missing_token_desc',
                  'This confirmation link is missing its token. Please use the exact link from your account deletion email, or sign in and request deletion again from Account Settings.'
                )}
              </p>
            </div>
            <div className="pt-2">
              <Link href="/login">
                <Button
                  variant="outline"
                  className="w-full border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {t('settings.account_delete.go_to_sign_in', 'Go to Sign In')}
                </Button>
              </Link>
            </div>
          </div>
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
                {t(
                  'settings.account_delete.scheduled_title',
                  'Account Scheduled for Deletion'
                )}
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {t(
                  'settings.account_delete.scheduled_desc',
                  'Your account will be permanently deleted in 24 hours. Changed your mind? You can still cancel during this window — use the cancel link in your email, or sign in and cancel from Account Settings.'
                )}
              </p>
            </div>
            <div className="pt-2">
              <Link href="/login">
                <Button
                  variant="outline"
                  className="w-full border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {t(
                    'settings.account_delete.return_to_sign_in',
                    'Return to Sign In'
                  )}
                </Button>
              </Link>
            </div>
          </div>
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
                {t(
                  'settings.account_delete.confirmation_failed',
                  'Confirmation Failed'
                )}
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
                  {t('settings.account_delete.go_to_sign_in', 'Go to Sign In')}
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // idle / submitting — the human-in-the-loop confirmation gate
  return (
    <div
      ref={announceRef}
      tabIndex={-1}
      className="w-full max-w-md outline-none"
    >
      <BrandHeader />
      <Card className="space-y-6 border-rose-500/30 bg-white p-6 text-center shadow-2xl dark:border-rose-500/20 dark:bg-[#090b14]/95 dark:backdrop-blur-2xl md:p-8">
        <div className="space-y-4 py-2">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-500/20 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-8 w-8" aria-hidden="true" />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-bold text-rose-700 dark:text-rose-300">
              {t(
                'settings.account_delete.confirm_title',
                'Confirm Account Deletion'
              )}
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {t(
                'settings.account_delete.confirm_desc',
                'You requested to delete your account. This confirmation link is valid for 7 days from your original request. Clicking "Confirm Account Deletion" below schedules your account for permanent deletion in 24 hours — you\'ll still be able to cancel during that window.'
              )}
            </p>
          </div>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={state === 'submitting'}
              aria-busy={state === 'submitting'}
              className="flex-1 bg-rose-600 font-bold hover:bg-rose-500"
            >
              {state === 'submitting' ? (
                <>
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  {t('settings.account_delete.confirming', 'Confirming...')}
                </>
              ) : (
                t(
                  'settings.account_delete.confirm_button',
                  'Confirm Account Deletion'
                )
              )}
            </Button>
            <Link href="/settings/account" className="flex-1">
              <Button
                variant="outline"
                disabled={state === 'submitting'}
                className="w-full border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {t(
                  'settings.account_delete.cancel_keep_account',
                  'Cancel, Keep My Account'
                )}
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

function DeleteConfirmFallback(): JSX.Element {
  const { t } = useLocale();
  return (
    <div className="text-center">
      <Loader2
        className="mx-auto h-8 w-8 animate-spin text-amber-600 dark:text-amber-400"
        aria-hidden="true"
      />
      <p className="mt-4 text-slate-600 dark:text-slate-400">
        {t('Loading...', 'Loading...')}
      </p>
    </div>
  );
}

export default function DeleteConfirmPage(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-[#050609]">
      <Suspense fallback={<DeleteConfirmFallback />}>
        <DeleteConfirmContent />
      </Suspense>
    </div>
  );
}
