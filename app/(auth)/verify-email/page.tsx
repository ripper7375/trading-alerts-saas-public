'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';

import { isAuthBridgeEnabled } from '@/lib/auth/auth-bridge-flag';

function VerifyEmailContent(): JSX.Element {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<
    'loading' | 'success' | 'error' | 'missing'
  >('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const verifyEmail = async (): Promise<void> => {
      // If no token, show missing state
      if (!token) {
        setStatus('missing');
        return;
      }

      try {
        setStatus('loading');
        // Bridge path (Session 4B-21, DECISION-LOG.md F56): this verifies a
        // pending registration's email, before any session ever exists — no
        // session-cache refresh applies (Entry Criterion 1 doesn't apply).
        const endpoint = isAuthBridgeEnabled()
          ? '/api/auth/token-verify-email'
          : '/api/auth/verify-email';
        const response = await fetch(`${endpoint}?token=${token}`);

        if (response.ok) {
          setStatus('success');
          // Redirect to login after 2 seconds
          setTimeout(() => {
            router.push('/login');
          }, 2000);
        } else {
          const data = await response.json();
          setError(data.error || 'Invalid or expired token');
          setStatus('error');
        }
      } catch (err) {
        console.error(err);
        setError('Verification failed');
        setStatus('error');
      }
    };

    verifyEmail();
  }, [token, router]);

  // Render different states
  const renderContent = (): JSX.Element | null => {
    switch (status) {
      case 'loading':
        return (
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
            <h2 className="mt-4 text-xl font-semibold text-gray-900">
              Verifying your email...
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Please wait while we verify your email address.
            </p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-green-600">
              Email verified successfully!
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Your account is now active. Redirecting to sign in...
            </p>
          </div>
        );

      case 'error':
        return (
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-red-600">
              Verification failed
            </h2>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
            <p className="mt-2 text-sm text-gray-500">
              The link may have expired. Try signing in to request a new
              verification email.
            </p>
            <div className="mt-6">
              <Link
                href="/login"
                className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Go to Sign In
              </Link>
            </div>
          </div>
        );

      case 'missing':
        return (
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <svg
                className="h-6 w-6 text-amber-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                ></path>
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-amber-600">
              Verification link missing
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              The verification token is missing from the link.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Please click the link in your verification email, or sign in to
              request a new one.
            </p>
            <div className="mt-6">
              <Link
                href="/login"
                className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Go to Sign In
              </Link>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="bg-white px-4 py-8 shadow sm:rounded-lg sm:px-10">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

// Wrap with Suspense for useSearchParams
export default function VerifyEmailPage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-indigo-600" />
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
