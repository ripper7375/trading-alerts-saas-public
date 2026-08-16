'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Trash2, AlertCircle, Loader2, Home, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLocale } from '@/lib/context/locale-context';

function DeletionConfirmContent() {
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
      setMessage(t('No confirmation token provided.'));
      return;
    }

    const confirmDeletion = async () => {
      try {
        const res = await fetch('/api/user/account/deletion-confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.message || t('Invalid or expired deletion confirmation link.')
          );
        }

        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || t('Failed to delete account.'));
      }
    };

    confirmDeletion();
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
          <span className="bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-xl font-black text-transparent">
            DavinTrade AI
          </span>
        </Link>
        <h1 className="text-2xl font-bold text-slate-100">
          {t('Account Deletion Confirmation')}
        </h1>
      </div>

      <Card className="space-y-6 border-slate-800/80 bg-[#090b14]/95 p-6 text-center shadow-2xl backdrop-blur-2xl md:p-8">
        {status === 'processing' && (
          <div className="space-y-4 py-6">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-rose-400" />
            <p className="text-xs text-slate-400">
              {t('Executing permanent account deletion...')}
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-500/20 text-rose-400">
                <Trash2 className="h-8 w-8" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-100">
                {t('Account Permanently Deleted')}
              </h3>
              <p className="text-xs text-slate-400">
                {t(
                  'Your profile data, authentication sessions, and saved settings have been securely purged.'
                )}
              </p>
            </div>

            <div className="pt-2">
              <Link href="/">
                <Button className="w-full bg-slate-800 font-bold text-slate-200 hover:bg-slate-700">
                  <Home className="mr-2 h-4 w-4" />
                  {t('Return to Homepage')}
                </Button>
              </Link>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-500/20 text-rose-400">
                <AlertCircle className="h-8 w-8" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-rose-300">
                {t('Deletion Request Failed')}
              </h3>
              <p className="text-xs text-slate-400">
                {message || t('The link is invalid or has expired.')}
              </p>
            </div>

            <div className="pt-2">
              <Link href="/login">
                <Button
                  variant="outline"
                  className="w-full border-slate-800 text-slate-300"
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

export default function AccountDeletionConfirmPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050609] p-4 text-slate-100">
      <Suspense fallback={null}>
        <DeletionConfirmContent />
      </Suspense>
    </div>
  );
}
