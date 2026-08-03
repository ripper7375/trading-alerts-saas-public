'use client';

import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Shield,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, getSession } from 'next-auth/react';
import { useState, useEffect, useRef, Suspense } from 'react';

import { isAuthBridgeEnabled } from '@/lib/auth/auth-bridge-flag';

function TwoFactorVerificationContent(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isBackupCode, setIsBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState('');

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    if (!isBackupCode && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [isBackupCode]);

  // Redirect if no token
  useEffect(() => {
    if (!token) {
      router.push('/login');
    }
  }, [token, router]);

  const handleCodeChange = (index: number, value: string): void => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError(null);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
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

    // Focus the next empty input or the last one
    const nextEmptyIndex = newCode.findIndex((c) => c === '');
    if (nextEmptyIndex !== -1) {
      inputRefs.current[nextEmptyIndex]?.focus();
    } else {
      inputRefs.current[5]?.focus();
      // Auto-submit if all filled
      handleSubmit(newCode.join(''));
    }
  };

  const handleSubmit = async (codeValue?: string): Promise<void> => {
    const verificationCode = isBackupCode
      ? backupCode
      : codeValue || code.join('');

    if (!isBackupCode && verificationCode.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    if (isBackupCode && verificationCode.length < 8) {
      setError('Please enter a valid backup code');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (!token) {
        setError('Session expired. Please log in again.');
        return;
      }

      // Verify the 2FA code
      const response = await fetch('/api/user/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode, token }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Invalid verification code');
        // Clear code on error
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
        // Matches the non-bridge branch below: the 2FA code was already
        // verified above regardless of this completion call's own result, so
        // the user sees success and is sent to the dashboard either way (its
        // own server-side session check is the real gate).
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
        // If direct login fails, redirect to login page
        // The user will need to log in again but 2FA is now verified
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
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state
  if (isSuccess) {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-lg bg-card p-8 shadow-xl">
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-foreground">
              Verified!
            </h2>
            <p className="text-muted-foreground">Redirecting to dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-lg bg-card p-8 shadow-xl">
          <div className="py-8 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-lg bg-card p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="bg-primary/10 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">
            Two-Factor Authentication
          </h1>
          <p className="text-muted-foreground">
            {isBackupCode
              ? 'Enter one of your backup codes'
              : 'Enter the 6-digit code from your authenticator app'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="animate-in slide-in-from-top mb-6 rounded-lg border-l-4 border-red-500 bg-red-50 p-4 duration-300 dark:bg-red-900/20">
            <div className="flex items-start gap-3">
              <AlertCircle
                className="mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400"
                size={20}
              />
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                {error}
              </p>
            </div>
          </div>
        )}

        {!isBackupCode ? (
          <>
            {/* 6-digit code input */}
            <div className="mb-6 flex justify-center gap-2">
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
                  className="h-14 w-12 rounded-lg border bg-background text-center text-2xl font-bold text-foreground transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Digit ${index + 1}`}
                />
              ))}
            </div>

            {/* Submit button */}
            <button
              onClick={() => handleSubmit()}
              disabled={isSubmitting || code.some((c) => c === '')}
              className="hover:bg-primary/90 w-full rounded-md bg-primary py-3 text-lg font-semibold text-primary-foreground shadow-lg transition-all duration-200 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 inline h-5 w-5 animate-spin" />
                  <span className="opacity-70">Verifying...</span>
                </>
              ) : (
                'Verify'
              )}
            </button>
          </>
        ) : (
          <>
            {/* Backup code input */}
            <div className="mb-6">
              <input
                type="text"
                placeholder="xxxx-xxxx"
                value={backupCode}
                onChange={(e) => {
                  setBackupCode(e.target.value);
                  setError(null);
                }}
                disabled={isSubmitting}
                className="w-full rounded-lg border bg-background px-4 py-3 text-center font-mono text-xl text-foreground transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                aria-label="Backup code"
              />
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Enter one of your 8-character backup codes
              </p>
            </div>

            {/* Submit button */}
            <button
              onClick={() => handleSubmit()}
              disabled={isSubmitting || backupCode.length < 8}
              className="hover:bg-primary/90 w-full rounded-md bg-primary py-3 text-lg font-semibold text-primary-foreground shadow-lg transition-all duration-200 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 inline h-5 w-5 animate-spin" />
                  <span className="opacity-70">Verifying...</span>
                </>
              ) : (
                'Use Backup Code'
              )}
            </button>
          </>
        )}

        {/* Toggle between TOTP and backup code */}
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsBackupCode(!isBackupCode);
              setError(null);
              setCode(['', '', '', '', '', '']);
              setBackupCode('');
            }}
            className="text-sm text-primary hover:underline"
          >
            {isBackupCode
              ? 'Use authenticator app instead'
              : 'Use a backup code instead'}
          </button>
        </div>

        {/* Back to login */}
        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} />
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function TwoFactorVerificationPage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md">
          <div className="rounded-lg bg-card p-8 shadow-xl">
            <div className="py-8 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </div>
        </div>
      }
    >
      <TwoFactorVerificationContent />
    </Suspense>
  );
}
