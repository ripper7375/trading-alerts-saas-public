'use client';

import { Loader2, LayoutDashboard, LogOut, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { useSession, signOut } from 'next-auth/react';

import RegisterForm from '@/components/auth/register-form';
import { Button } from '@/components/ui/button';

function RegisterPageContent(): JSX.Element {
  const { data: session, status } = useSession();

  if (status === 'authenticated' && session?.user) {
    const userRole = (session.user as { role?: string }).role;
    const dashboardHref = userRole === 'ADMIN' ? '/admin' : '/dashboard';

    return (
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-6 text-card-foreground shadow-xl">
        <div className="flex flex-col items-center space-y-3 text-center">
          <div className="bg-primary/10 flex h-14 w-14 items-center justify-center rounded-full text-primary">
            <UserCheck className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">Account Already Active</h1>
          <p className="text-sm text-muted-foreground">
            You are currently signed in as{' '}
            <span className="font-semibold text-foreground">
              {session.user.name || session.user.email}
            </span>
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <Button asChild className="w-full" size="lg">
            <Link
              href={dashboardHref}
              className="flex items-center justify-center gap-2"
            >
              <LayoutDashboard className="h-4 w-4" />
              Go to Dashboard
            </Link>
          </Button>

          <Button
            variant="outline"
            className="flex w-full items-center justify-center gap-2"
            onClick={() => signOut({ callbackUrl: '/register' })}
          >
            <LogOut className="h-4 w-4" />
            Sign Out / Register Different Account
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <RegisterForm />
      <div className="text-center text-sm">
        <span className="text-muted-foreground">Already have an account? </span>
        <Link
          href="/login"
          className="hover:text-primary/80 font-medium text-primary transition-colors duration-200"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

export default function RegisterPage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md">
          <div className="rounded-lg border bg-card p-8 shadow-xl">
            <div className="py-8 text-center">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Loading...</p>
            </div>
          </div>
        </div>
      }
    >
      <RegisterPageContent />
    </Suspense>
  );
}
