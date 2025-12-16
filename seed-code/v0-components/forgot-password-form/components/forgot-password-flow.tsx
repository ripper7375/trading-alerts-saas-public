'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { cn } from '@/lib/utils';

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
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(
        /[!@#$%^&*]/,
        'Password must contain at least one special character'
      ),
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

export default function ForgotPasswordFlow() {
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<ErrorType>(null);
  const [countdown, setCountdown] = useState(600); // 10 minutes in seconds
  const [autoRedirectCountdown, setAutoRedirectCountdown] = useState(3);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [tokenInvalid, setTokenInvalid] = useState(false);

  // Simulate token validation on component mount for reset step
  useEffect(() => {
    // Check URL for reset token (mock)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
      // Mock token validation
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
  }, []);

  // Rate limit countdown
  useEffect(() => {
    if (error === 'rate-limit' && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [error, countdown]);

  // Auto-redirect countdown
  useEffect(() => {
    if (step === 'success' && autoRedirectCountdown > 0) {
      const timer = setInterval(() => {
        setAutoRedirectCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (step === 'success' && autoRedirectCountdown === 0) {
      // Mock redirect to login
      console.log('Redirecting to login...');
    }
  }, [step, autoRedirectCountdown]);

  const formatTime = (seconds: number) => {
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
}) {
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    mode: 'onChange',
  });

  const onSubmit = async (data: EmailFormData) => {
    setIsLoading(true);
    setError(null);

    // Mock API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Simulate different error scenarios (for demo purposes)
    const randomError = Math.random();

    if (data.email === 'notfound@example.com') {
      setError('not-found');
      setIsLoading(false);
      return;
    }

    if (data.email === 'ratelimit@example.com') {
      setError('rate-limit');
      setIsLoading(false);
      return;
    }

    if (data.email === 'error@example.com') {
      setError('server');
      setIsLoading(false);
      return;
    }

    setEmail(data.email);
    setIsLoading(false);
    setStep('confirmation');
  };

  return (
    <Card className="bg-white shadow-xl p-8 animate-in fade-in duration-300">
      <button
        onClick={() => console.log('Navigate to login')}
        className="text-sm text-blue-600 hover:underline cursor-pointer mb-6 inline-flex items-center gap-1"
      >
        ← Back to login
      </button>

      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <Lock className="size-16 text-gray-700" />
        </div>
        <h1 className="text-3xl font-bold mb-2 text-gray-900">
          Forgot Password?
        </h1>
        <p className="text-gray-600">
          {"No worries, we'll send you reset instructions"}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <Label htmlFor="email" className="font-medium text-gray-700 mb-2">
            Email Address
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="john@example.com"
            autoFocus
            aria-invalid={!!errors.email}
            {...register('email')}
            className="mt-2"
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
              <AlertTriangle className="size-5 text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-800">
                  No account found with that email address. Please check and try
                  again.
                </p>
                <button className="text-sm text-blue-600 underline mt-1">
                  Create an account
                </button>
              </div>
            </div>
          </div>
        )}

        {error === 'rate-limit' && (
          <div className="bg-orange-50 border-l-4 border-orange-500 rounded-lg p-4 animate-in fade-in">
            <div className="flex gap-3">
              <AlertTriangle className="size-5 text-orange-600 shrink-0 mt-0.5" />
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
              <AlertTriangle className="size-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-800">
                  Something went wrong. Please try again later.
                </p>
              </div>
            </div>
          </div>
        )}

        <Button
          type="submit"
          disabled={!isValid || isLoading || error === 'rate-limit'}
          className="w-full bg-blue-600 hover:bg-blue-700 py-3 text-lg font-semibold rounded-lg shadow-lg h-auto"
        >
          {isLoading ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              Sending...
            </>
          ) : (
            'Send Reset Link'
          )}
        </Button>
      </form>

      <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 mt-6">
        <div className="flex gap-3">
          <Info className="size-5 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            {
              "You'll receive an email with a link to reset your password. The link will expire in 1 hour."
            }
          </p>
        </div>
      </div>
    </Card>
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
}) {
  const [isResending, setIsResending] = useState(false);

  const handleResend = async () => {
    setIsResending(true);
    // Mock API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsResending(false);
  };

  const handleTryAnother = () => {
    setStep('request');
    setError(null);
  };

  return (
    <Card className="bg-white shadow-xl p-8 animate-in fade-in duration-300">
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <CheckCircle2 className="size-20 text-green-600 animate-in zoom-in duration-500" />
        </div>
        <h1 className="text-3xl font-bold mb-2 text-gray-900">
          Check Your Email
        </h1>
        <p className="text-gray-600 mb-2">
          {"We've sent password reset instructions to:"}
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
            {"Click the 'Reset Password' button"}
          </li>
          <li className="text-gray-700">Create your new password</li>
        </ol>
      </div>

      <div className="mt-8 text-center">
        <p className="text-gray-600 mb-3">{"Didn't receive the email?"}</p>
        <div className="flex gap-3 justify-center">
          <Button
            onClick={handleResend}
            disabled={isResending}
            variant="outline"
            className="border-2 border-blue-600 text-blue-600 px-6 py-2 rounded-lg hover:bg-blue-50 bg-transparent"
          >
            {isResending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Resending...
              </>
            ) : (
              'Resend Email'
            )}
          </Button>
          <Button
            onClick={handleTryAnother}
            variant="outline"
            className="border-2 border-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-50 bg-transparent"
          >
            Try Another Email
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-4">Check your spam folder</p>
      </div>

      <button
        onClick={() => console.log('Navigate to login')}
        className="text-blue-600 hover:underline text-center block mt-8 mx-auto"
      >
        ← Back to login
      </button>
    </Card>
  );
}

