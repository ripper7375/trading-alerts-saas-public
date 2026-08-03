'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Lock,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  Info,
  AlertTriangle,
  Loader2,
  Check,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { isAuthBridgeEnabled } from '@/lib/auth/auth-bridge-flag';

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
    <div className="animate-in fade-in rounded-lg bg-card p-8 shadow-xl duration-300">
      <Link
        href="/login"
        className="mb-6 inline-flex cursor-pointer items-center gap-1 text-sm text-primary hover:underline"
      >
        ← Back to login
      </Link>

      <div className="mb-8 text-center">
        <div className="mb-4 flex justify-center">
          <Lock className="h-16 w-16 text-muted-foreground" />
        </div>
        <h1 className="mb-2 text-3xl font-bold text-foreground">
          Forgot Password?
        </h1>
        <p className="text-muted-foreground">
          No worries, we&apos;ll send you reset instructions
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-medium text-foreground"
          >
            Email Address
          </label>
          <input
            id="email"
            type="email"
            placeholder="john@example.com"
            autoFocus
            {...register('email')}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Enter the email address associated with your account
          </p>
        </div>

        {error === 'not-found' && (
          <div className="animate-in fade-in rounded-lg border-l-4 border-yellow-500 bg-yellow-50 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
              <div>
                <p className="text-sm text-yellow-800">
                  No account found with that email address. Please check and try
                  again.
                </p>
                <Link
                  href="/register"
                  className="mt-1 block text-sm text-blue-600 underline"
                >
                  Create an account
                </Link>
              </div>
            </div>
          </div>
        )}

        {error === 'rate-limit' && (
          <div className="animate-in fade-in rounded-lg border-l-4 border-orange-500 bg-orange-50 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
              <div>
                <p className="text-sm text-orange-800">
                  Too many password reset requests. Please wait 10 minutes
                  before trying again.
                </p>
                <p className="mt-1 font-mono text-sm text-orange-800">
                  Try again in {formatTime(countdown)}
                </p>
              </div>
            </div>
          </div>
        )}

        {error === 'server' && (
          <div className="animate-in fade-in rounded-lg border-l-4 border-red-500 bg-red-50 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="text-sm text-red-800">
                  Something went wrong. Please try again later.
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={!isValid || isLoading || error === 'rate-limit'}
          className="hover:bg-primary/90 w-full rounded-md bg-primary py-3 text-lg font-semibold text-primary-foreground shadow-lg transition-all duration-200 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 inline h-5 w-5 animate-spin" />
              Sending...
            </>
          ) : (
            'Send Reset Link'
          )}
        </button>
      </form>

      <div className="mt-6 rounded-lg border-l-4 border-blue-500 bg-blue-50 p-4 dark:bg-blue-900/20">
        <div className="flex gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-800 dark:text-blue-300">
            You&apos;ll receive an email with a link to reset your password. The
            link will expire in 1 hour.
          </p>
        </div>
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
    <div className="animate-in fade-in rounded-lg bg-card p-8 shadow-xl duration-300">
      <div className="text-center">
        <div className="mb-6 flex justify-center">
          <CheckCircle2 className="animate-in zoom-in h-20 w-20 text-green-600 duration-500 dark:text-green-400" />
        </div>
        <h1 className="mb-2 text-3xl font-bold text-foreground">
          Check Your Email
        </h1>
        <p className="mb-2 text-muted-foreground">
          We&apos;ve sent password reset instructions to:
        </p>
        <div className="inline-block rounded-lg bg-muted px-4 py-2">
          <p className="text-lg font-semibold text-foreground">{email}</p>
        </div>
      </div>

      <div className="mt-8 rounded-xl border-2 border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Next Steps:
        </h2>
        <ol className="list-inside list-decimal space-y-2">
          <li className="text-muted-foreground">
            Open the email from Trading Alerts
          </li>
          <li className="text-muted-foreground">
            Click the &apos;Reset Password&apos; button
          </li>
          <li className="text-muted-foreground">Create your new password</li>
        </ol>
      </div>

      <div className="mt-8 text-center">
        <p className="mb-3 text-muted-foreground">
          Didn&apos;t receive the email?
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={handleResend}
            disabled={isResending}
            className="hover:bg-primary/10 rounded-lg border-2 border-primary bg-transparent px-6 py-2 text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isResending ? (
              <>
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                Resending...
              </>
            ) : (
              'Resend Email'
            )}
          </button>
          <button
            onClick={handleTryAnother}
            className="rounded-lg border-2 border-border bg-transparent px-6 py-2 text-muted-foreground transition-colors hover:bg-muted"
          >
            Try Another Email
          </button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Check your spam folder
        </p>
      </div>

      <Link
        href="/login"
        className="mx-auto mt-8 block text-center text-primary hover:underline"
      >
        ← Back to login
      </Link>
    </div>
  );
}

