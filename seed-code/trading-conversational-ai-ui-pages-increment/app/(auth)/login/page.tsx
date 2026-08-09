'use client';

import LoginForm from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#06070a] p-4 select-none">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent" />
      <LoginForm />
    </div>
  );
}