// Step 3: Reset Password Form
function ResetPasswordStep({
  setStep,
  tokenExpired,
  tokenInvalid,
  setTokenExpired,
}: {
  setStep: (step: Step) => void;
  tokenExpired: boolean;
  tokenInvalid: boolean;
  setTokenExpired: (expired: boolean) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordValue, setPasswordValue] = useState('');

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
    special: /[!@#$%^&*]/.test(password),
  };

  // Password strength
  const strength = Object.values(validations).filter(Boolean).length;
  const getStrengthColor = () => {
    if (strength <= 2) return 'bg-red-500';
    if (strength <= 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };
  const getStrengthWidth = () => {
    if (strength <= 2) return 'w-1/3';
    if (strength <= 4) return 'w-2/3';
    return 'w-full';
  };
  const getStrengthLabel = () => {
    if (strength <= 2) return 'Weak';
    if (strength <= 4) return 'Medium';
    return 'Strong';
  };

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true);

    // Mock API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setIsLoading(false);
    setStep('success');
  };

  const handleRequestNewLink = () => {
    setTokenExpired(false);
    setStep('request');
  };

  if (tokenExpired) {
    return (
      <Card className="bg-white shadow-xl p-8 animate-in fade-in duration-300">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex gap-3">
            <AlertTriangle className="size-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-800">
                This password reset link has expired. Please request a new one.
              </p>
              <Button
                onClick={handleRequestNewLink}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg mt-4"
              >
                Request New Link
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (tokenInvalid) {
    return (
      <Card className="bg-white shadow-xl p-8 animate-in fade-in duration-300">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex gap-3">
            <AlertTriangle className="size-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-800">
                Invalid password reset link. Please request a new one.
              </p>
              <Button
                onClick={handleRequestNewLink}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg mt-4"
              >
                Request New Link
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-white shadow-xl p-8 animate-in fade-in duration-300">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <Key className="size-16 text-gray-700" />
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
          <Label htmlFor="password" className="font-medium text-gray-700 mb-2">
            New Password
          </Label>
          <div className="relative mt-2">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter new password"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? (
                <EyeOff className="size-5" />
              ) : (
                <Eye className="size-5" />
              )}
            </button>
          </div>

          {password && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Password strength:</span>
                <span
                  className={cn(
                    'font-medium',
                    strength <= 2 && 'text-red-600',
                    strength > 2 && strength <= 4 && 'text-yellow-600',
                    strength > 4 && 'text-green-600'
                  )}
                >
                  {getStrengthLabel()}
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-300',
                    getStrengthColor(),
                    getStrengthWidth()
                  )}
                />
              </div>

              <div className="space-y-1 mt-3">
                <ValidationItem
                  isValid={validations.length}
                  text="At least 8 characters"
                />
                <ValidationItem
                  isValid={validations.uppercase}
                  text="One uppercase letter"
                />
                <ValidationItem
                  isValid={validations.lowercase}
                  text="One lowercase letter"
                />
                <ValidationItem
                  isValid={validations.number}
                  text="One number"
                />
                <ValidationItem
                  isValid={validations.special}
                  text="One special character (!@#$%^&*)"
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <Label
            htmlFor="confirmPassword"
            className="font-medium text-gray-700 mb-2"
          >
            Confirm New Password
          </Label>
          <div className="relative mt-2">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm new password"
              aria-invalid={!!errors.confirmPassword}
              {...register('confirmPassword')}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showConfirmPassword ? (
                <EyeOff className="size-5" />
              ) : (
                <Eye className="size-5" />
              )}
            </button>
            {confirmPassword &&
              password === confirmPassword &&
              !errors.confirmPassword && (
                <Check className="size-5 text-green-600 absolute right-10 top-1/2 -translate-y-1/2" />
              )}
          </div>
          {errors.confirmPassword && (
            <p className="text-sm text-red-600 mt-1">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={!isValid || isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 py-3 text-lg font-semibold rounded-lg shadow-lg h-auto"
        >
          {isLoading ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              Resetting...
            </>
          ) : (
            'Reset Password'
          )}
        </Button>
      </form>
    </Card>
  );
}

// Validation Item Component
function ValidationItem({ isValid, text }: { isValid: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {isValid ? (
        <Check className="size-4 text-green-600" />
      ) : (
        <X className="size-4 text-gray-400" />
      )}
      <span className={isValid ? 'text-green-600' : 'text-gray-600'}>
        {text}
      </span>
    </div>
  );
}

// Success State
function SuccessStep({
  autoRedirectCountdown,
}: {
  autoRedirectCountdown: number;
}) {
  return (
    <Card className="bg-white shadow-xl p-8 animate-in fade-in duration-300">
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <CheckCircle2 className="size-20 text-green-600 animate-in zoom-in duration-500" />
        </div>
        <h1 className="text-3xl font-bold mb-2 text-gray-900">
          Password Reset Successful!
        </h1>
        <p className="text-gray-600 mb-8">
          Your password has been successfully reset. You can now log in with
          your new password.
        </p>

        <Button
          onClick={() => console.log('Navigate to login')}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 shadow-lg h-auto"
        >
          Go to Login
        </Button>

        <p className="text-sm text-gray-500 mt-4">
          Redirecting in {autoRedirectCountdown} seconds...
        </p>
      </div>
    </Card>
  );
}
