'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Mail,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  Info,
  AlertTriangle,
  Loader2,
  Check,
  X,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { isAuthBridgeEnabled } from '@/lib/auth/auth-bridge-flag';
import { useLocale } from '@/lib/context/locale-context';
import { Button } from '@/components/ui/button';

// Validation schemas
const emailSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
});

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type EmailFormData = z.infer<typeof emailSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

type Step = 'request' | 'confirmation' | 'reset' | 'success';
type ErrorType =
  | 'not-found'
  | 'rate-limit'
  | 'server'
  | 'expired'
  | 'invalid'
  | null;

function ForgotPasswordForm(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<ErrorType>(null);
  const [countdown, setCountdown] = useState(600); // 10 minutes in seconds
  const [autoRedirectCountdown, setAutoRedirectCountdown] = useState(3);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [tokenInvalid, setTokenInvalid] = useState(false);

  // Check for reset token in URL
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      // In production, validate token with API
      // For now, simulate validation
      if (token === 'expired') {
        setTokenExpired(true);
        setStep('reset');
      } else if (token === 'invalid') {
        setTokenInvalid(true);
        setStep('reset');
      } else {
        setStep('reset');
      }
    }
  }, [searchParams]);

  // Rate limit countdown
  useEffect(() => {
    if (error === 'rate-limit' && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      return (): void => clearInterval(timer);
    }
    return undefined;
  }, [error, countdown]);

  // Auto-redirect countdown
  useEffect(() => {
    if (step === 'success' && autoRedirectCountdown > 0) {
      const timer = setInterval(() => {
        setAutoRedirectCountdown((prev) => prev - 1);
      }, 1000);
      return (): void => clearInterval(timer);
    } else if (step === 'success' && autoRedirectCountdown === 0) {
      router.push('/login');
    }
    return undefined;
  }, [step, autoRedirectCountdown, router]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-md">
      {step === 'request' && (
        <RequestResetStep
          setStep={setStep}
          setEmail={setEmail}
          error={error}
          setError={setError}
          countdown={countdown}
          formatTime={formatTime}
        />
      )}
      {step === 'confirmation' && (
        <ConfirmationStep email={email} setStep={setStep} setError={setError} />
      )}
      {step === 'reset' && (
        <ResetPasswordStep
          setStep={setStep}
          tokenExpired={tokenExpired}
          tokenInvalid={tokenInvalid}
          setTokenExpired={setTokenExpired}
          searchParams={searchParams}
        />
      )}
      {step === 'success' && (
        <SuccessStep autoRedirectCountdown={autoRedirectCountdown} />
      )}
    </div>
  );
}

