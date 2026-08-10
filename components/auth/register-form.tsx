'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Check, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { isAuthBridgeEnabled } from '@/lib/auth/auth-bridge-flag';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

import SocialAuthButtons from './social-auth-buttons';

// Enhanced validation schema with password confirmation
const registrationSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email format'),
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
    referralCode: z.string().optional(),
    agreedToTerms: z
      .boolean()
      .refine((val) => val === true, 'You must agree to terms'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegistrationFormData = z.infer<typeof registrationSchema>;

export default function RegisterForm(): JSX.Element {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Get dynamic affiliate config from SystemConfig
  const { discountPercent, regularPrice, calculateDiscountedPrice } =
    useAffiliateConfig();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Referral code state
  const [referralCode, setReferralCode] = useState('');
  const [verifiedCode, setVerifiedCode] = useState<string | null>(null);
  const [isCodeValid, setIsCodeValid] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, touchedFields, isValid },
  } = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      referralCode: '',
      agreedToTerms: false,
    },
  });

  const password = watch('password');
  const name = watch('name');
  const email = watch('email');
  const confirmPassword = watch('confirmPassword');

  // Password validation checks
  const passwordValidation = {
    minLength: password?.length >= 8,
    hasUppercase: /[A-Z]/.test(password || ''),
    hasLowercase: /[a-z]/.test(password || ''),
    hasNumber: /[0-9]/.test(password || ''),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password || ''),
  };

  // Pre-fill referral code from URL
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      const upperCode = refCode.toUpperCase();
      setReferralCode(upperCode);
      setValue('referralCode', upperCode, { shouldValidate: true });
      verifyCode(upperCode);
    }
  }, [searchParams, setValue]);

  // Verify referral code
  const verifyCode = async (code: string): Promise<void> => {
    if (code.length < 6) return;

    setIsVerifying(true);
    setCodeError('');

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Mock validation - In production, this would call /api/affiliate/verify-code
    // For now, accept any code starting with REF- and at least 6 characters
    const isValid = code.startsWith('REF-') && code.length >= 10;

    if (isValid) {
      setIsCodeValid(true);
      setVerifiedCode(code);
      setCodeError('');
    } else {
      setIsCodeValid(false);
      setVerifiedCode(null);
      setCodeError('Invalid or expired referral code');
    }

    setIsVerifying(false);
  };

  const onSubmit = async (data: RegistrationFormData): Promise<void> => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Include affiliate code if verified
      const submitData = {
        name: data.name,
        email: data.email,
        password: data.password,
        referralCode: verifiedCode || undefined,
      };

      // Bridge path (Session 4B-20, DECISION-LOG.md F56): token-register
      // forwards to operation-service's /auth/register instead of the
      // monolith's own Prisma-backed handler. Gated behind
      // NEXT_PUBLIC_AUTH_BRIDGE_ENABLED (default false) — dormant/parallel
      // until Session 4B-21's own cutover. Both routes ignore
      // submitData.referralCode identically (neither's schema reads it —
      // pre-existing behavior, unrelated to this migration).
      const registerEndpoint = isAuthBridgeEnabled()
        ? '/api/auth/token-register'
        : '/api/auth/register';

      const response = await fetch(registerEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      const responseData = await response.json();

      if (response.ok) {
        // Redirect to verification pending page with email
        const encodedEmail = encodeURIComponent(data.email);
        router.push(`/verify-email/pending?email=${encodedEmail}`);
        return;
      } else if (response.status === 409) {
        setError('An account with this email already exists.');
      } else if (response.status === 503) {
        setError('Database connection error. Please try again later.');
      } else {
        // Display the actual error message from the API if available
        setError(
          responseData?.error || 'Registration failed. Please try again.'
        );
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="rounded-lg bg-card p-8 shadow-xl">
        <h1 className="mb-6 text-center text-3xl font-bold text-foreground">
          Create Your Account
        </h1>
        <p className="mb-8 text-center text-muted-foreground">
          Start trading smarter today
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Full Name */}
          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Full Name
            </label>
            <div className="relative">
              <input
                id="name"
                type="text"
                placeholder="John Trader"
                {...register('name')}
                className={`w-full rounded-md border bg-background px-3 py-2 text-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.name && touchedFields.name
                    ? 'border-red-500'
                    : touchedFields.name && name?.length >= 2
                      ? 'border-green-500'
                      : 'border-border'
                }`}
              />
              {touchedFields.name && name?.length >= 2 && !errors.name && (
                <Check className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-green-600" />
              )}
            </div>
            {errors.name && touchedFields.name && (
              <p className="mt-1 flex items-center gap-1 text-sm text-red-600">
                <X className="h-4 w-4" />
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Email Address
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                placeholder="john@example.com"
                {...register('email')}
                className={`w-full rounded-md border bg-background px-3 py-2 text-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.email && touchedFields.email
                    ? 'border-red-500'
                    : touchedFields.email && !errors.email && email
                      ? 'border-green-500'
                      : 'border-border'
                }`}
              />
              {touchedFields.email && !errors.email && email && (
                <Check className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-green-600" />
              )}
            </div>
            {errors.email && touchedFields.email && (
              <p className="mt-1 flex items-center gap-1 text-sm text-red-600">
                <X className="h-4 w-4" />
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
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

            {/* Password Requirements */}
            {password && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  {passwordValidation.minLength ? (
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span
                    className={
                      passwordValidation.minLength
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-muted-foreground'
                    }
                  >
                    At least 8 characters
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {passwordValidation.hasUppercase ? (
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span
                    className={
                      passwordValidation.hasUppercase
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-muted-foreground'
                    }
                  >
                    One uppercase letter
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {passwordValidation.hasLowercase ? (
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span
                    className={
                      passwordValidation.hasLowercase
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-muted-foreground'
                    }
                  >
                    One lowercase letter
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {passwordValidation.hasNumber ? (
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span
                    className={
                      passwordValidation.hasNumber
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-muted-foreground'
                    }
                  >
                    One number
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {passwordValidation.hasSpecial ? (
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span
                    className={
                      passwordValidation.hasSpecial
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-muted-foreground'
                    }
                  >
                    One special character (!@#$%^&*)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('confirmPassword')}
                className={`w-full rounded-md border bg-background px-3 py-2 pr-10 text-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.confirmPassword && touchedFields.confirmPassword
                    ? 'border-red-500'
                    : touchedFields.confirmPassword &&
                        confirmPassword === password &&
                        password
                      ? 'border-green-500'
                      : 'border-border'
                }`}
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
              {touchedFields.confirmPassword &&
                confirmPassword === password &&
                password &&
                !errors.confirmPassword && (
                  <Check className="absolute right-10 top-1/2 h-5 w-5 -translate-y-1/2 text-green-600" />
                )}
            </div>
            {errors.confirmPassword && touchedFields.confirmPassword && (
              <p className="mt-1 flex items-center gap-1 text-sm text-red-600">
                <X className="h-4 w-4" />
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* REFERRAL CODE - Business Critical Feature */}
          <div>
            <label
              htmlFor="referralCode"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Referral Code (Optional)
            </label>
            <p className="mb-1 text-xs text-primary">
              Have an affiliate code? Get {discountPercent}% off this month!
            </p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  id="referralCode"
                  type="text"
                  placeholder="REF-ABC123XYZ"
                  value={referralCode}
                  onChange={(e) => {
                    const upper = e.target.value.toUpperCase();
                    setReferralCode(upper);
                    setValue('referralCode', upper, { shouldValidate: true });
                    // Reset validation states when user types
                    if (isCodeValid || codeError) {
                      setIsCodeValid(false);
                      setCodeError('');
                      setVerifiedCode(null);
                    }
                  }}
                  className={`w-full rounded-md border bg-background px-3 py-2 pr-10 text-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary ${
                    isCodeValid
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : codeError
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                        : 'border-border'
                  }`}
                  maxLength={20}
                />
                {isCodeValid && (
                  <Check className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-green-600" />
                )}
                {codeError && (
                  <X className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-red-600" />
                )}
              </div>
              <button
                type="button"
                onClick={() => verifyCode(referralCode)}
                disabled={referralCode.length < 6 || isVerifying}
                className="hover:bg-muted/80 rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="inline h-4 w-4 animate-spin" />
                  </>
                ) : (
                  'Verify'
                )}
              </button>
            </div>
            {isCodeValid && (
              <>
                <p className="mt-1 flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                  <Check className="h-4 w-4 flex-shrink-0" />
                  Valid code! You&apos;ll get {discountPercent}% off PRO ($
                  {calculateDiscountedPrice(regularPrice).toFixed(2)}/month
                  instead of ${regularPrice.toFixed(2)})
                </p>
                <span className="mt-2 inline-block rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-300">
                  🎉 {discountPercent}% DISCOUNT APPLIED
                </span>
              </>
            )}
            {codeError && (
              <p className="mt-1 flex items-center gap-1 text-sm text-red-600">
                <X className="h-4 w-4" />
                {codeError}
              </p>
            )}
          </div>

          {/* Terms Checkbox */}
          <div className="flex items-start gap-3">
            <input
              id="terms"
              type="checkbox"
              {...register('agreedToTerms')}
              className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <div className="flex-1">
              <label
                htmlFor="terms"
                className="cursor-pointer text-sm leading-relaxed text-muted-foreground"
              >
                I agree to the{' '}
                <Link
                  href="/terms"
                  className="hover:text-primary/80 text-primary underline"
                >
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link
                  href="/privacy"
                  className="hover:text-primary/80 text-primary underline"
                >
                  Privacy Policy
                </Link>
              </label>
              {errors.agreedToTerms && (
                <p className="mt-1 flex items-center gap-1 text-sm text-red-600">
                  <X className="h-4 w-4" />
                  {errors.agreedToTerms.message}
                </p>
              )}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <div className="text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="hover:bg-primary/90 w-full rounded-md bg-primary py-3 text-lg font-semibold text-primary-foreground shadow-lg transition-all duration-200 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 inline h-5 w-5 animate-spin" />
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-card px-4 text-muted-foreground">
              Or register with
            </span>
          </div>
        </div>

        {/* Social Auth */}
        <SocialAuthButtons />

        {/* Footer Links */}
        <div className="mt-6 space-y-2 text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-semibold text-primary hover:underline"
            >
              Login
            </Link>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            <Link
              href="/forgot-password"
              className="text-primary hover:underline"
            >
              Forgot password?
            </Link>
            <span className="text-muted-foreground">—</span>
            <Link
              href="/affiliate/register"
              className="text-xs text-primary hover:underline"
            >
              Don&apos;t have a referral code? Join our Affiliate Program
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
