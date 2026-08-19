'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, ArrowLeft, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/lib/context/locale-context';

export default function ForgotPasswordPage() {
  const { t } = useLocale();
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
  };

  const handleResend = (): void => {
    setIsResending(true);
    setTimeout(() => setIsResending(false), 1000);
  };

  const handleTryAnother = (): void => {
    setIsSubmitted(false);
    setEmail('');
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 p-4 select-none dark:bg-[#06070a]">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl backdrop-blur-xl dark:border-slate-800/80 dark:bg-[#0b0e17]">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="relative h-12 w-12 overflow-hidden rounded-xl shadow-lg ring-2 shadow-amber-500/10 ring-amber-500/40">
            <Image
              src="/DavinTrade_Logo.jpg"
              alt="DavinTrade Logo"
              fill
              className="object-cover"
              priority
            />
          </div>
          <h2 className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
            {t('Reset Password')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('Enter your account email to receive reset instructions')}
          </p>
        </div>

        {isSubmitted ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {t('Check Your Email')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t(
                "We've sent a password reset link to",
                'We have sent a password reset link to'
              )}{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {email}
              </strong>
              . {t('Please follow the instructions in the email.')}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleResend}
                disabled={isResending}
                className="dark:border-slate-750 h-9 flex-1 border-slate-200 bg-slate-100 text-xs text-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
              >
                <RefreshCw
                  className={`mr-1.5 h-3.5 w-3.5 ${isResending ? 'animate-spin' : ''}`}
                />
                {isResending ? t('Resending...') : t('Resend Email')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleTryAnother}
                className="dark:border-slate-750 h-9 flex-1 border-slate-200 bg-transparent text-xs text-slate-700 dark:text-slate-300"
              >
                {t('Try Another Email')}
              </Button>
            </div>
            <Button
              variant="outline"
              asChild
              className="dark:border-slate-750 h-9 w-full border-slate-200 bg-slate-100 text-xs text-slate-800 dark:bg-slate-800 dark:text-slate-200"
            >
              <Link href="/login">{t('Return to Sign In')}</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('Email Address')}
              </Label>
              <div className="relative">
                <Mail className="absolute top-3 left-3 h-4 w-4 text-slate-600 dark:text-slate-500" />
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="dark:border-slate-750 border-slate-200 bg-white pl-10 text-xs text-slate-900 dark:bg-[#06080e] dark:text-slate-100"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="h-10 w-full bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
            >
              {t('Send Reset Instructions')}
            </Button>
          </form>
        )}

        <div className="border-t border-slate-200 pt-2 text-center dark:border-slate-800/80">
          <Link
            href="/login"
            className="inline-flex items-center text-xs font-semibold text-amber-600 hover:underline dark:text-amber-400"
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> {t('Back to Sign In')}
          </Link>
        </div>
      </div>
    </div>
  );
}
