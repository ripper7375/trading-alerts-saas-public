'use client';

import { Loader2 } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useState } from 'react';

type LoadingProvider = 'google' | 'twitter' | 'linkedin' | null;

export default function SocialAuthButtons(): JSX.Element {
  const [loadingProvider, setLoadingProvider] = useState<LoadingProvider>(null);

  const handleGoogleSignIn = async (): Promise<void> => {
    try {
      setLoadingProvider('google');
      await signIn('google', { callbackUrl: '/dashboard' });
    } catch (error) {
      console.error('Error signing in with Google:', error);
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleTwitterSignIn = async (): Promise<void> => {
    try {
      setLoadingProvider('twitter');
      await signIn('twitter', { callbackUrl: '/dashboard' });
    } catch (error) {
      console.error('Error signing in with X:', error);
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleLinkedInSignIn = async (): Promise<void> => {
    try {
      setLoadingProvider('linkedin');
      await signIn('linkedin', { callbackUrl: '/dashboard' });
    } catch (error) {
      console.error('Error signing in with LinkedIn:', error);
    } finally {
      setLoadingProvider(null);
    }
  };

  const isLoading = loadingProvider !== null;

  return (
    <div className="space-y-3">
      {/* Google Sign In Button */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loadingProvider === 'google' ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <svg
            className="mr-2 h-4 w-4"
            viewBox="0 0 48 48"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="#FFC107"
              d="M43.6,20.1H42V20H24v8h11.3C34.4,31.9,30,34,24,34c-9.9,0-18-8.1-18-18S14.1,16,24,16c3.1,0,6.3,0.8,9.1,2.3l6-6C37.1,9.1,30.9,6,24,6C12.9,6,4,18.9,4,30s8.9,24,20,24c7.5,0,13.8-3.6,16.6-8.6L43.6,20.1z"
            />
            <path
              fill="#FF3D00"
              d="M6.3,14.7l6.6,4.8C14.6,15.7,18.9,12,24,12c3.1,0,6.3,0.8,9.1,2.3l6-6C33.1,4.1,26.9,1,20,1C10.9,1,1,10.9,1,20s9.9,19,19,19l6-6L6.3,14.7z"
            />
            <path
              fill="#4CAF50"
              d="M24,43c4.9,0,9.6-1.9,13-5.2l-6-5.2C28.9,34.9,26.6,35,24,35c-6,0-11-4.9-11-11s5-11,11-11c2.7,0,5.2,1,7.1,2.8l6,5.2C29.6,16.9,26.9,16,24,16c-7.5,0-13.8,3.6-16.6,8.6L8.7,14.7l6.6,4.8L24,43z"
            />
            <path
              fill="#1976D2"
              d="M43.6,20.1H42V20H24v8h11.3C34.4,31.9,30,34,24,34c-9.9,0-18-8.1-18-18S14.1,16,24,16c3.1,0,6.3,0.8,9.1,2.3l6-6C37.1,9.1,30.9,6,24,6C12.9,6,4,18.9,4,30s8.9,24,20,24c7.5,0,13.8-3.6,16.6-8.6L43.6,20.1z"
            />
          </svg>
        )}
        Sign in with Google
      </button>

      {/* X (Twitter) Sign In Button */}
      <button
        type="button"
        onClick={handleTwitterSignIn}
        disabled={isLoading}
        className="w-full flex justify-center items-center px-4 py-2 border border-black shadow-sm text-sm font-medium rounded-md text-white bg-black hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loadingProvider === 'twitter' ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <svg
            className="mr-2 h-4 w-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        )}
        Login with X
      </button>

      {/* LinkedIn Sign In Button */}
      <button
        type="button"
        onClick={handleLinkedInSignIn}
        disabled={isLoading}
        className="w-full flex justify-center items-center px-4 py-2 border border-[#0A66C2] shadow-sm text-sm font-medium rounded-md text-white bg-[#0A66C2] hover:bg-[#004182] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0A66C2] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loadingProvider === 'linkedin' ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <svg
            className="mr-2 h-4 w-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
        )}
        Sign in with LinkedIn
      </button>
    </div>
  );
}