// Step 1: Request Reset
function RequestResetStep({
  setStep,
  setEmail,
  error,
  setError,
  countdown,
  formatTime,
}: {
  setStep: (step: Step) => void;
  setEmail: (email: string) => void;
  error: ErrorType;
  setError: (error: ErrorType) => void;
  countdown: number;
  formatTime: (seconds: number) => string;
}): JSX.Element {
  const { t } = useLocale();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    mode: 'onChange',
  });

  const onSubmit = async (data: EmailFormData): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Bridge path (Session 4B-21, DECISION-LOG.md F56): request-only, never
      // logs the user in, so no session-cache refresh is needed here (Entry
      // Criterion 1 only applies to the login/2FA-completion/logout paths).
      const endpoint = isAuthBridgeEnabled()
        ? '/api/auth/token-forgot-password'
        : '/api/auth/forgot-password';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setEmail(data.email);
        setStep('confirmation');
      } else if (response.status === 404) {
        setError('not-found');
      } else if (response.status === 429) {
        setError('rate-limit');
      } else {
        setError('server');
      }
    } catch (err) {
      console.error(err);
      setError('server');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl backdrop-blur-xl dark:border-slate-800/80 dark:bg-[#0b0e17]">
      <Link
        href="/login"
        className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:underline dark:text-amber-400"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {t('Back to Sign In')}
      </Link>

      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <Mail className="h-6 w-6" />
        </div>
        <h1 className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
          {t('Forgot Password?')}
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {t("No worries, we'll send you reset instructions")}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            {t('Email Address')}
          </label>
          <input
            id="email"
            type="email"
            placeholder="john@example.com"
            autoFocus
            {...register('email')}
            className="dark:border-slate-750 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-[#06080e] dark:text-slate-100"
          />
          {errors.email && (
            <p className="text-xs text-rose-600">{errors.email.message}</p>
          )}
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {t('Enter the email address associated with your account')}
          </p>
        </div>

        {error === 'not-found' && (
          <div className="flex gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-amber-700 dark:text-amber-300">
                {t(
                  'No account found with that email address. Please check and try again.'
                )}
              </p>
              <Link
                href="/register"
                className="mt-1 block font-semibold text-amber-600 underline dark:text-amber-400"
              >
                {t('Create an account')}
              </Link>
            </div>
          </div>
        )}

        {error === 'rate-limit' && (
          <div className="flex gap-2.5 rounded-xl border border-orange-500/40 bg-orange-500/10 p-3 text-xs">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
            <div>
              <p className="text-orange-700 dark:text-orange-300">
                {t(
                  'Too many password reset requests. Please wait 10 minutes before trying again.'
                )}
              </p>
              <p className="mt-1 font-mono text-orange-700 dark:text-orange-300">
                {t('Try again in')} {formatTime(countdown)}
              </p>
            </div>
          </div>
        )}

        {error === 'server' && (
          <div className="flex gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <p className="text-rose-700 dark:text-rose-300">
              {t('Something went wrong. Please try again later.')}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={!isValid || isLoading || error === 'rate-limit'}
          className="h-10 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 transition-all hover:from-amber-400 hover:to-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              {t('Sending...')}
            </>
          ) : (
            t('Send Reset Link')
          )}
        </button>
      </form>

      <div className="flex gap-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <p className="text-blue-700 dark:text-blue-300">
          {t(
            "You'll receive an email with a link to reset your password. The link will expire in 1 hour."
          )}
        </p>
      </div>
    </div>
  );
}

