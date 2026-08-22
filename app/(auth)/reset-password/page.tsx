'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Lock,
  KeyRound,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Check,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { isAuthBridgeEnabled } from '@/lib/auth/auth-bridge-flag';
import { useLocale } from '@/lib/context/locale-context';
import { Card } from '@/components/ui/card';

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(
        /[!@#$%^&*(),.?":{}|<>]/,
        'Password must contain at least one special character'
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type ResetPasswordData = z.infer<typeof resetPasswordSchema>;

function ResetPasswordForm(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { t } = useLocale();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onChange',
  });

  const password = watch('password');
  const confirmPassword = watch('confirmPassword');

  const passwordValidation = {
    minLength: (password?.length || 0) >= 8,
    hasUppercase: /[A-Z]/.test(password || ''),
    hasLowercase: /[a-z]/.test(password || ''),
    hasNumber: /[0-9]/.test(password || ''),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password || ''),
  };

  const onSubmit = async (data: ResetPasswordData): Promise<void> => {
    if (!token) {
      setError('Missing reset token. Please request a new link.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Bridge path (Session 4B-21, DECISION-LOG.md F56): request-only, never
      // logs the user in, so no session-cache refresh is needed (Entry
      // Criterion 1 only applies to login/2FA-completion/logout).
      const endpoint = isAuthBridgeEnabled()
        ? '/api/auth/token-reset-password'
        : '/api/auth/reset-password';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: data.password,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } else {
        setError(
          result.error || 'Failed to reset password. The link may have expired.'
        );
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="w-full max-w-md space-y-4">
        <Card className="space-y-3 border-slate-200 bg-white p-6 text-center shadow-2xl dark:border-slate-800/80 dark:bg-[#090b14]/95">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-500/15 text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-rose-700 dark:text-rose-300">
            {t('Invalid Link')}
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {t('This password reset link is invalid or missing.')}
          </p>
          <Link
            href="/forgot-password"
            className="block text-xs font-semibold text-amber-600 hover:underline dark:text-amber-400"
          >
            {t('Request a new link')}
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {t('Set New Password')}
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {t('Enter your new secure account password below.')}
        </p>
      </div>

      <Card className="space-y-4 border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-[#090b14]/95 dark:backdrop-blur-2xl md:p-8">
        {success ? (
          <div className="space-y-3 py-6 text-center">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </div>
            <h3 className="text-base font-bold text-emerald-700 dark:text-emerald-200">
              {t('Password Reset Successfully!')}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {t('Redirecting you to login portal...')}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {t('New Password')}
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...register('password')}
                  className="dark:border-slate-750 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-10 text-xs text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-[#06080e] dark:text-slate-200"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
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

              {password && (
                <div className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-[#070910]">
                  {[
                    { key: 'minLength', label: t('At least 8 characters') },
                    { key: 'hasUppercase', label: t('One uppercase letter') },
                    { key: 'hasLowercase', label: t('One lowercase letter') },
                    { key: 'hasNumber', label: t('One number') },
                    {
                      key: 'hasSpecial',
                      label: t('One special character (!@#$%^&*)'),
                    },
                  ].map(({ key, label }) => {
                    const passed =
                      passwordValidation[
                        key as keyof typeof passwordValidation
                      ];
                    return (
                      <div
                        key={key}
                        className="flex items-center gap-1.5 text-[11px]"
                      >
                        {passed ? (
                          <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <X className="h-3 w-3 text-slate-400 dark:text-slate-600" />
                        )}
                        <span
                          className={
                            passed
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-slate-600 dark:text-slate-500'
                          }
                        >
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {errors.password && (
                <p className="text-xs text-rose-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="confirmPassword"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {t('Confirm New Password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...register('confirmPassword')}
                  className="dark:border-slate-750 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-10 text-xs text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-[#06080e] dark:text-slate-200"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  aria-label={
                    showConfirmPassword
                      ? t('Hide password confirmation')
                      : t('Show password confirmation')
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {confirmPassword && confirmPassword !== password && (
                <p className="flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400">
                  <X className="h-3 w-3" />
                  {t('Passwords do not match')}
                </p>
              )}
              {errors.confirmPassword && (
                <p className="text-xs text-rose-600">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 transition-all hover:from-amber-400 hover:to-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>{t('Resetting...')}</span>
              ) : (
                <>
                  {t('Update Password')}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="border-t border-slate-200 pt-3 text-center dark:border-slate-800/80">
          <Link
            href="/login"
            className="text-xs text-slate-600 transition-colors hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400"
          >
            ← {t('Back to Login')}
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
