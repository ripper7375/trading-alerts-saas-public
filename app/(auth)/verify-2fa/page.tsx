'use client';

import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  ArrowLeft,
  UserCheck,
  LayoutDashboard,
  LogOut,
  KeyRound,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, getSession, signOut } from 'next-auth/react';
import { useState, useEffect, useRef, Suspense } from 'react';

import { isAuthBridgeEnabled } from '@/lib/auth/auth-bridge-flag';
import { useLocale } from '@/lib/context/locale-context';
import { Button } from '@/components/ui/button';

interface SafeUserSession {
  user?: {
    name?: string | null;
    email?: string | null;
    role?: string;
  };
}

function TwoFactorVerificationContent(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { t } = useLocale();
  const [session, setSession] = useState<SafeUserSession | null>(null);

  // Same bridge-aware logout as components/layout/app-header.tsx — calling
  // next-auth/react's signOut() alone leaves the operation-service refresh-
  // token cookie (and, for any session established before a past cookie-
  // domain change, an orphaned host-only session-token cookie signOut() can
  // no longer reach) uncleared, so this screen kept showing "Already
  // Authenticated" no matter how many times Sign Out was clicked.
  const handleSignOut = async (): Promise<void> => {
    if (isAuthBridgeEnabled()) {
      await fetch('/api/auth/token-logout', { method: 'POST' });
    }
    await signOut({ redirect: false });
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full browser navigation is deliberate, matches app-header.tsx
    window.location.href = '/login';
  };

  useEffect(() => {
    if (!token && typeof getSession === 'function') {
      void getSession().then((s) => {
        if (s?.user) setSession(s as SafeUserSession);
      });
    }
  }, [token]);

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isBackupCode, setIsBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState('');

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!isBackupCode && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [isBackupCode]);

  const handleCodeChange = (index: number, value: string): void => {
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError(null);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (value && index === 5 && newCode.every((c) => c !== '')) {
      handleSubmit(newCode.join(''));
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ): void => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent): void => {
    e.preventDefault();
    const pastedData = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 6);
    const newCode = [...code];

    for (let i = 0; i < pastedData.length && i < 6; i++) {
      newCode[i] = pastedData[i] ?? '';
    }

    setCode(newCode);

    const nextEmptyIndex = newCode.findIndex((c) => c === '');
    if (nextEmptyIndex !== -1) {
      inputRefs.current[nextEmptyIndex]?.focus();
    } else {
      inputRefs.current[5]?.focus();
      handleSubmit(newCode.join(''));
    }
  };

  const handleSubmit = async (codeValue?: string): Promise<void> => {
    const verificationCode = isBackupCode
      ? backupCode
      : codeValue || code.join('');

    if (!isBackupCode && verificationCode.length !== 6) {
      setError(t('Please enter all 6 digits'));
      return;
    }

    if (isBackupCode && verificationCode.length < 8) {
      setError(t('Please enter a valid backup code'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (!token) {
        setError(t('Session expired. Please log in again.'));
        return;
      }

      const response = await fetch('/api/user/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode, token }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t('Invalid verification code'));
        if (!isBackupCode) {
          setCode(['', '', '', '', '', '']);
          inputRefs.current[0]?.focus();
        }
        return;
      }

      if (isAuthBridgeEnabled()) {
        // Bridge path (Session 4B-21, DECISION-LOG.md F56/F57): token-login's
        // AuthService.login() handles this exact '__2fa_verified__' sentinel
        // itself (see token-login/route.ts's own comment) — completes the
        // login and sets the shared session cookie server-side. A forced
        // getSession() refresh keeps next-auth/react's client cache correct,
        // matching login-form.tsx's bridge branch (Entry Criterion 1).
        const bridgeResponse = await fetch('/api/auth/token-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: '__2fa_verified__', password: token }),
        });

        if (bridgeResponse.ok) {
          await getSession();
        }
        setIsSuccess(true);
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
        return;
      }

      // 2FA verified, complete login with special 2FA-verified credential
      const result = await signIn('credentials', {
        email: '__2fa_verified__',
        password: token,
        redirect: false,
      });

      if (result?.error) {
        setIsSuccess(true);
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      } else if (result?.ok) {
        setIsSuccess(true);
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      }
    } catch (err) {
      console.error('2FA verification error:', err);
      setError(t('Something went wrong. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl backdrop-blur-xl dark:border-slate-800/80 dark:bg-[#0b0e17]">
        <div className="py-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {t('Verified!')}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('Redirecting to dashboard...')}
          </p>
        </div>
      </div>
    );
  }

  if (!token) {
    if (session?.user) {
      const userRole = (session.user as { role?: string }).role;
      const dashboardHref = userRole === 'ADMIN' ? '/admin' : '/dashboard';

      return (
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xl dark:border-slate-800/80 dark:bg-[#0b0e17]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <UserCheck className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {t('Already Authenticated')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('You are currently signed in as')}{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {session.user.name || session.user.email}
            </span>
            . {t('Two-Factor Authentication is not pending.')}
          </p>
          <div className="space-y-3 pt-2">
            <Button asChild className="w-full" size="lg">
              <Link
                href={dashboardHref}
                className="flex items-center justify-center gap-2"
              >
                <LayoutDashboard className="h-4 w-4" />
                {t('Go to Dashboard')}
              </Link>
            </Button>
            <Button
              variant="outline"
              className="flex w-full items-center justify-center gap-2"
              onClick={() => void handleSignOut()}
            >
              <LogOut className="h-4 w-4" />
              {t('Sign Out')}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xl dark:border-slate-800/80 dark:bg-[#0b0e17]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {t('Two-Factor Authentication')}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t(
            'No active 2FA verification challenge found. Please sign in to generate a challenge.'
          )}
        </p>
        <Button asChild className="w-full" size="lg">
          <Link href="/login">{t('Return to Sign In')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl backdrop-blur-xl dark:border-slate-800/80 dark:bg-[#0b0e17]">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
          {t('Two-Factor Authentication')}
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {isBackupCode
            ? t('Enter one of your backup codes')
            : t('Enter the 6-digit code from your authenticator app')}
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <p className="font-medium text-rose-700 dark:text-rose-300">
            {error}
          </p>
        </div>
      )}

      {!isBackupCode ? (
        <>
          <div className="flex justify-center gap-2">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleCodeChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                disabled={isSubmitting}
                className="dark:border-slate-750 h-12 w-10 rounded-xl border border-slate-200 bg-slate-50 text-center font-mono text-lg font-bold text-amber-600 transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#06080e] dark:text-amber-300"
                aria-label={`Digit ${index + 1}`}
              />
            ))}
          </div>

          <button
            onClick={() => handleSubmit()}
            disabled={isSubmitting || code.some((c) => c === '')}
            className="h-10 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 transition-all hover:from-amber-400 hover:to-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('Verifying...')}
              </>
            ) : (
              t('Verify & Continue')
            )}
          </button>
        </>
      ) : (
        <>
          <div>
            <input
              type="text"
              placeholder="xxxx-xxxx"
              value={backupCode}
              onChange={(e) => {
                setBackupCode(e.target.value);
                setError(null);
              }}
              disabled={isSubmitting}
              className="dark:border-slate-750 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-center font-mono text-lg text-slate-900 transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 dark:bg-[#06080e] dark:text-slate-100"
              aria-label={t('Backup code')}
            />
            <p className="mt-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
              {t('Enter one of your 8-character backup codes')}
            </p>
          </div>

          <button
            onClick={() => handleSubmit()}
            disabled={isSubmitting || backupCode.length < 8}
            className="h-10 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 transition-all hover:from-amber-400 hover:to-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('Verifying...')}
              </>
            ) : (
              t('Use Backup Code')
            )}
          </button>
        </>
      )}

      <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xs dark:border-slate-800/80">
        <button
          type="button"
          onClick={() => {
            setIsBackupCode(!isBackupCode);
            setError(null);
            setCode(['', '', '', '', '', '']);
            setBackupCode('');
          }}
          className="flex items-center gap-1 font-semibold text-amber-600 hover:underline dark:text-amber-400"
        >
          <KeyRound className="h-3.5 w-3.5" />
          {isBackupCode ? t('Use Authenticator App') : t('Use Backup Code')}
        </button>

        <Link
          href="/login"
          className="flex items-center gap-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t('Back to Login')}
        </Link>
      </div>
    </div>
  );
}

export default function TwoFactorVerificationPage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl dark:border-slate-800/80 dark:bg-[#0b0e17]">
          <div className="py-8 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-500" />
          </div>
        </div>
      }
    >
      <TwoFactorVerificationContent />
    </Suspense>
  );
}
