'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Check, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { isAuthBridgeEnabled } from '@/lib/auth/auth-bridge-flag';
import { useLocale } from '@/lib/context/locale-context';
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
  const { t } = useLocale();

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
      setCodeError(t('Invalid or expired referral code'));
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
        setError(t('An account with this email already exists.'));
      } else if (response.status === 503) {
        setError(t('Database connection error. Please try again later.'));
      } else {
        // Display the actual error message from the API if available
        setError(
          responseData?.error || t('Registration failed. Please try again.')
        );
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(t('An error occurred. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl backdrop-blur-xl dark:border-slate-800/80 dark:bg-[#0b0e17]">
      <div className="text-center">
        <h1 className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">
          {t('Create Your Account')}
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {t('Start trading smarter today')}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Full Name */}
        <div className="space-y-1.5">
          <label
            htmlFor="name"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            {t('Full Name')}
          </label>
          <div className="relative">
            <input
              id="name"
              type="text"
              placeholder="John Trader"
              {...register('name')}
              className={`dark:border-slate-750 h-10 w-full rounded-xl border bg-white px-3 pr-10 text-xs text-slate-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-[#06080e] dark:text-slate-100 ${
                errors.name && touchedFields.name
                  ? 'border-rose-500'
                  : touchedFields.name && name?.length >= 2
                    ? 'border-emerald-500'
                    : 'border-slate-200'
              }`}
            />
            {touchedFields.name && name?.length >= 2 && !errors.name && (
              <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
            )}
          </div>
          {errors.name && touchedFields.name && (
            <p className="flex items-center gap-1 text-xs text-rose-600">
              <X className="h-3.5 w-3.5" />
              {errors.name.message}
            </p>
          )}
        </div>

        {/* Email */}
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
                errors.email && touchedFields.email
                  ? 'border-rose-500'
                  : touchedFields.email && !errors.email && email
                    ? 'border-emerald-500'
                    : 'border-slate-200'
              }`}
            />
            {touchedFields.email && !errors.email && email && (
              <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
            )}
          </div>
          {errors.email && touchedFields.email && (
            <p className="flex items-center gap-1 text-xs text-rose-600">
              <X className="h-3.5 w-3.5" />
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
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
              placeholder="••••••••"
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

          {/* Password Requirements */}
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
                  passwordValidation[key as keyof typeof passwordValidation];
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

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <label
            htmlFor="confirmPassword"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            {t('Confirm Password')}
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="••••••••"
              {...register('confirmPassword')}
              className={`dark:border-slate-750 h-10 w-full rounded-xl border bg-white px-3 pr-10 text-xs text-slate-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-[#06080e] dark:text-slate-100 ${
                errors.confirmPassword && touchedFields.confirmPassword
                  ? 'border-rose-500'
                  : touchedFields.confirmPassword &&
                      confirmPassword === password &&
                      password
                    ? 'border-emerald-500'
                    : 'border-slate-200'
              }`}
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
            {touchedFields.confirmPassword &&
              confirmPassword === password &&
              password &&
              !errors.confirmPassword && (
                <Check className="absolute right-9 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
              )}
          </div>
          {errors.confirmPassword && touchedFields.confirmPassword && (
            <p className="flex items-center gap-1 text-xs text-rose-600">
              <X className="h-3.5 w-3.5" />
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* Referral Code */}
        <div className="space-y-1.5">
          <label
            htmlFor="referralCode"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            {t('Referral Code (Optional)')}
          </label>
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            {t('Have an affiliate code? Get')} {discountPercent}%{' '}
            {t('off this month!')}
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
                  if (isCodeValid || codeError) {
                    setIsCodeValid(false);
                    setCodeError('');
                    setVerifiedCode(null);
                  }
                }}
                className={`dark:border-slate-750 h-10 w-full rounded-xl border bg-white px-3 pr-9 text-xs text-slate-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-[#06080e] dark:text-slate-100 ${
                  isCodeValid
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                    : codeError
                      ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/20'
                      : 'border-slate-200'
                }`}
                maxLength={20}
              />
              {isCodeValid && (
                <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
              )}
              {codeError && (
                <X className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-600" />
              )}
            </div>
            <button
              type="button"
              onClick={() => verifyCode(referralCode)}
              disabled={referralCode.length < 6 || isVerifying}
              className="dark:border-slate-750 h-10 rounded-xl border border-slate-200 bg-slate-100 px-4 text-xs font-semibold text-slate-800 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {isVerifying ? (
                <Loader2 className="inline h-3.5 w-3.5 animate-spin" />
              ) : (
                t('Verify')
              )}
            </button>
          </div>
          {isCodeValid && (
            <>
              <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5 flex-shrink-0" />
                {t('Valid code! You’ll get')} {discountPercent}%{' '}
                {t('off PRO ($')}
                {calculateDiscountedPrice(regularPrice).toFixed(2)}
                {t('/month instead of $')}
                {regularPrice.toFixed(2)})
              </p>
              <span className="mt-1 inline-block rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                🎉 {discountPercent}% {t('DISCOUNT APPLIED')}
              </span>
            </>
          )}
          {codeError && (
            <p className="flex items-center gap-1 text-xs text-rose-600">
              <X className="h-3.5 w-3.5" />
              {codeError}
            </p>
          )}
        </div>

        {/* Terms Checkbox */}
        <div className="flex items-start gap-2.5">
          <input
            id="terms"
            type="checkbox"
            {...register('agreedToTerms')}
            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
          />
          <div className="flex-1">
            <label
              htmlFor="terms"
              className="cursor-pointer text-xs leading-relaxed text-slate-600 dark:text-slate-400"
            >
              {t('I agree to the')}{' '}
              <Link
                href="/terms"
                className="text-amber-600 underline hover:text-amber-700 dark:text-amber-400"
              >
                {t('Terms of Service')}
              </Link>{' '}
              {t('and')}{' '}
              <Link
                href="/privacy"
                className="text-amber-600 underline hover:text-amber-700 dark:text-amber-400"
              >
                {t('Privacy Policy')}
              </Link>
            </label>
            {errors.agreedToTerms && (
              <p className="mt-1 flex items-center gap-1 text-xs text-rose-600">
                <X className="h-3.5 w-3.5" />
                {errors.agreedToTerms.message}
              </p>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs dark:border-rose-500/30 dark:bg-rose-950/40">
            <div className="text-rose-700 dark:text-rose-300">{error}</div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="h-10 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 transition-all hover:from-amber-400 hover:to-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              {t('Creating account...')}
            </>
          ) : (
            t('Create Account')
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
            {t('Or register with')}
          </span>
        </div>
      </div>

      {/* Social Auth */}
      <SocialAuthButtons />

      {/* Footer Links */}
      <div className="space-y-2 border-t border-slate-200 pt-4 text-center text-xs dark:border-slate-800/80">
        <p className="text-slate-500 dark:text-slate-400">
          {t('Already have an account?')}{' '}
          <Link
            href="/login"
            className="font-semibold text-amber-600 hover:underline dark:text-amber-400"
          >
            {t('Login')}
          </Link>
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/forgot-password"
            className="text-amber-600 hover:underline dark:text-amber-400"
          >
            {t('Forgot password?')}
          </Link>
          <span className="text-slate-400 dark:text-slate-600">—</span>
          <Link
            href="/affiliate/register"
            className="text-[11px] text-amber-600 hover:underline dark:text-amber-400"
          >
            {t("Don't have a referral code? Join our Affiliate Program")}
          </Link>
        </div>
      </div>
    </div>
  );
}
