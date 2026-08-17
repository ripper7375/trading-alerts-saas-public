'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Share2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/lib/context/locale-context';

export default function AffiliateRegisterPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [website, setWebsite] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [terms, setTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terms) return;
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      router.push('/affiliate/dashboard');
    }, 800);
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#06070a] p-4 select-none">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border border-amber-500/30 bg-[#0b0e17] p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400">
            <Share2 className="h-6 w-6" />
          </div>
          <h2 className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
            {t('Join Partner Program')}
          </h2>
          <p className="text-xs text-slate-400">
            {t(
              'Earn 30% monthly recurring commission on every trader you refer'
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-300">
              {t('Partner Name / Channel')}
            </Label>
            <Input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('e.g. Gold Traders Community')}
              className="border-slate-750 bg-[#06080e] text-xs text-slate-100"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-300">
              {t('Business Email')}
            </Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="partner@example.com"
              className="border-slate-750 bg-[#06080e] text-xs text-slate-100"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-300">
              {t('Country Code')}
            </Label>
            <Input
              type="text"
              required
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase())}
              maxLength={2}
              placeholder="US"
              className="border-slate-750 bg-[#06080e] text-xs text-slate-100 uppercase"
            />
            <p className="text-[11px] text-slate-500">
              {t('2-letter country code (e.g., US, UK, TH)')}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-300">
              {t('Channel Link / Website (Optional)')}
            </Label>
            <Input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://t.me/yourchannel"
              className="border-slate-750 bg-[#06080e] text-xs text-slate-100"
            />
          </div>

          <div className="space-y-2 border-t border-slate-800/80 pt-4">
            <Label className="text-xs font-semibold text-slate-300">
              {t('Social Profiles (Optional)')}
            </Label>
            <p className="text-[11px] text-slate-500">
              {t('Helps us verify your identity faster')}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                type="url"
                value={twitterUrl}
                onChange={(e) => setTwitterUrl(e.target.value)}
                placeholder={t('Twitter / X URL')}
                className="border-slate-750 bg-[#06080e] text-xs text-slate-100"
              />
              <Input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder={t('YouTube URL')}
                className="border-slate-750 bg-[#06080e] text-xs text-slate-100"
              />
              <Input
                type="url"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder={t('Instagram URL')}
                className="border-slate-750 bg-[#06080e] text-xs text-slate-100"
              />
              <Input
                type="url"
                value={tiktokUrl}
                onChange={(e) => setTiktokUrl(e.target.value)}
                placeholder={t('TikTok URL')}
                className="border-slate-750 bg-[#06080e] text-xs text-slate-100"
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5 border-t border-slate-800/80 pt-4">
            <input
              type="checkbox"
              required
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-700 bg-[#06080e] text-amber-500 focus:ring-amber-500"
            />
            <span className="text-[11px] leading-relaxed text-slate-400">
              {t(
                'I agree to the Partner Program terms. I understand I will earn 30% recurring commission on referrals and that payouts are processed monthly for balances over $50, once I configure my Wise/RiseWorks payout account.'
              )}
            </span>
          </label>

          <Button
            type="submit"
            disabled={isLoading || !terms}
            className="h-10 w-full bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
          >
            {isLoading
              ? t('Creating Partner Account...')
              : t('Apply for Partner Portal')}
            {!isLoading && <ArrowRight className="ml-1.5 h-4 w-4" />}
          </Button>
        </form>

        <div className="space-y-2 border-t border-slate-800/80 pt-4">
          <h3 className="text-xs font-bold text-slate-200">
            {t('Partner Benefits')}
          </h3>
          <ul className="space-y-1 text-[11px] text-slate-400">
            <li>
              {t(
                '- Earn 30% recurring commission on every successful referral'
              )}
            </li>
            <li>
              {t('- Your referrals get up to 20% off their subscription')}
            </li>
            <li>{t('- Receive new promo codes distributed every month')}</li>
            <li>{t('- Monthly automated payouts for balances over $50')}</li>
          </ul>
        </div>

        <div className="border-t border-slate-800/80 pt-2 text-center text-xs text-slate-400">
          {t('Already registered?')}{' '}
          <Link
            href="/affiliate/dashboard"
            className="font-bold text-amber-400 hover:underline"
          >
            {t('Partner Dashboard')}
          </Link>
        </div>
      </div>
    </div>
  );
}
