'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Share2,
  ArrowRight,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLocale } from '@/lib/context/locale-context';
import { useRouter } from 'next/navigation';

function AffiliateVerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { t } = useLocale();

  const [status, setStatus] = useState<
    'pending' | 'verifying' | 'success' | 'error'
  >(token ? 'verifying' : 'pending');
  const [errorMsg, setErrorMsg] = useState('');
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('pending');
      return;
    }

    const verifyPartner = async () => {
      try {
        const res = await fetch(
          `/api/affiliate/auth/verify-email?token=${encodeURIComponent(token)}`
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.message || t('Invalid or expired partner verification link.')
          );
        }
        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        setErrorMsg(err.message || t('Verification failed.'));
      }
    };

    verifyPartner();
  }, [token, t]);

  useEffect(() => {
    if (status !== 'success') return;
    const redirect = setTimeout(() => {
      router.push('/affiliate/dashboard');
    }, 3000);
    return () => clearTimeout(redirect);
  }, [status, router]);

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
          {t('Partner Verification')}
        </h1>
      </div>

      <Card className="space-y-6 border-slate-800/80 bg-[#090b14]/95 p-6 text-center shadow-2xl backdrop-blur-2xl md:p-8">
        {status === 'pending' && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/20 text-amber-400">
                <Mail className="h-8 w-8" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-100">
                {t('Check Your Inbox')}
              </h3>
              <p className="text-xs text-slate-400">
                {t(
                  "We've sent a verification link to your inbox. Click it to activate your partner account."
                )}
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-300/90">
              {t("Didn't receive the email? Check your spam folder or")}{' '}
              <button
                type="button"
                onClick={() => setResent(true)}
                className="font-semibold underline hover:text-amber-200"
              >
                {resent ? t('Email resent!') : t('click here to resend')}
              </button>
            </div>

            <Link
              href="/affiliate/register"
              className="inline-block text-xs text-slate-400 hover:text-amber-400"
            >
              {t('← Back to registration')}
            </Link>
          </div>
        )}

        {status === 'verifying' && (
          <div className="space-y-4 py-6">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-amber-400" />
            <p className="text-xs text-slate-400">
              {t('Verifying your affiliate credentials...')}
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-emerald-300">
                {t('Partner Account Verified!')}
              </h3>
              <p className="text-xs text-slate-400">
                {t(
                  'Your affiliate account is now fully approved. You can generate custom discount codes and track payouts.'
                )}
              </p>
              <p className="text-[11px] text-slate-500">
                {t('Redirecting to your dashboard...')}
              </p>
            </div>

            <div className="pt-2">
              <Link href="/affiliate/dashboard">
                <Button className="w-full bg-amber-500 py-5 font-bold text-slate-950 hover:bg-amber-400">
                  <Share2 className="mr-2 h-4 w-4" />
                  {t('Open Partner Dashboard')}
                  <ArrowRight className="ml-2 h-4 w-4" />
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
                {t('Partner Verification Failed')}
              </h3>
              <p className="text-xs text-slate-400">
                {errorMsg || t('The token might be expired or invalid.')}
              </p>
            </div>

            <div className="pt-2">
              <Link href="/affiliate/register">
                <Button className="w-full bg-amber-500 font-bold text-slate-950 hover:bg-amber-400">
                  {t('Register Again')}
                </Button>
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function AffiliateVerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050609] p-4 text-slate-100">
      <Suspense fallback={null}>
        <AffiliateVerifyContent />
      </Suspense>
    </div>
  );
}
