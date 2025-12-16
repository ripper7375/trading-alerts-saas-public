'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Check, X, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import Link from 'next/link';

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

export default function RegistrationForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Referral code state
  const [referralCode, setReferralCode] = useState('');
  const [verifiedCode, setVerifiedCode] = useState<string | null>(null);
  const [isCodeValid, setIsCodeValid] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const searchParams = useSearchParams();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, touchedFields, isValid },
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
  const verifyCode = async (code: string) => {
    if (code.length < 15) return;

    setIsVerifying(true);
    setCodeError('');

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Mock validation - code must start with REF- and be exactly 15 characters
    const isValid = code.startsWith('REF-') && code.length === 15;

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

  const onSubmit = async (data: RegistrationFormData) => {
    setIsLoading(true);

    // Include affiliate code if verified
    const submitData = {
      ...data,
      referralCode: verifiedCode || null,
      discountApplied: isCodeValid,
    };

    console.log('Form submitted:', submitData);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setIsLoading(false);
    setIsSuccess(true);

    // Simulate redirect
    setTimeout(() => {
      console.log('Redirecting to dashboard...');
    }, 2000);
  };

  // Success screen
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md bg-white shadow-xl rounded-xl p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Account created successfully!
            </h2>
            {isCodeValid && (
              <p className="text-green-600 font-medium mb-2">
                🎉 20% discount activated! You'll pay $23.20/month for PRO.
              </p>
            )}
            <p className="text-gray-600">Redirecting to dashboard...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md bg-white shadow-xl rounded-xl p-8">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-900">
          Create Your Account
        </h1>
        <p className="text-gray-600 text-center mb-8">
          Start trading smarter today
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Full Name */}
          <div>
            <Label htmlFor="name" className="font-medium text-gray-700">
              Full Name
            </Label>
            <div className="relative mt-1">
              <Input
                id="name"
                type="text"
                placeholder="John Trader"
                {...register('name')}
                className={`transition-all duration-200 ${
                  errors.name && touchedFields.name
                    ? 'border-red-500 focus-visible:ring-red-500'
                    : touchedFields.name && name?.length >= 2
                      ? 'border-green-500 focus-visible:ring-green-500'
                      : ''
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
            <Label htmlFor="email" className="font-medium text-gray-700">
              Email Address
            </Label>
            <div className="relative mt-1">
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                {...register('email')}
                className={`transition-all duration-200 ${
                  errors.email && touchedFields.email
                    ? 'border-red-500 focus-visible:ring-red-500'
                    : touchedFields.email && !errors.email && email
                      ? 'border-green-500 focus-visible:ring-green-500'
                      : ''
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
            <Label htmlFor="password" className="font-medium text-gray-700">
              Password
            </Label>
            <div className="relative mt-1">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password')}
                className="pr-10 transition-all duration-200"
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
          </div>

          {/* Confirm Password */}
          <div>
            <Label
              htmlFor="confirmPassword"
              className="font-medium text-gray-700"
            >
              Confirm Password
            </Label>
            <div className="relative mt-1">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('confirmPassword')}
                className={`pr-10 transition-all duration-200 ${
                  errors.confirmPassword && touchedFields.confirmPassword
                    ? 'border-red-500 focus-visible:ring-red-500'
                    : touchedFields.confirmPassword &&
                        confirmPassword === password &&
                        password
                      ? 'border-green-500 focus-visible:ring-green-500'
                      : ''
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
                  <Check className="absolute right-10 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                )}
            </div>
            {errors.confirmPassword && touchedFields.confirmPassword && (
              <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                <X className="w-4 h-4" />
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* REFERRAL CODE - NEW FIELD */}
          <div>
            <Label htmlFor="referralCode" className="font-medium text-gray-700">
              Referral Code (Optional)
            </Label>
            <p className="text-xs text-blue-600 mb-1">
              Have an affiliate code? Get 20% off this month!
            </p>
            <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 mt-1">
              <div className="relative flex-1">
                <Input
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
                  className={`transition-all duration-200 ${
                    isCodeValid
                      ? 'border-green-500 bg-green-50 pr-10'
                      : codeError
                        ? 'border-red-500 bg-red-50 pr-10'
                        : ''
                  }`}
                  maxLength={15}
                />
                {isCodeValid && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                )}
                {codeError && (
                  <X className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-600" />
                )}
              </div>
              <Button
                type="button"
                onClick={() => verifyCode(referralCode)}
                disabled={referralCode.length < 15 || isVerifying}
                variant="outline"
                className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify'
                )}
              </Button>
            </div>
            {isCodeValid && (
              <>
                <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  Valid code! You'll get 20% off PRO ($23.20/month instead of
                  $29)
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
            <Checkbox
              id="terms"
              checked={watch('agreedToTerms') || false}
              onCheckedChange={(checked) =>
                setValue('agreedToTerms', checked as boolean)
              }
              className="mt-1"
            />
            <div className="flex-1">
              <Label
                htmlFor="terms"
                className="text-sm text-gray-700 font-normal leading-relaxed cursor-pointer"
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
              </Label>
              {errors.agreedToTerms && (
                <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                  <X className="w-4 h-4" />
                  {errors.agreedToTerms.message}
                </p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={!isValid || isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 py-3 text-lg font-semibold rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed min-h-[48px] transition-all duration-200"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </Button>
        </form>

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
          <div className="flex flex-col xs:flex-row items-center justify-center gap-2 text-sm flex-wrap">
            <Link
              href="/forgot-password"
              className="text-blue-600 hover:underline"
            >
              Forgot password?
            </Link>
            <span className="text-gray-300 hidden xs:inline">—</span>
            <Link
              href="/affiliate/join"
              className="text-blue-600 hover:underline text-xs"
            >
              Don't have a referral code? Join our Affiliate Program
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
