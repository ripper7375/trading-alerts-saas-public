'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signIn, getSession, signOut } from 'next-auth/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { isAuthBridgeEnabled } from '@/lib/auth/auth-bridge-flag';

// Distinct styling for Admin Portal
const adminLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type AdminLoginData = z.infer<typeof adminLoginSchema>;

export default function AdminLoginPage(): JSX.Element {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminLoginData>({
    resolver: zodResolver(adminLoginSchema),
  });

  const onSubmit = async (data: AdminLoginData): Promise<void> => {
    setIsSubmitting(true);
    setError(null);

    try {
      if (isAuthBridgeEnabled()) {
        // Bridge path (Session 4B-21, DECISION-LOG.md F56/F57): token-login
        // returns the user (including role) directly in its response body —
        // no separate getSession() round-trip needed just to read the role,
        // unlike the non-bridge path below. A forced getSession() refresh
        // still runs afterward so every other useSession() consumer app-wide
        // sees the correct authenticated state (Entry Criterion 1). Matches
        // the non-bridge path's own behavior of treating a 2FA-required
        // response as a generic invalid-credentials error (this admin form
        // has never had its own 2FA branch on either path).
        const response = await fetch('/api/auth/token-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.email, password: data.password }),
        });
        const body = await response.json();

        if (
          !response.ok ||
          ('twoFactorRequired' in body && body.twoFactorRequired)
        ) {
          setError('Invalid admin credentials');
          setIsSubmitting(false);
          return;
        }

        if (body.user?.role !== 'ADMIN') {
          await fetch('/api/auth/token-logout', { method: 'POST' });
          setError('Unauthorized: Access restricted to Administrators only.');
          setIsSubmitting(false);
          return;
        }

        await getSession();
        router.push('/admin/dashboard');
        return;
      }

      // 1. Perform Credential Login
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid admin credentials');
        setIsSubmitting(false);
        return;
      }

      if (result?.ok) {
        // 2. CRITICAL CHECK: Verify Admin Role immediately after login
        const session = await getSession();

        if (session?.user?.role !== 'ADMIN') {
          // If user logged in but is NOT an admin, force logout immediately
          await signOut({ redirect: false });
          setError('Unauthorized: Access restricted to Administrators only.');
          setIsSubmitting(false);
          return;
        }

        // 3. Success - Redirect to Admin Dashboard
        router.push('/admin/dashboard');
      }
    } catch (err) {
      console.error('Admin login error:', err);
      setError('An unexpected error occurred');
      setIsSubmitting(false);
    }
  };

  return (
    // Admin Theme: Slate/Dark background wrapper
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="rounded-lg border border-slate-700 bg-white p-8 shadow-2xl">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <ShieldAlert className="h-6 w-6 text-slate-800" />
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900">
              Admin Portal
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Restricted Access. System Administrators only.
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="-space-y-px rounded-md shadow-sm">
              <div>
                <label htmlFor="email-address" className="sr-only">
                  Email address
                </label>
                <input
                  id="email-address"
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  required
                  className="relative block w-full appearance-none rounded-none rounded-t-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-slate-500 focus:outline-none focus:ring-slate-500 sm:text-sm"
                  placeholder="Admin Email"
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  {...register('password')}
                  type="password"
                  autoComplete="current-password"
                  required
                  className="relative block w-full appearance-none rounded-none rounded-b-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-slate-500 focus:outline-none focus:ring-slate-500 sm:text-sm"
                  placeholder="Password"
                />
              </div>
            </div>

            {(errors.email || errors.password) && (
              <div className="text-center text-sm text-red-500">
                {errors.email?.message || errors.password?.message}
              </div>
            )}

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <ShieldAlert
                      className="h-5 w-5 text-red-400"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      {error}
                    </h3>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative flex w-full justify-center rounded-md border border-transparent bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:bg-slate-400"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="-ml-1 mr-3 h-4 w-4 animate-spin text-white" />
                    Authenticating...
                  </>
                ) : (
                  'Access Dashboard'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <a
              href="/login"
              className="text-sm text-slate-500 underline hover:text-slate-700"
            >
              Return to User Login
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
