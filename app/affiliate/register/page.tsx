'use client';

/**
 * Partner Registration Form (Row 44, Session 9-7a)
 *
 * Requires an authenticated DavinTrade account -- POST
 * /api/affiliate/auth/register calls requireAuth() server-side, so an
 * anonymous visitor is redirected to /login?callbackUrl=/affiliate/register
 * before the form ever renders (same pattern as app/checkout/page.tsx).
 * Fields map 1:1 to affiliateRegistrationSchema (lib/affiliate/validators.ts).
 *
 * @module app/affiliate/register/page
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Share2, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useLocale } from '@/lib/context/locale-context';
import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

interface FormData {
  fullName: string;
  country: string;
  wiseEmail: string;
  terms: boolean;
  twitterUrl: string;
  youtubeUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
}

export default function AffiliateRegisterPage(): React.ReactElement {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { t } = useLocale();
  const { commissionPercent, codesPerMonth } = useAffiliateConfig();

  useEffect(() => {
    if (session?.user?.role === 'ADMIN') {
      router.push('/admin');
    }
  }, [session, router]);

  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    country: '',
    wiseEmail: '',
    terms: false,
    twitterUrl: '',
    youtubeUrl: '',
    instagramUrl: '',
    facebookUrl: '',
    tiktokUrl: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/affiliate/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          country: formData.country.toUpperCase(),
          paymentMethod: 'WISE',
          paymentDetails: { email: formData.wiseEmail },
          terms: formData.terms,
          twitterUrl: formData.twitterUrl || undefined,
          youtubeUrl: formData.youtubeUrl || undefined,
          instagramUrl: formData.instagramUrl || undefined,
          facebookUrl: formData.facebookUrl || undefined,
          tiktokUrl: formData.tiktokUrl || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Registration failed');
      }

      router.push('/affiliate/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Loading state -- mirrors app/checkout/page.tsx's established pattern
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#06070a]">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-amber-500" />
          <p className="text-muted-foreground">{t('Loading...')}</p>
        </div>
      </div>
    );
  }

  // Auth check -- POST /api/affiliate/auth/register requires a real session
  if (!session) {
    router.push('/login?callbackUrl=/affiliate/register');
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#06070a]">
        <p className="text-muted-foreground">{t('Redirecting to login...')}</p>
      </div>
    );
  }

  if (session.user?.role === 'ADMIN') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-[#06070a]">
        <Card className="w-full max-w-lg p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('Administrator Hub')}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t(
              'You are signed in with System Administrator privileges. Affiliate program oversight is managed from the Admin console.'
            )}
          </p>
          <div className="mt-6">
            <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
              <Link href="/admin">{t('Go to Admin Executive Dashboard')}</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (session.user?.isAffiliate) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-[#06070a]">
        <Card className="w-full max-w-lg p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("You're Already an Affiliate Partner")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t(
              'Your account is already active in our Affiliate Partner Program. You can access your referral codes, earnings, and promotional resources below.'
            )}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href="/affiliate/dashboard">
                {t('Go to Affiliate Dashboard')}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">{t('Go to Trading Dashboard')}</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 p-4 text-slate-900 dark:bg-[#06070a] dark:text-slate-100">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl dark:border-amber-500/30 dark:bg-[#0b0e17]">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Share2 className="h-6 w-6" />
          </div>
          <h1 className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 bg-clip-text text-xl font-extrabold tracking-tight text-transparent dark:from-amber-400 dark:via-amber-200 dark:to-amber-500">
            {t('Join Partner Program')}
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {t(
              `Earn ${commissionPercent}% monthly recurring commission on every trader you refer`
            )}
          </p>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="fullName"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              {t('Partner Name / Channel')} *
            </Label>
            <Input
              type="text"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleInputChange}
              required
              minLength={2}
              maxLength={100}
              placeholder={t('e.g. Gold Traders Community')}
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="country"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              {t('Country Code')} *
            </Label>
            <Input
              type="text"
              id="country"
              name="country"
              value={formData.country}
              onChange={handleInputChange}
              required
              maxLength={2}
              pattern="[A-Za-z]{2}"
              placeholder="US"
              className="text-xs uppercase"
            />
            <p className="text-[11px] text-slate-500">
              {t('2-letter country code (e.g., US, UK, TH)')}
            </p>
          </div>

          <div className="space-y-1.5 border-t border-slate-200 pt-4 dark:border-slate-800/80">
            <Label
              htmlFor="wiseEmail"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              {t('Wise Payout Email')} *
            </Label>
            <Input
              type="email"
              id="wiseEmail"
              name="wiseEmail"
              value={formData.wiseEmail}
              onChange={handleInputChange}
              required
              placeholder="you@wise.com"
              className="text-xs"
            />
            <p className="text-[11px] text-slate-500">
              {t('Commissions are paid out via Wise to this email')}
            </p>
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800/80">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('Social Profiles (Optional)')}
            </Label>
            <p className="text-[11px] text-slate-500">
              {t('Helps us verify your identity faster')}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="twitterUrl" className="sr-only">
                  {t('Twitter/X URL')}
                </Label>
                <Input
                  type="url"
                  id="twitterUrl"
                  name="twitterUrl"
                  value={formData.twitterUrl}
                  onChange={handleInputChange}
                  placeholder={t('Twitter / X URL')}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="youtubeUrl" className="sr-only">
                  {t('YouTube URL')}
                </Label>
                <Input
                  type="url"
                  id="youtubeUrl"
                  name="youtubeUrl"
                  value={formData.youtubeUrl}
                  onChange={handleInputChange}
                  placeholder={t('YouTube URL')}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="instagramUrl" className="sr-only">
                  {t('Instagram URL')}
                </Label>
                <Input
                  type="url"
                  id="instagramUrl"
                  name="instagramUrl"
                  value={formData.instagramUrl}
                  onChange={handleInputChange}
                  placeholder={t('Instagram URL')}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="facebookUrl" className="sr-only">
                  {t('Facebook URL')}
                </Label>
                <Input
                  type="url"
                  id="facebookUrl"
                  name="facebookUrl"
                  value={formData.facebookUrl}
                  onChange={handleInputChange}
                  placeholder={t('Facebook URL')}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tiktokUrl" className="sr-only">
                  {t('TikTok URL')}
                </Label>
                <Input
                  type="url"
                  id="tiktokUrl"
                  name="tiktokUrl"
                  value={formData.tiktokUrl}
                  onChange={handleInputChange}
                  placeholder={t('TikTok URL')}
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          <label className="flex items-start gap-2.5 border-t border-slate-200 pt-4 dark:border-slate-800/80">
            <input
              type="checkbox"
              name="terms"
              checked={formData.terms}
              onChange={handleInputChange}
              required
              className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-amber-500 focus:ring-amber-500 dark:border-slate-700"
            />
            <span className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
              {t(
                `I agree to the affiliate program terms and conditions. I understand that I will earn ${commissionPercent}% commission on referrals and that payouts are processed monthly for balances over $${AFFILIATE_CONFIG.MINIMUM_PAYOUT}.`
              )}
            </span>
          </label>

          <Button
            type="submit"
            disabled={loading || !formData.terms}
            className="h-10 w-full bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
          >
            {loading
              ? t('Creating Partner Account...')
              : t('Apply for Partner Portal')}
            {!loading && <ArrowRight className="ml-1.5 h-4 w-4" />}
          </Button>
        </form>

        <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800/80">
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-200">
            {t('Partner Benefits')}
          </h3>
          <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
            <li>
              {t(
                `- Earn ${commissionPercent}% recurring commission on every successful referral`
              )}
            </li>
            <li>{t(`- Receive ${codesPerMonth} unique codes per month`)}</li>
            <li>
              {t(
                `- Monthly automated payouts for balances over $${AFFILIATE_CONFIG.MINIMUM_PAYOUT}`
              )}
            </li>
          </ul>
        </div>

        <div className="border-t border-slate-200 pt-2 text-center text-xs text-slate-600 dark:border-slate-800/80 dark:text-slate-400">
          {t('Already registered?')}{' '}
          <Link
            href="/affiliate/dashboard"
            className="font-bold text-amber-600 hover:underline dark:text-amber-400"
          >
            {t('Partner Dashboard')}
          </Link>
        </div>
      </div>
    </div>
  );
}
