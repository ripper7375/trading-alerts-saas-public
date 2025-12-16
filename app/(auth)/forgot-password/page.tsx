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
      const response = await fetch('/api/auth/forgot-password', {
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
    <div className="bg-white shadow-xl p-8 rounded-lg animate-in fade-in duration-300">
      <Link
        href="/login"
        className="text-sm text-blue-600 hover:underline cursor-pointer mb-6 inline-flex items-center gap-1"
      >
        ← Back to login
      </Link>

      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <Lock className="w-16 h-16 text-gray-700" />
        </div>
        <h1 className="text-3xl font-bold mb-2 text-gray-900">
          Forgot Password?
        </h1>
        <p className="text-gray-600">
          No worries, we&apos;ll send you reset instructions
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Email Address
          </label>
          <input
            id="email"
            type="email"
            placeholder="john@example.com"
            autoFocus
            {...register('email')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {errors.email && (
            <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Enter the email address associated with your account
          </p>
        </div>

        {error === 'not-found' && (
          <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-4 animate-in fade-in">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-800">
                  No account found with that email address. Please check and try
                  again.
                </p>
                <Link
                  href="/register"
                  className="text-sm text-blue-600 underline mt-1 block"
                >
                  Create an account
                </Link>
              </div>
            </div>
          </div>
        )}

        {error === 'rate-limit' && (
          <div className="bg-orange-50 border-l-4 border-orange-500 rounded-lg p-4 animate-in fade-in">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-orange-800">
                  Too many password reset requests. Please wait 10 minutes
                  before trying again.
                </p>
                <p className="text-sm text-orange-800 font-mono mt-1">
                  Try again in {formatTime(countdown)}
                </p>
              </div>
            </div>
          </div>
        )}

        {error === 'server' && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 animate-in fade-in">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
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
          className="w-full bg-indigo-600 hover:bg-indigo-700 py-3 text-lg font-semibold rounded-md shadow-lg text-white disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 inline animate-spin mr-2" />
              Sending...
            </>
          ) : (
            'Send Reset Link'
          )}
        </button>
      </form>

      <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 mt-6">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
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
    <div className="bg-white shadow-xl p-8 rounded-lg animate-in fade-in duration-300">
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <CheckCircle2 className="w-20 h-20 text-green-600 animate-in zoom-in duration-500" />
        </div>
        <h1 className="text-3xl font-bold mb-2 text-gray-900">
          Check Your Email
        </h1>
        <p className="text-gray-600 mb-2">
          We&apos;ve sent password reset instructions to:
        </p>
        <div className="inline-block bg-gray-100 px-4 py-2 rounded-lg">
          <p className="text-lg font-semibold text-gray-900">{email}</p>
        </div>
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-xl p-6 mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Next Steps:
        </h2>
        <ol className="space-y-2 list-decimal list-inside">
          <li className="text-gray-700">Open the email from Trading Alerts</li>
          <li className="text-gray-700">
            Click the &apos;Reset Password&apos; button
          </li>
          <li className="text-gray-700">Create your new password</li>
        </ol>
      </div>

      <div className="mt-8 text-center">
        <p className="text-gray-600 mb-3">Didn&apos;t receive the email?</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={handleResend}
            disabled={isResending}
            className="px-6 py-2 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 bg-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isResending ? (
              <>
                <Loader2 className="w-4 h-4 inline animate-spin mr-2" />
                Resending...
              </>
            ) : (
              'Resend Email'
            )}
          </button>
          <button
            onClick={handleTryAnother}
            className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 bg-transparent transition-colors"
          >
            Try Another Email
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-4">Check your spam folder</p>
      </div>

      <Link
        href="/login"
        className="text-blue-600 hover:underline text-center block mt-8 mx-auto"
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
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: data.password,
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
      <div className="bg-white shadow-xl p-8 rounded-lg animate-in fade-in duration-300">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-800">
                {tokenExpired
                  ? 'This password reset link has expired. Please request a new one.'
                  : 'Invalid password reset link. Please request a new one.'}
              </p>
              <button
                onClick={handleRequestNewLink}
                className="bg-blue-600 text-white px-6 py-2 rounded-md mt-4 hover:bg-blue-700 transition-colors"
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
    <div className="bg-white shadow-xl p-8 rounded-lg animate-in fade-in duration-300">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <Key className="w-16 h-16 text-gray-700" />
        </div>
        <h1 className="text-3xl font-bold mb-2 text-gray-900">
          Create New Password
        </h1>
        <p className="text-gray-600">
          Choose a strong password for your account
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            New Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter new password"
              {...register('password')}
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>

          {password && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Password strength:</span>
                <span
                  className={`font-medium ${
                    strength <= 2
                      ? 'text-red-600'
                      : strength <= 3
                        ? 'text-yellow-600'
                        : 'text-green-600'
                  }`}
                >
                  {getStrengthLabel()}
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${getStrengthColor()} ${getStrengthWidth()}`}
                />
              </div>

              <div className="space-y-1 mt-3">
                <div className="flex items-center gap-2 text-sm">
                  {validations.length ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <X className="w-4 h-4 text-gray-400" />
                  )}
                  <span
                    className={
                      validations.length ? 'text-green-600' : 'text-gray-600'
                    }
                  >
                    At least 8 characters
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {validations.uppercase ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <X className="w-4 h-4 text-gray-400" />
                  )}
                  <span
                    className={
                      validations.uppercase ? 'text-green-600' : 'text-gray-600'
                    }
                  >
                    One uppercase letter
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {validations.lowercase ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <X className="w-4 h-4 text-gray-400" />
                  )}
                  <span
                    className={
                      validations.lowercase ? 'text-green-600' : 'text-gray-600'
                    }
                  >
                    One lowercase letter
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {validations.number ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <X className="w-4 h-4 text-gray-400" />
                  )}
                  <span
                    className={
                      validations.number ? 'text-green-600' : 'text-gray-600'
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
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Confirm New Password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm new password"
              {...register('confirmPassword')}
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showConfirmPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
            {confirmPassword &&
              password === confirmPassword &&
              !errors.confirmPassword && (
                <Check className="w-5 h-5 text-green-600 absolute right-10 top-1/2 -translate-y-1/2" />
              )}
          </div>
          {errors.confirmPassword && (
            <p className="text-sm text-red-600 mt-1">
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
          className="w-full bg-indigo-600 hover:bg-indigo-700 py-3 text-lg font-semibold rounded-md shadow-lg text-white disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 inline animate-spin mr-2" />
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
    <div className="bg-white shadow-xl p-8 rounded-lg animate-in fade-in duration-300">
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <CheckCircle2 className="w-20 h-20 text-green-600 animate-in zoom-in duration-500" />
        </div>
        <h1 className="text-3xl font-bold mb-2 text-gray-900">
          Password Reset Successful!
        </h1>
        <p className="text-gray-600 mb-8">
          Your password has been successfully reset. You can now log in with
          your new password.
        </p>

        <Link
          href="/login"
          className="inline-flex items-center px-8 py-3 rounded-md text-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg transition-colors"
        >
          Go to Login
        </Link>

        <p className="text-sm text-gray-500 mt-4">
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
          <div className="bg-white shadow-xl p-8 rounded-lg">
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-indigo-600" />
              <p className="text-gray-600 mt-4">Loading...</p>
            </div>
          </div>
        </div>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
