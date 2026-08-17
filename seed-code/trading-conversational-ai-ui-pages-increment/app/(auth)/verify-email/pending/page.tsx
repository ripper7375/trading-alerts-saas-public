'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Mail, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/lib/context/locale-context';

function VerifyEmailPendingContent() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const emailFromUrl = decodeURIComponent(searchParams.get('email') || '');

  const [email, setEmail] = useState(emailFromUrl);
  const [showEmailInput, setShowEmailInput] = useState(!emailFromUrl);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (emailFromUrl) {
      setEmail(emailFromUrl);
      setShowEmailInput(false);
    }
  }, [emailFromUrl]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSending(true);
    setError('');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.message || t('Failed to send verification email.')
        );
      }

      setSent(true);
    } catch (err: any) {
      setError(err.message || t('Error sending verification email.'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050609] p-4 text-slate-100">
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
            {t('Check Your Email')}
          </h1>
          <p className="text-xs text-slate-400">
            {t('We sent a verification link to your registered email address.')}
          </p>
        </div>

        <Card className="space-y-6 border-slate-800/80 bg-[#090b14]/95 p-6 text-center shadow-2xl backdrop-blur-2xl md:p-8">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/20 text-amber-400">
              <Mail className="h-7 w-7" />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-200">
              {t('Verification Link Sent')}
            </h3>
            {!showEmailInput && email ? (
              <div>
                <p className="text-xs leading-relaxed text-slate-400">
                  {t("We've sent a verification link to:")}
                </p>
                <p className="mt-1 font-semibold break-all text-amber-400">
                  {email}
                </p>
                <button
                  type="button"
                  onClick={() => setShowEmailInput(true)}
                  className="mt-1 text-[11px] text-slate-500 hover:text-slate-300"
                >
                  {t('Wrong email?')}
                </button>
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-slate-400">
                {t(
                  'Please click the link in your email to activate your account. If you do not see it within a few minutes, check your spam or junk folder.'
                )}
              </p>
            )}
          </div>

          {sent ? (
            <div className="space-y-1 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-xs text-emerald-300">
              <div className="flex items-center justify-center gap-1.5 font-bold">
                <CheckCircle2 className="h-4 w-4" />
                <span>{t('New Link Dispatched!')}</span>
              </div>
              <p className="text-[11px] text-slate-400">
                {t('Please check your inbox again.')}
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleResend}
              className="space-y-3 border-t border-slate-800/80 pt-4 text-left"
            >
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-950/40 p-2.5 text-xs text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {(showEmailInput || !email) && (
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">
                    {t(
                      "Didn't receive it? Enter email to resend",
                      "Didn't receive an email? Enter your email to resend"
                    )}
                  </Label>
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-slate-800 bg-[#06080e] text-slate-200"
                    required
                  />
                </div>
              )}
              <Button
                type="submit"
                disabled={isSending || !email}
                className="w-full bg-amber-500 font-bold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${isSending ? 'animate-spin' : ''}`}
                />
                {isSending ? t('Sending...') : t('Resend Verification Email')}
              </Button>
            </form>
          )}

          <div className="space-y-1.5 border-t border-slate-800/80 pt-3 text-center">
            <p className="text-xs text-slate-400">
              {t('Already verified?')}{' '}
              <Link
                href="/login"
                className="font-semibold text-amber-400 hover:underline"
              >
                {t('Sign in')}
              </Link>
            </p>
            <Link
              href="/register"
              className="block text-[11px] text-slate-500 hover:text-slate-300"
            >
              {t('Need to register with a different address?')}
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function VerifyEmailPendingPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailPendingContent />
    </Suspense>
  );
}
