'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Lock,
  Mail,
  User,
  ArrowRight,
  Sparkles,
  Check,
  X,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useLocale } from '@/lib/context/locale-context';

import SocialAuthButtons from './social-auth-buttons';

const REGULAR_PRICE = 49;
const DISCOUNT_PERCENT = 20;

export default function RegisterForm() {
  const router = useRouter();
  const { t, formatCurrency } = useLocale();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [tier, setTier] = useState<'PRO' | 'FREE'>('PRO');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Referral code state
  const [referralCode, setReferralCode] = useState('');
  const [isCodeValid, setIsCodeValid] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const passwordValidation = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };
  const isPasswordValid = Object.values(passwordValidation).every(Boolean);

  const verifyCode = async (code: string): Promise<void> => {
    if (code.length < 6) return;

    setIsVerifying(true);
    setCodeError('');

    // Frontend-only mock (no /api/affiliate/verify-code backend in this
    // increment) — mirrors Codebase 1's own mocked verification rule.
    await new Promise((resolve) => setTimeout(resolve, 800));

    const valid = code.startsWith('REF-') && code.length >= 10;

    if (valid) {
      setIsCodeValid(true);
      setCodeError('');
    } else {
      setIsCodeValid(false);
      setCodeError(t('Invalid or expired referral code'));
    }

    setIsVerifying(false);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isPasswordValid) {
      setError(t('Password does not meet the requirements below.'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('Passwords do not match.'));
      return;
    }
    if (!agreedToTerms) {
      setError(t('You must agree to the Terms of Service and Privacy Policy.'));
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      if (tier === 'PRO') {
        router.push('/checkout');
      } else {
        router.push('/free');
      }
    }, 800);
  };

  const discountedPrice = REGULAR_PRICE * (1 - DISCOUNT_PERCENT / 100);

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-800/80 bg-[#0b0e17] p-8 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-col items-center space-y-2 text-center">
        <div className="relative h-12 w-12 overflow-hidden rounded-xl shadow-lg ring-2 shadow-amber-500/10 ring-amber-500/40">
          <Image
            src="/DavinTrade_Logo.jpg"
            alt="DavinTrade Logo"
            fill
            className="object-cover"
            priority
          />
        </div>
        <h2 className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
          {t('Create your DavinTrade account')}
        </h2>
        <p className="text-xs text-slate-400">
          {t(
            'Start analyzing charts with AI and setting server-side price alerts.'
          )}
        </p>
      </div>

      {/* Tier Selection Radio Toggle */}
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-[#06080e] p-1">
        <button
          type="button"
          onClick={() => setTier('PRO')}
          className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-all ${
            tier === 'PRO'
              ? 'border-amber-500/60 bg-amber-500/15 text-amber-300 shadow-sm'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex w-full items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />{' '}
              {t('PRO Tier')}
            </span>
            {tier === 'PRO' && <Check className="h-3.5 w-3.5 text-amber-400" />}
          </div>
          <span className="mt-1 text-[10px] text-slate-400">
            {t('Full AI Models + 100 Alerts + MTF Overlay')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTier('FREE')}
          className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-all ${
            tier === 'FREE'
              ? 'border-slate-600 bg-slate-800 text-slate-200 shadow-sm'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex w-full items-center justify-between text-xs font-bold">
            <span>{t('FREE Tier')}</span>
            {tier === 'FREE' && (
              <Check className="h-3.5 w-3.5 text-slate-300" />
            )}
          </div>
          <span className="mt-1 text-[10px] text-slate-400">
            {t('Basic Gemini Flash + Read-Only History')}
          </span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
          <X className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-300">
            {t('Full Name')}
          </Label>
          <div className="relative">
            <User className="absolute top-3 left-3 h-4 w-4 text-slate-500" />
            <Input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Trader"
              className="border-slate-750 bg-[#06080e] pl-10 text-xs text-slate-100 placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-300">
            {t('Email Address')}
          </Label>
          <div className="relative">
            <Mail className="absolute top-3 left-3 h-4 w-4 text-slate-500" />
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="border-slate-750 bg-[#06080e] pl-10 text-xs text-slate-100 placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-300">
            {t('Password')}
          </Label>
          <div className="relative">
            <Lock className="absolute top-3 left-3 h-4 w-4 text-slate-500" />
            <Input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="border-slate-750 bg-[#06080e] pr-10 pl-10 text-xs text-slate-100 placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute top-3 right-3 text-slate-500 transition-colors hover:text-slate-300"
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
            <div className="mt-2 space-y-1 rounded-lg border border-slate-800 bg-[#070910] p-2.5">
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
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <X className="h-3 w-3 text-slate-600" />
                    )}
                    <span
                      className={passed ? 'text-emerald-400' : 'text-slate-500'}
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
          <Label className="text-xs font-semibold text-slate-300">
            {t('Confirm Password')}
          </Label>
          <div className="relative">
            <Lock className="absolute top-3 left-3 h-4 w-4 text-slate-500" />
            <Input
              type={showConfirmPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="border-slate-750 bg-[#06080e] pr-10 pl-10 text-xs text-slate-100 placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute top-3 right-3 text-slate-500 transition-colors hover:text-slate-300"
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
            {confirmPassword && confirmPassword === password && (
              <Check className="absolute top-3 right-10 h-4 w-4 text-emerald-400" />
            )}
          </div>
          {confirmPassword && confirmPassword !== password && (
            <p className="flex items-center gap-1 text-[11px] text-rose-400">
              <X className="h-3 w-3" />
              {t('Passwords do not match')}
            </p>
          )}
        </div>

        {/* Referral Code */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-300">
            {t('Referral Code (Optional)')}
          </Label>
          <p className="text-[11px] text-amber-400">
            {t('Have an affiliate code? Get')} {DISCOUNT_PERCENT}%{' '}
            {t('off this month!')}
          </p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                type="text"
                maxLength={20}
                value={referralCode}
                onChange={(e) => {
                  const upper = e.target.value.toUpperCase();
                  setReferralCode(upper);
                  if (isCodeValid || codeError) {
                    setIsCodeValid(false);
                    setCodeError('');
                  }
                }}
                placeholder="REF-ABC123XYZ"
                className={`border-slate-750 bg-[#06080e] pr-9 text-xs text-slate-100 placeholder:text-slate-500 ${
                  isCodeValid
                    ? 'border-emerald-500/60'
                    : codeError
                      ? 'border-rose-500/60'
                      : ''
                }`}
              />
              {isCodeValid && (
                <Check className="absolute top-3 right-3 h-4 w-4 text-emerald-400" />
              )}
              {codeError && (
                <X className="absolute top-3 right-3 h-4 w-4 text-rose-400" />
              )}
            </div>
            <button
              type="button"
              onClick={() => verifyCode(referralCode)}
              disabled={referralCode.length < 6 || isVerifying}
              className="border-slate-750 rounded-lg border bg-slate-800/60 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isVerifying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                t('Verify')
              )}
            </button>
          </div>
          {isCodeValid && (
            <p className="flex items-center gap-1 text-[11px] text-emerald-400">
              <Check className="h-3 w-3 shrink-0" />
              {t('Valid code! You will get')} {DISCOUNT_PERCENT}% {t('off PRO')}{' '}
              ({formatCurrency(discountedPrice)}/{t('mo')} {t('instead of')}{' '}
              {formatCurrency(REGULAR_PRICE)})
            </p>
          )}
          {codeError && (
            <p className="flex items-center gap-1 text-[11px] text-rose-400">
              <X className="h-3 w-3" />
              {codeError}
            </p>
          )}
        </div>

        {/* Terms Checkbox */}
        <label className="flex items-start gap-2.5 text-[11px] leading-relaxed text-slate-400">
          <Checkbox
            checked={agreedToTerms}
            onCheckedChange={(checked) => setAgreedToTerms(!!checked)}
            className="mt-0.5"
          />
          <span>
            {t('I agree to the')}{' '}
            <Link
              href="/terms"
              className="text-amber-400 underline hover:text-amber-300"
            >
              {t('Terms of Service')}
            </Link>{' '}
            {t('and')}{' '}
            <Link
              href="/privacy"
              className="text-amber-400 underline hover:text-amber-300"
            >
              {t('Privacy Policy')}
            </Link>
          </span>
        </label>

        <Button
          type="submit"
          disabled={isLoading}
          className="h-10 w-full bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
        >
          {isLoading
            ? t('Creating Account...')
            : tier === 'PRO'
              ? `${t('Proceed to Checkout')} (${formatCurrency(49)}/${t('mo')})`
              : t('Get Started Free')}
          {!isLoading && <ArrowRight className="ml-1.5 h-4 w-4" />}
        </Button>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-800/80" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-[#0b0e17] px-3 text-slate-500">
            {t('Or register with')}
          </span>
        </div>
      </div>

      {/* Social Sign Up */}
      <SocialAuthButtons redirectTo={tier === 'PRO' ? '/checkout' : '/free'} />

      <div className="space-y-1.5 border-t border-slate-800/80 pt-2 text-center text-xs text-slate-400">
        <div>
          {t('Already have an account?')}{' '}
          <Link
            href="/login"
            className="font-bold text-amber-400 hover:underline"
          >
            {t('Sign In')}
          </Link>
        </div>
        <div>
          <Link
            href="/affiliate/register"
            className="text-[11px] text-slate-500 hover:text-amber-400 hover:underline"
          >
            {t("Don't have a referral code? Join our Affiliate Program")}
          </Link>
        </div>
      </div>
    </div>
  );
}
