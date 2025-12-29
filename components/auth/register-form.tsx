'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Check, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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

      const response = await fetch('/api/auth/register', {
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
        setError(responseData?.error || 'Registration failed. Please try again.');
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
      <div className="bg-card rounded-lg shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center mb-6 text-foreground">
          Create Your Account
        </h1>
        <p className="text-muted-foreground text-center mb-8">
          Start trading smarter today
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Full Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Full Name
            </label>
            <div className="relative">
              <input
                id="name"
                type="text"
                placeholder="John Trader"
                {...register('name')}
                className={`w-full px-3 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200 ${
                  errors.name && touchedFields.name
                    ? 'border-red-500'
                    : touchedFields.name && name?.length >= 2
                      ? 'border-green-500'
                      : 'border-border'
                }`}
              />
              {touchedFields.name && name?.length >= 2 && !errors.name && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
              )}
            </div>
            {errors.name && touchedFields.name && (
              <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                <X className="w-4 h-4" />
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Email Address
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                placeholder="john@example.com"
                {...register('email')}
                className={`w-full px-3 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200 ${
                  errors.email && touchedFields.email
                    ? 'border-red-500'
                    : touchedFields.email && !errors.email && email
                      ? 'border-green-500'
                      : 'border-border'
                }`}
              />
              {touchedFields.email && !errors.email && email && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
              )}
            </div>
            {errors.email && touchedFields.email && (
              <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                <X className="w-4 h-4" />
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password')}
                className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Password Requirements */}
            {password && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  {passwordValidation.minLength ? (
                    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <X className="w-4 h-4 text-muted-foreground" />
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
                    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <X className="w-4 h-4 text-muted-foreground" />
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
                    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <X className="w-4 h-4 text-muted-foreground" />
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
                    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <X className="w-4 h-4 text-muted-foreground" />
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
                    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <X className="w-4 h-4 text-muted-foreground" />
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
              className="block text-sm font-medium text-foreground mb-1"
            >
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('confirmPassword')}
                className={`w-full px-3 py-2 pr-10 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200 ${
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
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
              {touchedFields.confirmPassword &&
                confirmPassword === password &&
                password &&
                !errors.confirmPassword && (
                  <Check className="w-5 h-5 text-green-600 absolute right-10 top-1/2 -translate-y-1/2" />
                )}
            </div>
            {errors.confirmPassword && touchedFields.confirmPassword && (
              <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                <X className="w-4 h-4" />
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* REFERRAL CODE - Business Critical Feature */}
          <div>
            <label
              htmlFor="referralCode"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Referral Code (Optional)
            </label>
            <p className="text-xs text-primary mb-1">
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
                  className={`w-full px-3 py-2 pr-10 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200 ${
                    isCodeValid
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : codeError
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                        : 'border-border'
                  }`}
                  maxLength={20}
                />
                {isCodeValid && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                )}
                {codeError && (
                  <X className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-600" />
                )}
              </div>
              <button
                type="button"
                onClick={() => verifyCode(referralCode)}
                disabled={referralCode.length < 6 || isVerifying}
                className="px-4 py-2 bg-muted border border-border rounded-md hover:bg-muted/80 text-sm font-medium text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin inline" />
                  </>
                ) : (
                  'Verify'
                )}
              </button>
            </div>
            {isCodeValid && (
              <>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  Valid code! You&apos;ll get {discountPercent}% off PRO ($
                  {calculateDiscountedPrice(regularPrice).toFixed(2)}/month
                  instead of ${regularPrice.toFixed(2)})
                </p>
                <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-3 py-1 rounded-full text-sm font-semibold mt-2 inline-block">
                  🎉 {discountPercent}% DISCOUNT APPLIED
                </span>
              </>
            )}
            {codeError && (
              <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                <X className="w-4 h-4" />
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
                className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
              >
                I agree to the{' '}
                <Link
                  href="/terms"
                  className="text-primary underline hover:text-primary/80"
                >
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link
                  href="/privacy"
                  className="text-primary underline hover:text-primary/80"
                >
                  Privacy Policy
                </Link>
              </label>
              {errors.agreedToTerms && (
                <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                  <X className="w-4 h-4" />
                  {errors.agreedToTerms.message}
                </p>
              )}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
              <div className="text-sm text-red-700 dark:text-red-300">{error}</div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="w-full bg-primary hover:bg-primary/90 py-3 text-lg font-semibold rounded-md text-primary-foreground disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 inline animate-spin mr-2" />
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
            <span className="px-4 bg-card text-muted-foreground">
              Or register with
            </span>
          </div>
        </div>

        {/* Social Auth */}
        <SocialAuthButtons />

        {/* Footer Links */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-muted-foreground text-sm">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-primary font-semibold hover:underline"
            >
              Login
            </Link>
          </p>
          <div className="flex items-center justify-center gap-2 text-sm flex-wrap">
            <Link
              href="/forgot-password"
              className="text-primary hover:underline"
            >
              Forgot password?
            </Link>
            <span className="text-muted-foreground">—</span>
            <Link
              href="/affiliate/join"
              className="text-primary hover:underline text-xs"
            >
              Don&apos;t have a referral code? Join our Affiliate Program
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
