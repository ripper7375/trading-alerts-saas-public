/**
 * Affiliate Email Verification Page
 *
 * Handles email verification for new affiliates.
 * Shows success/error state based on verification token.
 *
 * @module app/affiliate/verify/page
 */

'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE DEFINITIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type VerificationStatus = 'pending' | 'verifying' | 'success' | 'error';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VERIFICATION CONTENT COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function VerificationContent(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<VerificationStatus>(
    token ? 'verifying' : 'pending'
  );
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;

    const verifyEmail = async (): Promise<void> => {
      try {
        const response = await fetch('/api/affiliate/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage(
            data.message ||
              'Your email has been verified! You can now access your affiliate dashboard.'
          );

          // Redirect to dashboard after 3 seconds
          setTimeout(() => {
            router.push('/affiliate/dashboard');
          }, 3000);
        } else {
          setStatus('error');
          setMessage(
            data.message || data.error || 'Verification failed. Please try again.'
          );
        }
      } catch {
        setStatus('error');
        setMessage('An error occurred. Please try again later.');
      }
    };

    verifyEmail();
  }, [token, router]);

  // Pending state - waiting for email
  if (status === 'pending') {
    return (
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
          <svg
            className="w-8 h-8 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Verify Your Email
        </h1>
        <p className="text-gray-600 mb-6">
          We&apos;ve sent a verification email to your inbox. Please click the
          link in the email to complete your affiliate registration.
        </p>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">
            Didn&apos;t receive the email? Check your spam folder or{' '}
            <button className="underline font-medium">
              click here to resend
            </button>
            .
          </p>
        </div>
        <Link
          href="/affiliate/register"
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          &larr; Back to registration
        </Link>
      </div>
    );
  }

  // Verifying state
  if (status === 'verifying') {
    return (
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
          <svg
            className="w-8 h-8 text-blue-600 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Verifying Your Email...
        </h1>
        <p className="text-gray-600">
          Please wait while we verify your email address.
        </p>
      </div>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Email Verified!
        </h1>
        <p className="text-gray-600 mb-6">{message}</p>
        <p className="text-sm text-gray-500 mb-6">
          Redirecting to your dashboard...
        </p>
        <Link
          href="/affiliate/dashboard"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
        >
          Go to Dashboard
        </Link>
      </div>
    );
  }

  // Error state
  return (
    <div className="text-center">
      <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
        <svg
          className="w-8 h-8 text-red-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">
        Verification Failed
      </h1>
      <p className="text-gray-600 mb-6">{message}</p>
      <div className="space-y-4">
        <Link
          href="/affiliate/register"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
        >
          Try Again
        </Link>
        <p className="text-sm text-gray-500">
          If the problem persists, please contact support.
        </p>
      </div>
    </div>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PAGE COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Affiliate Verification Page
 */
export default function AffiliateVerifyPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <Suspense
          fallback={
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
              <p className="mt-4 text-gray-600">Loading...</p>
            </div>
          }
        >
          <VerificationContent />
        </Suspense>
      </div>
    </div>
  );
}
