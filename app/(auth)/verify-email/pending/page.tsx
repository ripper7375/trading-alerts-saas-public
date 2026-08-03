'use client';

import {
  Mail,
  Loader2,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';

import { isAuthBridgeEnabled } from '@/lib/auth/auth-bridge-flag';

function VerifyEmailPendingContent(): JSX.Element {
  const searchParams = useSearchParams();
  // ✅ FIX: Decode URL-encoded email parameter (e.g., ripper7375%40gmail.com → ripper7375@gmail.com)
  const emailFromUrl = decodeURIComponent(searchParams.get('email') || '');

  // State for email - allows manual entry if missing from URL
  const [email, setEmail] = useState(emailFromUrl);
  const [showEmailInput, setShowEmailInput] = useState(!emailFromUrl);

  const [resendStatus, setResendStatus] = useState<
    'idle' | 'loading' | 'success' | 'error' | 'rate_limited'
  >('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [countdown, setCountdown] = useState(0);

  // Update email when URL changes
  useEffect(() => {
    if (emailFromUrl) {
      setEmail(emailFromUrl); // Already decoded above
      setShowEmailInput(false);
    }
  }, [emailFromUrl]);

  // Countdown timer for rate limiting
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
      setErrorMessage('Please enter a valid email address.');
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
        // Reset to idle after 5 seconds
        setTimeout(() => setResendStatus('idle'), 5000);
      } else if (response.status === 429) {
        setResendStatus('rate_limited');
        setCountdown(data.retryAfter || 60);
        setErrorMessage(data.error || 'Please wait before resending.');
      } else {
        setResendStatus('error');
        setErrorMessage(
          data.error || 'Failed to resend verification email. Please try again.'
        );
      }
    } catch (error) {
      console.error('Resend error:', error);
      setResendStatus('error');
      setErrorMessage(
        'Network error. Please check your connection and try again.'
      );
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="rounded-lg bg-white p-8 shadow-xl">
        <div className="text-center">
          {/* Email Icon */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
            <Mail className="h-8 w-8 text-indigo-600" />
          </div>

          {/* Title */}
          <h2 className="mb-2 text-2xl font-bold text-gray-900">
            Check your email
          </h2>

          {/* Description */}
          <p className="mb-2 text-gray-600">
            We&apos;ve sent a verification link to:
          </p>

          {/* Email Display or Input */}
          {!showEmailInput && email ? (
            <div className="mb-6">
              <p className="break-all font-medium text-indigo-600">{email}</p>
              <button
                onClick={() => setShowEmailInput(true)}
                className="mt-2 text-xs text-gray-500 hover:text-gray-700"
              >
                Wrong email?
              </button>
            </div>
          ) : (
            <div className="mb-6">
              <label htmlFor="email-input" className="sr-only">
                Email address
              </label>
              <input
                id="email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-2 text-xs text-gray-500">
                Enter the email you used to register
              </p>
            </div>
          )}

          {/* Instructions */}
          <div className="mb-6 rounded-lg bg-gray-50 p-4 text-left">
            <h3 className="mb-2 font-medium text-gray-900">Next steps:</h3>
            <ol className="list-inside list-decimal space-y-2 text-sm text-gray-600">
              <li>Check your email inbox (and spam folder)</li>
              <li>Click the verification link in the email</li>
              <li>You&apos;ll be redirected to your dashboard</li>
            </ol>
          </div>

          {/* Resend Section */}
          <div className="border-t border-gray-200 pt-6">
            <p className="mb-4 text-sm text-gray-600">
              Didn&apos;t receive the email?
            </p>

            {/* Status Messages */}
            {resendStatus === 'success' && (
              <div className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-green-50 px-4 py-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-medium">
                  ✓ Verification email sent! Check your inbox.
                </span>
              </div>
            )}

            {resendStatus === 'error' && (
              <div className="mb-4 flex items-start justify-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-red-600">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <span className="text-left text-sm">{errorMessage}</span>
              </div>
            )}

            {resendStatus === 'rate_limited' && (
              <div className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-amber-50 px-4 py-2 text-amber-600">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm font-medium">
                  Please wait {countdown} seconds before resending
                </span>
              </div>
            )}

            {/* Resend Button */}
            <button
              onClick={handleResendEmail}
              disabled={
                resendStatus === 'loading' ||
                resendStatus === 'rate_limited' ||
                !email ||
                !email.includes('@')
              }
              className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resendStatus === 'loading' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : resendStatus === 'rate_limited' ? (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Resend in {countdown}s
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Resend verification email
                </>
              )}
            </button>

            {!email && (
              <p className="mt-2 text-xs text-red-600">
                Please enter your email address above
              </p>
            )}
          </div>

          {/* Back to Login Link */}
          <div className="mt-6 border-t border-gray-200 pt-6">
            <p className="text-sm text-gray-600">
              Already verified?{' '}
              <Link
                href="/login"
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Sign in
              </Link>
            </p>
          </div>

          {/* Wrong Email Link */}
          <div className="mt-4">
            <Link
              href="/register"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Need to register with a different address?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPendingPage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md">
          <div className="rounded-lg bg-white p-8 shadow-xl">
            <div className="py-8 text-center">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-indigo-600" />
              <p className="mt-4 text-gray-600">Loading...</p>
            </div>
          </div>
        </div>
      }
    >
      <VerifyEmailPendingContent />
    </Suspense>
  );
}
