'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

import RegisterForm from '@/components/auth/register-form';

export default function RegisterPage(): JSX.Element {
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
      <div className="space-y-6">
        <RegisterForm />
        <div className="text-center text-sm">
          <span className="text-gray-600">Already have an account? </span>
          <Link
            href="/login"
            className="text-indigo-600 hover:text-indigo-500 font-medium transition-colors duration-200"
          >
            Sign in
          </Link>
        </div>
      </div>
    </Suspense>
  );
}
