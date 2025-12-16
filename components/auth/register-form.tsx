'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Check, X, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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
      .regex(/[0-9]/, 'Password must contain at least one number'),
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
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
    reset,
  } = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
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
  };

  // Pre-fill referral code from URL
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      const upperCode = refCode.toUpperCase();
      setReferralCode(upperCode);
      setValue('referralCode', upperCode);
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

      if (response.ok) {
        setSuccess(true);
        reset();
        setError(null);
      } else if (response.status === 409) {
        setError('An account with this email already exists.');
      } else {
        setError('Registration failed. Please try again.');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success screen with animation
  if (success) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Account created successfully!
            </h2>
            {isCodeValid && (
              <p className="text-green-600 font-medium mb-2">
                🎉 20% discount activated! You&apos;ll pay $23.20/month for PRO.
              </p>
            )}
            <p className="text-gray-600 mb-4">
              Please check your email to verify your account.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-lg shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-900">
          Create Your Account
        </h1>
        <p className="text-gray-600 text-center mb-8">
          Start trading smarter today
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Full Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Full Name
            </label>
            <div className="relative">
              <input
                id="name"
                type="text"
                placeholder="John Trader"
                {...register('name')}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200 ${
                  errors.name && touchedFields.name
                    ? 'border-red-500'
                    : touchedFields.name && name?.length >= 2
                      ? 'border-green-500'
                      : 'border-gray-300'
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
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email Address
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                placeholder="john@example.com"
                {...register('email')}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200 ${
                  errors.email && touchedFields.email
                    ? 'border-red-500'
                    : touchedFields.email && !errors.email && email
                      ? 'border-green-500'
                      : 'border-gray-300'
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
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
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

            {/* Password Requirements */}
            {password && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  {passwordValidation.minLength ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <X className="w-4 h-4 text-gray-400" />
                  )}
                  <span
                    className={
                      passwordValidation.minLength
                        ? 'text-green-600'
                        : 'text-gray-600'
                    }
                  >
                    At least 8 characters
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {passwordValidation.hasUppercase ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <X className="w-4 h-4 text-gray-400" />
                  )}
                  <span
                    className={
                      passwordValidation.hasUppercase
                        ? 'text-green-600'
                        : 'text-gray-600'
                    }
                  >
                    One uppercase letter
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {passwordValidation.hasLowercase ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <X className="w-4 h-4 text-gray-400" />
                  )}
                  <span
                    className={
                      passwordValidation.hasLowercase
                        ? 'text-green-600'
                        : 'text-gray-600'
                    }
                  >
                    One lowercase letter
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {passwordValidation.hasNumber ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <X className="w-4 h-4 text-gray-400" />
                  )}
                  <span
                    className={
                      passwordValidation.hasNumber
                        ? 'text-green-600'
                        : 'text-gray-600'
                    }
                  >
                    One number
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('confirmPassword')}
                className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200 ${
                  errors.confirmPassword && touchedFields.confirmPassword
                    ? 'border-red-500'
                    : touchedFields.confirmPassword &&
                        confirmPassword === password &&
                        password
                      ? 'border-green-500'
                      : 'border-gray-300'
                }`}
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
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Referral Code (Optional)
            </label>
            <p className="text-xs text-blue-600 mb-1">
              Have an affiliate code? Get 20% off this month!
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
                    setValue('referralCode', upper);
                    // Reset validation states when user types
                    if (isCodeValid || codeError) {
                      setIsCodeValid(false);
                      setCodeError('');
                      setVerifiedCode(null);
                    }
                  }}
                  className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200 ${
                    isCodeValid
                      ? 'border-green-500 bg-green-50'
                      : codeError
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-300'
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
                className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
                <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  Valid code! You&apos;ll get 20% off PRO ($23.20/month instead
                  of $29)
                </p>
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold mt-2 inline-block">
                  🎉 20% DISCOUNT APPLIED
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
              className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="flex-1">
              <label
                htmlFor="terms"
                className="text-sm text-gray-700 leading-relaxed cursor-pointer"
              >
                I agree to the{' '}
                <Link
                  href="/terms"
                  className="text-blue-600 underline hover:text-blue-700"
                >
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link
                  href="/privacy"
                  className="text-blue-600 underline hover:text-blue-700"
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
            <div className="rounded-md bg-red-50 p-4 border border-red-200">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 py-3 text-lg font-semibold rounded-md text-white disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
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
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">
              Or register with
            </span>
          </div>
        </div>

        {/* Social Auth */}
        <SocialAuthButtons />

        {/* Footer Links */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-gray-600 text-sm">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-blue-600 font-semibold hover:underline"
            >
              Login
            </Link>
          </p>
          <div className="flex items-center justify-center gap-2 text-sm flex-wrap">
            <Link
              href="/forgot-password"
              className="text-blue-600 hover:underline"
            >
              Forgot password?
            </Link>
            <span className="text-gray-300">—</span>
            <Link
              href="/affiliate/join"
              className="text-blue-600 hover:underline text-xs"
            >
              Don&apos;t have a referral code? Join our Affiliate Program
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