// Step 3: Reset Password Form
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

  // Password validation checks
  const validations = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };

  // Password strength
  const strength = Object.values(validations).filter(Boolean).length;
  const getStrengthColor = (): string => {
    if (strength <= 2) return 'bg-red-500';
    if (strength <= 3) return 'bg-yellow-500';
    return 'bg-green-500';
  };
  const getStrengthWidth = (): string => {
    if (strength <= 2) return 'w-1/3';
    if (strength <= 3) return 'w-2/3';
    return 'w-full';
  };
  const getStrengthLabel = (): string => {
    if (strength <= 2) return 'Weak';
    if (strength <= 3) return 'Medium';
    return 'Strong';
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
      // byte-for-byte, not fixed — out of this session's PORT-variant scope.
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
      <div className="animate-in fade-in rounded-lg bg-card p-8 shadow-xl duration-300">
        <div className="rounded-lg border-l-4 border-red-500 bg-red-50 p-4 dark:bg-red-900/20">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            <div>
              <p className="text-sm text-red-800 dark:text-red-300">
                {tokenExpired
                  ? 'This password reset link has expired. Please request a new one.'
                  : 'Invalid password reset link. Please request a new one.'}
              </p>
              <button
                onClick={handleRequestNewLink}
                className="hover:bg-primary/90 mt-4 rounded-md bg-primary px-6 py-2 text-primary-foreground transition-colors"
              >
                Request New Link
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in rounded-lg bg-card p-8 shadow-xl duration-300">
      <div className="mb-8 text-center">
        <div className="mb-4 flex justify-center">
          <Key className="h-16 w-16 text-muted-foreground" />
        </div>
        <h1 className="mb-2 text-3xl font-bold text-foreground">
          Create New Password
        </h1>
        <p className="text-muted-foreground">
          Choose a strong password for your account
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-medium text-foreground"
          >
            New Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter new password"
              {...register('password')}
              className="w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>

          {password && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Password strength:
                </span>
                <span
                  className={`font-medium ${
                    strength <= 2
                      ? 'text-red-600 dark:text-red-400'
                      : strength <= 3
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-green-600 dark:text-green-400'
                  }`}
                >
                  {getStrengthLabel()}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-all duration-300 ${getStrengthColor()} ${getStrengthWidth()}`}
                />
              </div>

              <div className="mt-3 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  {validations.length ? (
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span
                    className={
                      validations.length
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-muted-foreground'
                    }
                  >
                    At least 8 characters
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {validations.uppercase ? (
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span
                    className={
                      validations.uppercase
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-muted-foreground'
                    }
                  >
                    One uppercase letter
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {validations.lowercase ? (
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span
                    className={
                      validations.lowercase
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-muted-foreground'
                    }
                  >
                    One lowercase letter
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {validations.number ? (
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span
                    className={
                      validations.number
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-muted-foreground'
                    }
                  >
                    One number
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-2 block text-sm font-medium text-foreground"
          >
            Confirm New Password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm new password"
              {...register('confirmPassword')}
              className="w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
            {confirmPassword &&
              password === confirmPassword &&
              !errors.confirmPassword && (
                <Check className="absolute right-10 top-1/2 h-5 w-5 -translate-y-1/2 text-green-600" />
              )}
          </div>
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-600">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        <button
          type="submit"
          disabled={!isValid || isLoading}
          className="hover:bg-primary/90 w-full rounded-md bg-primary py-3 text-lg font-semibold text-primary-foreground shadow-lg transition-all duration-200 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 inline h-5 w-5 animate-spin" />
              Resetting...
            </>
          ) : (
            'Reset Password'
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
  return (
    <div className="animate-in fade-in rounded-lg bg-card p-8 shadow-xl duration-300">
      <div className="text-center">
        <div className="mb-6 flex justify-center">
          <CheckCircle2 className="animate-in zoom-in h-20 w-20 text-green-600 duration-500 dark:text-green-400" />
        </div>
        <h1 className="mb-2 text-3xl font-bold text-foreground">
          Password Reset Successful!
        </h1>
        <p className="mb-8 text-muted-foreground">
          Your password has been successfully reset. You can now log in with
          your new password.
        </p>

        <Link
          href="/login"
          className="hover:bg-primary/90 inline-flex items-center rounded-md bg-primary px-8 py-3 text-lg font-semibold text-primary-foreground shadow-lg transition-colors"
        >
          Go to Login
        </Link>

        <p className="mt-4 text-sm text-muted-foreground">
          Redirecting in {autoRedirectCountdown} seconds...
        </p>
      </div>
    </div>
  );
}

// Wrap with Suspense for useSearchParams
export default function ForgotPasswordPage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md">
          <div className="rounded-lg bg-card p-8 shadow-xl">
            <div className="py-8 text-center">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Loading...</p>
            </div>
          </div>
        </div>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
