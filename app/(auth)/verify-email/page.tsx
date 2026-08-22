'use client';

import { CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';

import { isAuthBridgeEnabled } from '@/lib/auth/auth-bridge-flag';
import { useLocale } from '@/lib/context/locale-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function VerifyEmailContent(): JSX.Element {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { t } = useLocale();

  const [status, setStatus] = useState<
    'loading' | 'success' | 'error' | 'missing'
  >('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const verifyEmail = async (): Promise<void> => {
      if (!token) {
        setStatus('missing');
        return;
      }

      try {
        setStatus('loading');
        // Bridge path (Session 4B-21, DECISION-LOG.md F56): this verifies a
        // pending registration's email, before any session ever exists — no
        // session-cache refresh applies (Entry Criterion 1 doesn't apply).
        const endpoint = isAuthBridgeEnabled()
          ? '/api/auth/token-verify-email'
          : '/api/auth/verify-email';
        const response = await fetch(`${endpoint}?token=${token}`);

        if (response.ok) {
          setStatus('success');
        } else {
          const data = await response.json();
          setError(data.error || t('Invalid or expired token'));
          setStatus('error');
        }
      } catch (err) {
        console.error(err);
        setError(t('Verification failed'));
        setStatus('error');
      }
    };

    verifyEmail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="w-full max-w-md space-y-6">
      <Card className="space-y-6 border-slate-200 bg-white p-6 text-center shadow-2xl dark:border-slate-800/80 dark:bg-[#090b14]/95 dark:backdrop-blur-2xl md:p-8">
        {status === 'loading' && (
          <div className="space-y-4 py-8">
            <div className="flex justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-200">
              {t('Verifying your email address...')}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {t('Please wait while we activate your account permissions.')}
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4 py-6">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                {t('Email Successfully Verified!')}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {t(
                  'Your DavinTrade account is fully verified and ready for live market telemetry.'
                )}
              </p>
            </div>

            <Button asChild className="w-full">
              <Link
                href="/login"
                className="flex items-center justify-center gap-1.5"
              >
                {t('Continue to Sign In')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4 py-6">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-500/20 text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-8 w-8" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-rose-700 dark:text-rose-300">
                {t('Verification Failed')}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {error || t('The token might be expired or already used.')}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button asChild className="w-full">
                <Link href="/verify-email/pending">
                  {t('Request New Verification Link')}
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">{t('Back to Login')}</Link>
              </Button>
            </div>
          </div>
        )}

        {status === 'missing' && (
          <div className="space-y-4 py-6">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-8 w-8" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-amber-700 dark:text-amber-300">
                {t('Verification link missing')}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {t(
                  'Please click the link in your verification email, or sign in to request a new one.'
                )}
              </p>
            </div>
            <Button asChild className="w-full">
              <Link href="/login">{t('Go to Sign In')}</Link>
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function VerifyEmailPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