// Step 2: Email Sent Confirmation
function ConfirmationStep({
  email,
  setStep,
  setError,
}: {
  email: string;
  setStep: (step: Step) => void;
  setError: (error: ErrorType) => void;
}): JSX.Element {
  const { t } = useLocale();
  const [isResending, setIsResending] = useState(false);

  const handleResend = async (): Promise<void> => {
    setIsResending(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsResending(false);
  };

  const handleTryAnother = (): void => {
    setStep('request');
    setError(null);
  };

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl backdrop-blur-xl dark:border-slate-800/80 dark:bg-[#0b0e17]">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {t('Check Your Email')}
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {t("We've sent password reset instructions to:")}
        </p>
        <div className="mt-2 inline-block rounded-lg bg-slate-100 px-4 py-2 dark:bg-slate-800">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {email}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#06080e]">
        <h2 className="mb-2 text-xs font-bold text-slate-900 dark:text-slate-200">
          {t('Next Steps:')}
        </h2>
        <ol className="list-inside list-decimal space-y-1 text-xs text-slate-600 dark:text-slate-400">
          <li>{t('Open the email from DavinTrade')}</li>
          <li>{t("Click the 'Reset Password' button")}</li>
          <li>{t('Create your new password')}</li>
        </ol>
      </div>

      <div className="text-center">
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          {t("Didn't receive the email?")}
        </p>
        <div className="flex justify-center gap-2">
          <Button
            onClick={handleResend}
            disabled={isResending}
            variant="outline"
          >
            {isResending ? (
              <>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                {t('Resending...')}
              </>
            ) : (
              t('Resend Email')
            )}
          </Button>
          <Button onClick={handleTryAnother} variant="outline">
            {t('Try Another Email')}
          </Button>
        </div>
        <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
          {t('Check your spam folder')}
        </p>
      </div>

      <Link
        href="/login"
        className="block text-center text-xs font-semibold text-amber-600 hover:underline dark:text-amber-400"
      >
        <ArrowLeft className="mr-1 inline h-3.5 w-3.5" /> {t('Back to login')}
      </Link>
    </div>
  );
}

// Step 3: Reset Password Form (legacy combined-flow path — the live reset
// email links to /reset-password?token=... instead; this step stays wired
// for the token-in-this-page-URL shape but is effectively unreachable in
// production, matching 4b-21-auth-cutover.migration-order.md's own note).
function ResetPasswordStep({
  setStep,
  tokenExpired,
  tokenInvalid,
  setTokenExpired,
  searchParams,
}: {
  setStep: (step: Step) => void;
  tokenExpired: boolean;
  tokenInvalid: boolean;
  setTokenExpired: (expired: boolean) => void;
  searchParams: ReturnType<typeof useSearchParams>;
}): JSX.Element {
  const router = useRouter();
  const { t } = useLocale();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onChange',
  });

  const password = watch('password', '');
  const confirmPassword = watch('confirmPassword', '');

  const validations = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };

  const onSubmit = async (data: ResetPasswordFormData): Promise<void> => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Missing reset token. Please request a new link.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Bridge path (Session 4B-21, DECISION-LOG.md F56): request-only, no
      // session-cache refresh needed (Entry Criterion 1 doesn't apply here).
      // NOTE — this step's own `newPassword` field name is a pre-existing
      // mismatch against both the legacy route's and the bridge route's real
      // `password` field (see 4b-21-auth-cutover.migration-order.md
      // Deviations) — this component's own reset step is unreachable in
      // practice (nothing links to /forgot-password?token=..., the real
      // reset email points at /reset-password?token=... instead). Preserved
      // byte-for-byte, not fixed — out of this session's UI-BUILD scope.
      const endpoint = isAuthBridgeEnabled()
        ? '/api/auth/token-reset-password'
        : '/api/auth/reset-password';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword: data.password,
        }),
      });

      if (response.ok) {
        setStep('success');
      } else {
        const result = await response.json();
        setError(
          result.error || 'Failed to reset password. The link may have expired.'
        );
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestNewLink = (): void => {
    setTokenExpired(false);
    router.push('/forgot-password');
  };

  if (tokenExpired || tokenInvalid) {
    return (
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl dark:border-slate-800/80 dark:bg-[#0b0e17]">
        <div className="flex gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <div>
            <p className="text-rose-700 dark:text-rose-300">
              {tokenExpired
                ? t(
                    'This password reset link has expired. Please request a new one.'
                  )
                : t('Invalid password reset link. Please request a new one.')}
            </p>
            <Button onClick={handleRequestNewLink} className="mt-3" size="sm">
              {t('Request New Link')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl backdrop-blur-xl dark:border-slate-800/80 dark:bg-[#0b0e17]">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <Key className="h-6 w-6" />
        </div>
        <h1 className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
          {t('Create New Password')}
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {t('Choose a strong password for your account')}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            {t('New Password')}
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder={t('Enter new password')}
              {...register('password')}
              className="dark:border-slate-750 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 pr-10 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-[#06080e] dark:text-slate-100"
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

          {password && (
            <div className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-[#070910]">
              {[
                { key: 'length', label: t('At least 8 characters') },
                { key: 'uppercase', label: t('One uppercase letter') },
                { key: 'lowercase', label: t('One lowercase letter') },
                { key: 'number', label: t('One number') },
              ].map(({ key, label }) => {
                const passed = validations[key as keyof typeof validations];
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
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="confirmPassword"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            {t('Confirm New Password')}
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder={t('Confirm new password')}
              {...register('confirmPassword')}
              className="dark:border-slate-750 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 pr-10 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-[#06080e] dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
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

        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!isValid || isLoading}
          className="h-10 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 transition-all hover:from-amber-400 hover:to-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              {t('Resetting...')}
            </>
          ) : (
            t('Update Password')
          )}
        </button>
      </form>
    </div>
  );
}

// Success State
function SuccessStep({
  autoRedirectCountdown,
}: {
  autoRedirectCountdown: number;
}): JSX.Element {
  const { t } = useLocale();
  return (
    <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xl dark:border-slate-800/80 dark:bg-[#0b0e17]">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-7 w-7" />
      </div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
        {t('Password Reset Successful!')}
      </h1>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {t(
          'Your password has been successfully reset. You can now log in with your new password.'
        )}
      </p>

      <Button asChild className="w-full">
        <Link href="/login">{t('Go to Login')}</Link>
      </Button>

      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        {t('Redirecting in')} {autoRedirectCountdown} {t('seconds...')}
      </p>
    </div>
  );
}

// Wrap with Suspense for useSearchParams
export default function ForgotPasswordPage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl dark:border-slate-800/80 dark:bg-[#0b0e17]">
          <div className="py-8 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-500" />
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Loading...
            </p>
          </div>
        </div>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
