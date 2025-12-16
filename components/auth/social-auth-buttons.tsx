'use client';

import { Loader2 } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useState } from 'react';

export default function SocialAuthButtons(): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async (): Promise<void> => {
    try {
      setIsLoading(true);
      await signIn('google', { callbackUrl: '/dashboard' });
    } catch (error) {
      console.error('Error signing in with Google:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      disabled={isLoading}
      className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? (
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
  );
}
