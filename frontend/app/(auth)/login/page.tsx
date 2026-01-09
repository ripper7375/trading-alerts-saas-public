'use client';

import Link from 'next/link';

import LoginForm from '@/components/auth/login-form';

export default function LoginPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <LoginForm />
      <div className="text-center text-sm">
        <span className="text-muted-foreground">Don&apos;t have an account? </span>
        <Link
          href="/register"
          className="text-primary hover:text-primary/80 font-medium transition-colors duration-200"
        >
          Sign up
        </Link>
      </div>
    </div>
  );
}
