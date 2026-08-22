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
import { useLocale } from '@/lib/context/locale-context';

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
  const { t } = useLocale();
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

  const onSubmit = async (data: LoginFormData): Promise<void> => {
    setIsSubmitting(true);
    setError(null);
    setCurrentEmail(data.email);

    try {
      if (isAuthBridgeEnabled()) {
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
          setError('invalid');
        }
        return;
      }

      // Default NextAuth flow
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.ok) {
        setIsSuccess(true);
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
        return;
      }

      if (result?.error) {
        if (result.error.includes('TWO_FACTOR_REQUIRED:')) {
          const token = result.error.replace('TWO_FACTOR_REQUIRED:', '');
          router.push(`/verify-2fa?token=${encodeURIComponent(token)}`);
          return;
        } else if (result.error.includes('EMAIL_NOT_VERIFIED')) {
          setError('unverified');
        } else if (result.error.includes('locked')) {
          setError('locked');
        } else {
          setError('invalid');
        }
      } else {
        setError('invalid');
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
    action?: 'verify' | 'reset';
  } | null => {
    switch (error) {
      case 'invalid':
        return { title: t('Invalid email or password. Please try again.') };
      case 'unverified':
        return {
          title: t('Please verify your email address before signing in.'),
          subtitle: t('Check your inbox for the verification link.'),
          action: 'verify',
        };
      case 'locked':
        return {
          title: t(
            'Your account has been locked due to too many failed login attempts.'
          ),
          subtitle: t('Please reset your password or contact support.'),
          action: 'reset',
        };
      case 'server':
        return { title: t('Something went wrong. Please try again later.') };
      default:
        return null;
    }
  };

  const errorConfig = getErrorMessage();

  // Success state
  if (isSuccess) {
    return (
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl backdrop-blur-xl dark:border-slate-800/80 dark:bg-[#0b0e17]">
        <div className="py-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {t('Welcome back!')}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('Redirecting to dashboard...')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl backdrop-blur-xl dark:border-slate-800/80 dark:bg-[#0b0e17]">
      <div className="text-center">
        <h1 className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">
          {t('Welcome Back')}
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {t('Sign in to your DavinTrade account')}
        </p>
      </div>

      {/* Error Alert */}
      {error && errorConfig && (
        <div className="relative flex items-start gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs dark:border-rose-500/30 dark:bg-rose-950/40">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <div className="flex-1">
            <p className="font-semibold text-rose-700 dark:text-rose-300">
              {errorConfig.title}
            </p>
            {errorConfig.subtitle && (
              <p className="mt-1 text-rose-600 dark:text-rose-400">
                {errorConfig.subtitle}
              </p>
            )}
            {errorConfig.action === 'verify' && currentEmail && (
              <Link
                href={`/verify-email/pending?email=${encodeURIComponent(currentEmail)}`}
                className="mt-1.5 block font-semibold text-amber-600 underline hover:text-amber-700 dark:text-amber-400"
              >
                {t('Resend verification email')}
              </Link>
            )}
            {errorConfig.action === 'reset' && (
              <Link
                href="/forgot-password"
                className="mt-1.5 block font-semibold text-amber-600 underline hover:text-amber-700 dark:text-amber-400"
              >
                {t('Reset password')}
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-500 hover:opacity-70"
            aria-label={t('Dismiss')}
          >
            ×
          </button>
        </div>
      )}

      {/* Quick Test Accounts Helper */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-[#06080e]">
        <div className="mb-2 flex items-center justify-between font-semibold text-slate-600 dark:text-slate-400">
          <span>⚡ {t('Quick Test Credentials:')}</span>
          <span className="text-[10px] text-amber-600 dark:text-amber-400">
            {t('Click to Autofill')}
          </span>
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
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2 text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-[#0b0e17] dark:text-slate-300 dark:hover:bg-[#12151f]"
          >
            <span>{t('FREE User')}</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
          </button>
          <button
            type="button"
            onClick={() =>
              handleAutofill('pro-test@trading-alerts.test', 'TestPassword123!')
            }
            className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-amber-600 transition-colors hover:bg-amber-500/20 dark:text-amber-400"
          >
            <span className="font-semibold">{t('PRO User')}</span>
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
            className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-rose-600 transition-colors hover:bg-rose-500/20 dark:text-rose-400"
          >
            <span className="font-semibold">{t('Admin Test')}</span>
            <CheckCircle2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() =>
              handleAutofill('admin@tradingalerts.com', 'ChangeMe123!')
            }
            className="flex items-center justify-between rounded-lg border border-orange-500/30 bg-orange-500/10 p-2 text-orange-600 transition-colors hover:bg-orange-500/20 dark:text-orange-400"
          >
            <span className="font-semibold">{t('Admin (Fixed)')}</span>
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
            className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
          >
            <span className="font-semibold">{t('Affiliate (FREE)')}</span>
            <CheckCircle2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() =>
              handleAutofill(
                'affiliate-pro-test@trading-alerts.test',
                'AffiliatePassword123!'
              )
            }
            className="flex items-center justify-between rounded-lg border border-blue-500/30 bg-blue-500/10 p-2 text-blue-600 transition-colors hover:bg-blue-500/20 dark:text-blue-400"
          >
            <span className="font-semibold">{t('Affiliate (PRO)')}</span>
            <CheckCircle2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            {t('Email Address')}
          </label>
          <div className="relative">
            <input
              id="email"
              type="email"
              placeholder="john@example.com"
              {...register('email')}
              className={`dark:border-slate-750 h-10 w-full rounded-xl border bg-white px-3 pr-10 text-xs text-slate-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-[#06080e] dark:text-slate-100 ${
                errors.email
                  ? 'border-rose-500 focus:ring-rose-500'
                  : touchedFields.email && !errors.email
                    ? 'border-emerald-500 focus:ring-emerald-500'
                    : 'border-slate-200'
              }`}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            {touchedFields.email && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {errors.email ? (
                  <AlertCircle className="h-4 w-4 text-rose-600" />
                ) : (
                  <Check className="h-4 w-4 text-emerald-600" />
                )}
              </div>
            )}
          </div>
          {errors.email && (
            <p
              id="email-error"
              className="flex items-center gap-1 text-xs text-rose-600"
            >
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            {t('Password')}
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder={t('Enter your password')}
              {...register('password')}
              className={`dark:border-slate-750 h-10 w-full rounded-xl border bg-white px-3 pr-10 text-xs text-slate-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-[#06080e] dark:text-slate-100 ${
                errors.password
                  ? 'border-rose-500 focus:ring-rose-500'
                  : touchedFields.password && !errors.password
                    ? 'border-emerald-500 focus:ring-emerald-500'
                    : 'border-slate-200'
              }`}
              aria-describedby={errors.password ? 'password-error' : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              aria-label={
                showPassword ? t('Hide password') : t('Show password')
              }
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className="text-xs text-rose-600">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <input
              id="rememberMe"
              type="checkbox"
              {...register('rememberMe')}
              className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <label
              htmlFor="rememberMe"
              className="cursor-pointer font-normal text-slate-500 dark:text-slate-400"
            >
              {t('Remember me for 30 days')}
            </label>
          </div>
          <Link
            href="/forgot-password"
            className="font-semibold text-amber-600 hover:underline dark:text-amber-400"
          >
            {t('Forgot password?')}
          </Link>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="h-10 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 transition-all hover:from-amber-400 hover:to-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSubmitting || !isValid}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              {t('Signing in...')}
            </>
          ) : (
            t('Sign In')
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200 dark:border-slate-800/80" />
        </div>
        <div className="relative flex justify-center text-[11px]">
          <span className="bg-white px-4 text-slate-400 dark:bg-[#0b0e17] dark:text-slate-500">
            {t('OR')}
          </span>
        </div>
      </div>

      {/* Social Login Buttons */}
      <SocialAuthButtons />

      {/* Footer Links */}
      <div className="border-t border-slate-200 pt-4 text-center text-xs dark:border-slate-800/80">
        <span className="text-slate-500 dark:text-slate-400">
          {t("Don't have an account?")}
        </span>
        <Link
          href="/register"
          className="ml-1 font-semibold text-amber-600 hover:underline dark:text-amber-400"
        >
          {t('Sign up for free →')}
        </Link>
      </div>
    </div>
  );
}
