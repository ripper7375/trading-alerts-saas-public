'use client';

import { LogOut, LayoutDashboard, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

import LoginForm from '@/components/auth/login-form';
import { Button } from '@/components/ui/button';

export default function LoginPage(): JSX.Element {
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
          <h1 className="text-2xl font-bold">Already Signed In</h1>
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
              Continue to Dashboard
            </Link>
          </Button>

          <Button
            variant="outline"
            className="flex w-full items-center justify-center gap-2"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            <LogOut className="h-4 w-4" />
            Sign Out / Switch Account
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <LoginForm />
      <div className="text-center text-sm">
        <span className="text-muted-foreground">
          Don&apos;t have an account?{' '}
        </span>
        <Link
          href="/register"
          className="hover:text-primary/80 font-medium text-primary transition-colors duration-200"
        >
          Sign up
        </Link>
      </div>
    </div>
  );
}
