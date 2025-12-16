'use client';

import Link from 'next/link';

import LoginForm from '@/components/auth/login-form';

export default function LoginPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <LoginForm />
      <div className="text-center text-sm">
        <span className="text-gray-600">Don&apos;t have an account? </span>
        <Link
          href="/register"
          className="text-indigo-600 hover:text-indigo-500 font-medium transition-colors duration-200"
        >
          Sign up
        </Link>
      </div>
    </div>
  );
}
