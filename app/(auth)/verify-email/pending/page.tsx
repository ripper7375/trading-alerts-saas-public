'use client';

import { Mail, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';

import { isAuthBridgeEnabled } from '@/lib/auth/auth-bridge-flag';
import { useLocale } from '@/lib/context/locale-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function VerifyEmailPendingContent(): JSX.Element {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const emailFromUrl = decodeURIComponent(searchParams.get('email') || '');

  const [email, setEmail] = useState(emailFromUrl);
  const [showEmailInput, setShowEmailInput] = useState(!emailFromUrl);

  const [resendStatus, setResendStatus] = useState<
    'idle' | 'loading' | 'success' | 'error' | 'rate_limited'
  >('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (emailFromUrl) {
      setEmail(emailFromUrl);
      setShowEmailInput(false);
    }
  }, [emailFromUrl]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (countdown === 0 && resendStatus === 'rate_limited') {
      setResendStatus('idle');
    }
    return undefined;
  }, [countdown, resendStatus]);

  const handleResendEmail = async (): Promise<void> => {
    if (!email || !email.includes('@')) {
      setErrorMessage(t('Please enter a valid email address.'));
      setResendStatus('error');
      return;
    }

    setResendStatus('loading');
    setErrorMessage('');

    try {
      // Bridge path (Session 4B-21, DECISION-LOG.md F56): never logs the
      // user in, so no session-cache refresh is needed (Entry Criterion 1
      // only applies to login/2FA-completion/logout).
      const endpoint = isAuthBridgeEnabled()
        ? '/api/auth/token-resend-verification'
        : '/api/auth/resend-verification';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setResendStatus('success');
        setTimeout(() => setResendStatus('idle'), 5000);
      } else if (response.status === 429) {
        setResendStatus('rate_limited');
        setCountdown(data.retryAfter || 60);
        setErrorMessage(data.error || t('Please wait before resending.'));
      } else {
        setResendStatus('error');
        setErrorMessage(
          data.error ||
            t('Failed to resend verification email. Please try again.')
        );
      }
    } catch (error) {
      console.error('Resend error:', error);
      setResendStatus('error');
      setErrorMessage(
        t('Network error. Please check your connection and try again.')
      );
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <Card className="space-y-6 border-slate-200 bg-white p-6 text-center shadow-2xl dark:border-slate-800/80 dark:bg-[#090b14]/95 dark:backdrop-blur-2xl md:p-8">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/20 text-amber-600 dark:text-amber-400">
            <Mail className="h-7 w-7" />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200">
            {t('Check your email')}
          </h3>
          {!showEmailInput && email ? (
            <div>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {t("We've sent a verification link to:")}
              </p>
              <p className="mt-1 break-all font-semibold text-amber-600 dark:text-amber-400">
                {email}
              </p>
              <button
                type="button"
                onClick={() => setShowEmailInput(true)}
                className="mt-1 text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
              >
                {t('Wrong email?')}
              </button>
            </div>
          ) : (
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {t(
                'Please click the link in your email to activate your account. If you do not see it within a few minutes, check your spam or junk folder.'
              )}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-left dark:border-slate-800 dark:bg-[#06080e]">
          <h4 className="mb-1.5 text-xs font-bold text-slate-900 dark:text-slate-200">
            {t('Next steps:')}
          </h4>
          <ol className="list-inside list-decimal space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
            <li>{t('Check your email inbox (and spam folder)')}</li>
            <li>{t('Click the verification link in the email')}</li>
            <li>{t("You'll be redirected to sign in")}</li>
          </ol>
        </div>

        {resendStatus === 'success' ? (
          <div className="space-y-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <div className="flex items-center justify-center gap-1.5 font-bold">
              <CheckCircle2 className="h-4 w-4" />
              <span>{t('New Link Dispatched!')}</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              {t('Please check your inbox again.')}
            </p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleResendEmail();
            }}
            className="space-y-3 border-t border-slate-200 pt-4 text-left dark:border-slate-800/80"
          >
            {(resendStatus === 'error' || resendStatus === 'rate_limited') && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  {resendStatus === 'rate_limited'
                    ? `${errorMessage} (${countdown}s)`
                    : errorMessage}
                </span>
              </div>
            )}
            {(showEmailInput || !email) && (
              <div className="space-y-1">
                <Label className="text-xs text-slate-700 dark:text-slate-300">
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
                  className="border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-[#06080e] dark:text-slate-200"
                  required
                />
              </div>
            )}
            <Button
              type="submit"
              disabled={
                resendStatus === 'loading' ||
                resendStatus === 'rate_limited' ||
                !email ||
                !email.includes('@')
              }
              className="w-full"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${resendStatus === 'loading' ? 'animate-spin' : ''}`}
              />
              {resendStatus === 'loading'
                ? t('Sending...')
                : resendStatus === 'rate_limited'
                  ? `${t('Resend in')} ${countdown}s`
                  : t('Resend Verification Email')}
            </Button>
          </form>
        )}

        <div className="space-y-1.5 border-t border-slate-200 pt-3 text-center dark:border-slate-800/80">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {t('Already verified?')}{' '}
            <Link
              href="/login"
              className="font-semibold text-amber-600 hover:underline dark:text-amber-400"
            >
              {t('Sign in')}
            </Link>
          </p>
          <Link
            href="/register"
            className="block text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
          >
            {t('Need to register with a different address?')}
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function VerifyEmailPendingPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <VerifyEmailPendingContent />
    </Suspense>
  );
}
