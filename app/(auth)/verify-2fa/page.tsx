'use client';

import { AlertCircle, CheckCircle2, Loader2, Shield, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState, useEffect, useRef, Suspense } from 'react';

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

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent): void => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = [...code];

    for (let i = 0; i < pastedData.length && i < 6; i++) {
      newCode[i] = pastedData[i];
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
    const verificationCode = isBackupCode ? backupCode : (codeValue || code.join(''));

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
        <div className="bg-card rounded-lg shadow-xl p-8">
          <div className="text-center py-8">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4 animate-bounce">
              <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
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
        <div className="bg-card rounded-lg shadow-xl p-8">
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-card rounded-lg shadow-xl p-8">
        <div className="text-center mb-6">
          <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-foreground">
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
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg p-4 mb-6 animate-in slide-in-from-top duration-300">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
              <p className="text-red-800 dark:text-red-200 font-medium text-sm">{error}</p>
            </div>
          </div>
        )}

        {!isBackupCode ? (
          <>
            {/* 6-digit code input */}
            <div className="flex justify-center gap-2 mb-6">
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
                  className="w-12 h-14 text-center text-2xl font-bold border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={`Digit ${index + 1}`}
                />
              ))}
            </div>

            {/* Submit button */}
            <button
              onClick={() => handleSubmit()}
              disabled={isSubmitting || code.some((c) => c === '')}
              className="w-full bg-primary hover:bg-primary/90 py-3 text-lg font-semibold rounded-md text-primary-foreground shadow-lg transition-all duration-200 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="inline h-5 w-5 animate-spin mr-2" />
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
                className="w-full px-4 py-3 text-center text-xl font-mono border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all disabled:opacity-50"
                aria-label="Backup code"
              />
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Enter one of your 8-character backup codes
              </p>
            </div>

            {/* Submit button */}
            <button
              onClick={() => handleSubmit()}
              disabled={isSubmitting || backupCode.length < 8}
              className="w-full bg-primary hover:bg-primary/90 py-3 text-lg font-semibold rounded-md text-primary-foreground shadow-lg transition-all duration-200 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="inline h-5 w-5 animate-spin mr-2" />
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
            {isBackupCode ? 'Use authenticator app instead' : 'Use a backup code instead'}
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
          <div className="bg-card rounded-lg shadow-xl p-8">
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
            </div>
          </div>
        </div>
      }
    >
      <TwoFactorVerificationContent />
    </Suspense>
  );
}
