'use client';

import { Mail, Loader2, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';

function VerifyEmailPendingContent(): JSX.Element {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [resendStatus, setResendStatus] = useState<
    'idle' | 'loading' | 'success' | 'error' | 'rate_limited'
  >('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [countdown, setCountdown] = useState(0);

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
    if (!email) {
      setErrorMessage('Email address is missing. Please try registering again.');
      setResendStatus('error');
      return;
    }

    setResendStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setResendStatus('success');
        // Reset to idle after 5 seconds
        setTimeout(() => setResendStatus('idle'), 5000);
      } else if (response.status === 429) {
        setResendStatus('rate_limited');
        setCountdown(data.retryAfter || 60);
        setErrorMessage(data.error);
      } else {
        setResendStatus('error');
        setErrorMessage(data.error || 'Failed to resend verification email.');
      }
    } catch (error) {
      console.error('Resend error:', error);
      setResendStatus('error');
      setErrorMessage('An error occurred. Please try again.');
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-lg shadow-xl p-8">
        <div className="text-center">
          {/* Email Icon */}
          <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-6">
            <Mail className="w-8 h-8 text-indigo-600" />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Check your email
          </h2>

          {/* Description */}
          <p className="text-gray-600 mb-2">
            We&apos;ve sent a verification link to:
          </p>
          {email && (
            <p className="text-indigo-600 font-medium mb-6 break-all">
              {email}
            </p>
          )}

          {/* Instructions */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-medium text-gray-900 mb-2">Next steps:</h3>
            <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
              <li>Check your email inbox (and spam folder)</li>
              <li>Click the verification link in the email</li>
              <li>You&apos;ll be redirected to your dashboard</li>
            </ol>
          </div>

          {/* Resend Section */}
          <div className="border-t border-gray-200 pt-6">
            <p className="text-sm text-gray-600 mb-4">
              Didn&apos;t receive the email?
            </p>

            {/* Status Messages */}
            {resendStatus === 'success' && (
              <div className="flex items-center justify-center gap-2 text-green-600 mb-4">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-medium">Verification email sent!</span>
              </div>
            )}

            {resendStatus === 'error' && (
              <div className="flex items-center justify-center gap-2 text-red-600 mb-4">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{errorMessage}</span>
              </div>
            )}

            {resendStatus === 'rate_limited' && (
              <div className="flex items-center justify-center gap-2 text-amber-600 mb-4">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">Wait {countdown}s before resending</span>
              </div>
            )}

            {/* Resend Button */}
            <button
              onClick={handleResendEmail}
              disabled={resendStatus === 'loading' || resendStatus === 'rate_limited' || !email}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {resendStatus === 'loading' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : resendStatus === 'rate_limited' ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Resend in {countdown}s
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Resend verification email
                </>
              )}
            </button>
          </div>

          {/* Back to Login Link */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Already verified?{' '}
              <Link
                href="/login"
                className="text-indigo-600 font-medium hover:text-indigo-500"
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
              Wrong email? Register with a different address
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
          <div className="bg-white rounded-lg shadow-xl p-8">
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-indigo-600" />
              <p className="text-gray-600 mt-4">Loading...</p>
            </div>
          </div>
        </div>
      }
    >
      <VerifyEmailPendingContent />
    </Suspense>
  );
}
