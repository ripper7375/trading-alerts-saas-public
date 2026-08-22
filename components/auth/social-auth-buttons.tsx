'use client';

import { Loader2 } from 'lucide-react';
import { signIn, getProviders } from 'next-auth/react';
import { useState, useEffect } from 'react';

type LoadingProvider = 'google' | 'twitter' | null;

interface AvailableProviders {
  google: boolean;
  twitter: boolean;
}

export default function SocialAuthButtons(): JSX.Element {
  const [loadingProvider, setLoadingProvider] = useState<LoadingProvider>(null);
  const [availableProviders, setAvailableProviders] =
    useState<AvailableProviders>({
      google: true,
      twitter: true,
    });
  const [providersLoaded, setProvidersLoaded] = useState(false);

  // Fetch available providers on mount
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const providers = await getProviders();
        if (providers) {
          setAvailableProviders({
            google: 'google' in providers,
            twitter: 'twitter' in providers,
          });
        }
      } catch (error) {
        console.error('Failed to fetch providers:', error);
      } finally {
        setProvidersLoaded(true);
      }
    };
    fetchProviders();
  }, []);

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

  const isLoading = loadingProvider !== null;

  // Check if any OAuth provider is available
  const hasAnyOAuthProvider =
    availableProviders.google || availableProviders.twitter;

  // If no OAuth providers are configured, show a message
  if (providersLoaded && !hasAnyOAuthProvider) {
    return (
      <div className="py-2 text-center text-xs text-muted-foreground">
        <p>Social login not configured.</p>
        <p className="mt-1 text-[11px]">Use email/password to sign in.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Google Sign In Button */}
      {availableProviders.google && (
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="dark:border-slate-750 flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#0b0e17] dark:text-slate-200 dark:hover:bg-[#12151f]"
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
      )}

      {/* X (Twitter) Sign In Button */}
      {availableProviders.twitter && (
        <button
          type="button"
          onClick={handleTwitterSignIn}
          disabled={isLoading}
          className="flex h-10 w-full items-center justify-center rounded-xl border border-black bg-black text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white dark:bg-white dark:text-black dark:hover:bg-slate-100"
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
      )}
    </div>
  );
}
