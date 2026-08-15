'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Eye,
  EyeOff,
  Loader2,
  Check,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn, getSession } from 'next-auth/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { isAuthBridgeEnabled } from '@/lib/auth/auth-bridge-flag';

import SocialAuthButtons from './social-auth-buttons';

// Validation schema
const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

type ErrorType =
  | 'invalid'
  | 'locked'
  | 'server'
  | 'unverified'
  | '2fa_required'
  | null;

export default function LoginForm(): JSX.Element {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ErrorType>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [currentEmail, setCurrentEmail] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isValid, touchedFields },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });

  const handleAutofill = (
    presetEmail: string,
    presetPassword: string
  ): void => {
    setValue('email', presetEmail, { shouldValidate: true, shouldTouch: true });
    setValue('password', presetPassword, {
      shouldValidate: true,
      shouldTouch: true,
    });
    setError(null);
  };

  // Bridge path (Session 4B-20, DECISION-LOG.md F56): calls operation-
  // service's /auth/login via the token-login route instead of next-auth/
  // react's signIn('credentials', ...). Gated behind NEXT_PUBLIC_AUTH_BRIDGE_
  // ENABLED (default false) — dormant/parallel until Session 4B-21's own
  // cutover. Prototyped against this file specifically, per the order's own
  // Done-when ("prototyped against one real consumer... before committing to
  // the full 19-file swap").
  const onSubmitViaBridge = async (data: LoginFormData): Promise<void> => {
    const response = await fetch('/api/auth/token-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: data.email, password: data.password }),
    });
    const body = await response.json();

    if (response.ok) {
      if ('twoFactorRequired' in body && body.twoFactorRequired) {
        router.push(`/verify-2fa?token=${encodeURIComponent(body.token)}`);
        return;
      }
      // token-login sets the shared NextAuth-format session cookie server-side
      // (F26), but next-auth/react's SessionProvider client cache has no way
      // to know a new cookie appeared underneath it — nothing here went
      // through NextAuth's own signIn() flow, which is the only thing that
      // normally triggers a cache refetch. Force one explicitly (Entry
      // Criterion 1, DECISION-LOG.md F57) so every useSession()/getSession()
      // consumer app-wide (header, notification bell, realtime socket status,
      // login tracker, etc.) sees the correct authenticated state on the very
      // next render, not just the server-side getServerSession() reads.
      await getSession();
      setIsSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
      return;
    }

    if (body?.error === 'EMAIL_NOT_VERIFIED') {
      setError('unverified');
    } else {
      // operation-service's login() only ever throws INVALID_CREDENTIALS or
      // EMAIL_NOT_VERIFIED (see auth.service.ts) — there is no server-side
      // "locked" concept on either side of the bridge (auth-options.ts never
      // had one either; that branch below is unreachable dead code on both
      // paths, kept only because it predates this session and isn't this
      // order's scope to remove).
      setError('invalid');
    }
  };

  const onSubmit = async (data: LoginFormData): Promise<void> => {
    setIsSubmitting(true);
    setError(null);
    setCurrentEmail(data.email);

    try {
      if (isAuthBridgeEnabled()) {
        await onSubmitViaBridge(data);
        return;
      }

      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        // Parse error to determine type
        if (result.error.includes('TWO_FACTOR_REQUIRED:')) {
          // Extract the 2FA token from the error message
          const token = result.error.replace('TWO_FACTOR_REQUIRED:', '');
          // Redirect to 2FA verification page with token
          router.push(`/verify-2fa?token=${encodeURIComponent(token)}`);
          return;
        } else if (result.error.includes('EMAIL_NOT_VERIFIED')) {
          setError('unverified');
        } else if (result.error.includes('locked')) {
          setError('locked');
        } else {
          setError('invalid');
        }
      } else if (result?.ok) {
        setIsSuccess(true);
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('server');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getErrorMessage = (): {
    title: string;
    subtitle?: string;
    bg: string;
    border: string;
    text: string;
    icon: string;
    action?: 'verify' | 'reset';
  } | null => {
    switch (error) {
      case 'invalid':
        return {
          title: 'Invalid email or password. Please try again.',
          bg: 'bg-red-50',
          border: 'border-red-500',
          text: 'text-red-800',
          icon: 'text-red-600',
        };
      case 'unverified':
        return {
          title: 'Please verify your email address before signing in.',
          subtitle: 'Check your inbox for the verification link.',
          bg: 'bg-amber-50',
          border: 'border-amber-500',
          text: 'text-amber-800',
          icon: 'text-amber-600',
          action: 'verify',
        };
      case 'locked':
        return {
          title:
            'Your account has been locked due to too many failed login attempts.',
          subtitle: 'Please reset your password or contact support.',
          bg: 'bg-orange-50',
          border: 'border-orange-500',
          text: 'text-orange-800',
          icon: 'text-orange-600',
          action: 'reset',
        };
      case 'server':
        return {
          title: 'Something went wrong. Please try again later.',
          bg: 'bg-red-50',
          border: 'border-red-500',
          text: 'text-red-800',
          icon: 'text-red-600',
        };
      default:
        return null;
    }
  };

  const errorConfig = getErrorMessage();

  // Success state
  if (isSuccess) {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-lg bg-card p-8 shadow-xl">
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-foreground">
              Welcome back!
            </h2>
            <p className="text-muted-foreground">Redirecting to dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-lg bg-card p-8 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="mb-2 text-3xl font-bold text-foreground">
            Welcome Back
          </h1>
          <p className="text-muted-foreground">
            Sign in to your Trading Alerts account
          </p>
        </div>

        {/* Error Alert */}
        {error && errorConfig && (
          <div
            className={`${errorConfig.bg} border-l-4 ${errorConfig.border} animate-in slide-in-from-top relative mb-6 rounded-lg p-4 duration-300`}
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                className={`${errorConfig.icon} mt-0.5 flex-shrink-0`}
                size={20}
              />
              <div className="flex-1">
                <p className={`${errorConfig.text} text-sm font-medium`}>
                  {errorConfig.title}
                </p>
                {errorConfig.subtitle && (
                  <p className={`${errorConfig.text} mt-1 text-sm`}>
                    {errorConfig.subtitle}
                  </p>
                )}
                {errorConfig?.action === 'verify' && currentEmail && (
                  <Link
                    href={`/verify-email/pending?email=${encodeURIComponent(currentEmail)}`}
                    className="mt-2 block text-sm text-blue-600 underline hover:text-blue-700"
                  >
                    Resend verification email
                  </Link>
                )}
                {errorConfig?.action === 'reset' && (
                  <Link
                    href="/forgot-password"
                    className="mt-2 block text-sm text-blue-600 underline hover:text-blue-700"
                  >
                    Reset password
                  </Link>
                )}
              </div>
              <button
                onClick={() => setError(null)}
                className={`${errorConfig.icon} cursor-pointer text-xl font-bold hover:opacity-70`}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Quick Test Accounts Helper */}
        <div className="bg-muted/40 mb-6 rounded-lg border border-border p-3 text-xs">
          <div className="mb-2 flex items-center justify-between font-semibold text-muted-foreground">
            <span>⚡ Quick Test Credentials:</span>
            <span className="text-[10px] text-primary">Click to Autofill</span>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            <button
              type="button"
              onClick={() =>
                handleAutofill(
                  'free-test@trading-alerts.test',
                  'TestPassword123!'
                )
              }
              className="flex items-center justify-between rounded border border-border bg-card p-2 text-foreground transition-colors hover:bg-muted"
            >
              <span>FREE User</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() =>
                handleAutofill(
                  'pro-test@trading-alerts.test',
                  'TestPassword123!'
                )
              }
              className="flex items-center justify-between rounded border border-blue-500/30 bg-blue-500/10 p-2 text-blue-500 transition-colors hover:bg-blue-500/20"
            >
              <span className="font-semibold">PRO User</span>
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                handleAutofill(
                  'admin-test@trading-alerts.test',
                  'AdminPassword123!'
                )
              }
              className="flex items-center justify-between rounded border border-red-500/30 bg-red-500/10 p-2 text-red-500 transition-colors hover:bg-red-500/20"
            >
              <span className="font-semibold">Admin Test</span>
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                handleAutofill('admin@tradingalerts.com', 'ChangeMe123!')
              }
              className="flex items-center justify-between rounded border border-amber-500/30 bg-amber-500/10 p-2 text-amber-500 transition-colors hover:bg-amber-500/20"
            >
              <span className="font-semibold">Admin (Fixed)</span>
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                handleAutofill(
                  'affiliate-test@trading-alerts.test',
                  'AffiliatePassword123!'
                )
              }
              className="col-span-2 flex items-center justify-between rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-emerald-500 transition-colors hover:bg-emerald-500/20"
            >
              <span className="font-semibold">Affiliate Partner User</span>
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Email Field */}
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground"
            >
              Email Address
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                placeholder="john@example.com"
                {...register('email')}
                className={`w-full rounded-md border bg-background px-3 py-2 pr-10 text-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.email
                    ? 'border-red-500 focus:ring-red-500'
                    : touchedFields.email && !errors.email
                      ? 'border-green-500 focus:ring-green-500'
                      : 'border-border'
                }`}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
              {touchedFields.email && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {errors.email ? (
                    <AlertCircle className="text-red-600" size={20} />
                  ) : (
                    <Check className="text-green-600" size={20} />
                  )}
                </div>
              )}
            </div>
            {errors.email && (
              <p
                id="email-error"
                className="mt-1 flex items-center gap-1 text-sm text-red-600"
              >
                <span>⚠️</span>
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                {...register('password')}
                className={`w-full rounded-md border bg-background px-3 py-2 pr-10 text-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.password
                    ? 'border-red-500 focus:ring-red-500'
                    : touchedFields.password && !errors.password
                      ? 'border-green-500 focus:ring-green-500'
                      : 'border-border'
                }`}
                aria-describedby={
                  errors.password ? 'password-error' : undefined
                }
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && (
              <p
                id="password-error"
                className="mt-1 flex items-center gap-1 text-sm text-red-600"
              >
                <span>⚠️</span>
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                id="rememberMe"
                type="checkbox"
                {...register('rememberMe')}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <label
                htmlFor="rememberMe"
                className="cursor-pointer text-sm font-normal text-muted-foreground"
              >
                Remember me for 30 days
              </label>
            </div>
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="hover:bg-primary/90 w-full rounded-md bg-primary py-3 text-lg font-semibold text-primary-foreground shadow-lg transition-all duration-200 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            disabled={isSubmitting || !isValid}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 inline h-5 w-5 animate-spin" />
                <span className="opacity-70">Signing in...</span>
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-card px-4 text-muted-foreground">OR</span>
          </div>
        </div>

        {/* Social Login Buttons */}
        <SocialAuthButtons />

        {/* Footer Links */}
        <div className="mt-6 text-center">
          <span className="text-muted-foreground">
            Don&apos;t have an account?
          </span>
          <Link
            href="/register"
            className="ml-1 font-semibold text-primary hover:underline"
          >
            Sign up for free →
          </Link>
        </div>
      </div>
    </div>
  );
}
