'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  MailCheck,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { t } = useLocale();

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>(
    token ? 'verifying' : 'error'
  );
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage(t('No verification token provided.'));
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(
          `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
          {
            method: 'GET',
          }
        );

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.message || t('Verification token is invalid or expired.')
          );
        }

        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(err.message || t('Failed to verify email.'));
      }
    };

    verify();
  }, [token, t]);

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="relative flex h-10 w-10 overflow-hidden rounded-xl border border-amber-500/40 bg-amber-500/20 p-0.5 shadow-lg shadow-amber-500/20">
            <Image
              src="/davintrade-ai-icon.png"
              alt="DavinTrade AI"
              width={40}
              height={40}
              className="h-full w-full rounded-[9px] object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <span className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 bg-clip-text text-xl font-black text-transparent dark:from-amber-400 dark:to-amber-200">
            DavinTrade AI
          </span>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {t('Email Verification')}
        </h1>
      </div>

      <Card className="space-y-6 border-slate-200 bg-white p-6 text-center shadow-2xl md:p-8 dark:border-slate-800/80 dark:bg-[#090b14]/95 dark:backdrop-blur-2xl">
        {status === 'verifying' && (
          <div className="space-y-4 py-8">
            <div className="flex justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-200">
              {t('Verifying your email address...')}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {t('Please hold on while we activate your account permissions.')}
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

            <Link href="/welcome" className="block pt-2">
              <Button className="w-full bg-amber-500 py-5 font-bold text-slate-950 hover:bg-amber-400">
                <span>{t('Continue to Onboarding')}</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
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
                {errorMessage ||
                  t('The token might be expired or already used.')}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Link href="/verify-email/pending">
                <Button className="w-full bg-amber-500 font-bold text-slate-950 hover:bg-amber-400">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t('Request New Verification Link')}
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  variant="outline"
                  className="w-full border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {t('Back to Login')}
                </Button>
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-slate-900 dark:bg-[#050609] dark:text-slate-100">
      <Suspense fallback={null}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
