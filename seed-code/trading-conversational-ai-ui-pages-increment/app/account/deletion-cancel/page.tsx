'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Home,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLocale } from '@/lib/context/locale-context';

function DeletionCancelContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { t } = useLocale();

  const [status, setStatus] = useState<'processing' | 'success' | 'error'>(
    token ? 'processing' : 'error'
  );
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage(t('No cancellation token provided.'));
      return;
    }

    const cancelDeletion = async () => {
      try {
        const res = await fetch('/api/user/account/deletion-cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.message || t('Invalid or expired cancellation link.')
          );
        }

        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || t('Failed to cancel account deletion.'));
      }
    };

    cancelDeletion();
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
          {t('Account Deletion Cancelled')}
        </h1>
      </div>

      <Card className="space-y-6 border-slate-200 bg-white p-6 text-center shadow-2xl md:p-8 dark:border-slate-800/80 dark:bg-[#090b14]/95 dark:backdrop-blur-2xl">
        {status === 'processing' && (
          <div className="space-y-4 py-6">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-amber-600 dark:text-amber-400" />
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {t('Processing cancellation request...')}
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-8 w-8" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                {t('Your Account Remains Active & Safe')}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {t(
                  'The scheduled deletion process has been terminated. All your workspaces and alert configurations are preserved.'
                )}
              </p>
            </div>

            <div className="pt-2">
              <Link href="/dashboard">
                <Button className="w-full bg-amber-500 font-bold text-slate-950 hover:bg-amber-400">
                  <Home className="mr-2 h-4 w-4" />
                  {t('Return to Dashboard')}
                </Button>
              </Link>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-500/20 text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-8 w-8" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-rose-700 dark:text-rose-300">
                {t('Cancellation Failed')}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {message || t('The token might be invalid or expired.')}
              </p>
            </div>

            <div className="pt-2">
              <Link href="/login">
                <Button
                  variant="outline"
                  className="w-full border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {t('Go to Login')}
                </Button>
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function AccountDeletionCancelPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-slate-900 dark:bg-[#050609] dark:text-slate-100">
      <Suspense fallback={null}>
        <DeletionCancelContent />
      </Suspense>
    </div>
  );
}
