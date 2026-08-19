'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  FolderDown,
  Download,
  Image as ImageIcon,
  FileText,
  Copy,
  Sparkles,
  ExternalLink,
  Check,
  Link2,
  HelpCircle,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AffiliateNav } from '@/components/affiliate/affiliate-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';

interface ActiveReferralCode {
  code: string;
  discount: number;
}

const ACTIVE_REFERRAL_CODES: ActiveReferralCode[] = [
  { code: 'GOLDPRO20', discount: 20 },
  { code: 'DAVINVIP10', discount: 10 },
];

export default function AffiliateResourcesPage() {
  const { t } = useLocale();
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);
  const [copiedLinkKey, setCopiedLinkKey] = React.useState<string | null>(null);
  const [origin, setOrigin] = React.useState('');

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const copyLink = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedLinkKey(key);
    setTimeout(() => setCopiedLinkKey(null), 2000);
  };

  const copySwipe = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyTexts = [
    {
      title: t('Telegram / Discord Alert Hook'),
      text: '⚡ Just tested DavinTrade AI for Gold (XAUUSD) M5/M15 fractal setups. Sub-millisecond tick detection and the AI copilot gives instant support/resistance analysis. Use my exclusive code for 20% OFF: https://davintrade.com/checkout?ref=GOLDPRO20',
    },
    {
      title: t('YouTube / Video Description Copy'),
      text: '🚀 Level up your Gold trading with quantitative AI precision. Get 20% discount on DavinTrade AI using promo code GOLDPRO20: https://davintrade.com/checkout?ref=GOLDPRO20 #Forex #GoldTrading #XAUUSD #TradingAI',
    },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-slate-50 text-slate-900 select-none dark:bg-[#06070a] dark:text-slate-100">
      <AppHeader
        title={t('Affiliate Marketing Resources & Media Kit')}
        subtitle={t(
          'Official DavinTrade AI Logos, Mascot Assets, Ad Banners & Copywriting Swipe Files'
        )}
      />

      <AffiliateNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 p-4 md:p-6">
        {/* Your Referral Links */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {t('Your Referral Links')}
            </h2>
          </div>

          <Card className="space-y-3 border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-[#090b14]/90">
            {ACTIVE_REFERRAL_CODES.map((c) => {
              const link = `${origin}/register?ref=${c.code}`;
              return (
                <div
                  key={c.code}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-[#06080e]"
                >
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 bg-amber-500/15 font-mono text-[11px] text-amber-700 dark:text-amber-400"
                  >
                    {c.code} · {c.discount}% {t('OFF')}
                  </Badge>
                  <input
                    readOnly
                    value={link}
                    onFocus={(e) => e.target.select()}
                    aria-label={t(`Referral link for code ${c.code}`)}
                    className="min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800 dark:border-slate-800 dark:bg-[#05060a] dark:text-slate-300"
                  />
                  <Button
                    size="sm"
                    onClick={() => copyLink(`link-${c.code}`, link)}
                    className="bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400"
                  >
                    {copiedLinkKey === `link-${c.code}` ? (
                      <>
                        <Check className="mr-1 h-3.5 w-3.5" />
                        <span>{t('Copied!')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1 h-3.5 w-3.5" />
                        <span>{t('Copy Link')}</span>
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </Card>
        </div>

        {/* Logos & Mascot Assets */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {t('Official Brand Assets & AI Mascots')}
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="space-y-4 border-slate-200 bg-white p-5 text-center shadow-sm dark:border-slate-800/80 dark:bg-[#090b14]/90">
              <div className="flex h-32 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#05060a]">
                <Image
                  src="/davintrade-ai-icon.png"
                  alt="Davin AI Icon"
                  width={64}
                  height={64}
                  className="rounded-xl object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200">
                  {t('Davin AI App Icon (512x512 PNG)')}
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  {t('High resolution icon with transparent background')}
                </p>
              </div>
              <a href="/davintrade-ai-icon.png" download>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-slate-300 text-xs text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {t('Download PNG')}
                </Button>
              </a>
            </Card>

            <Card className="space-y-4 border-slate-200 bg-white p-5 text-center shadow-sm dark:border-slate-800/80 dark:bg-[#090b14]/90">
              <div className="flex h-32 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#05060a]">
                <Image
                  src="/DavinTrade_Logo.jpg"
                  alt="DavinTrade Logo"
                  width={140}
                  height={50}
                  className="rounded-lg object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200">
                  {t('DavinTrade Full Brand Logo')}
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  {t('Official horizontal banner brand logo')}
                </p>
              </div>
              <a href="/DavinTrade_Logo.jpg" download>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-slate-300 text-xs text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {t('Download JPG')}
                </Button>
              </a>
            </Card>

            <Card className="space-y-4 border-slate-200 bg-white p-5 text-center shadow-sm dark:border-slate-800/80 dark:bg-[#090b14]/90">
              <div className="flex h-32 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#05060a]">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                  <span className="text-lg font-extrabold text-amber-600 dark:text-amber-400">
                    DavinTrade
                  </span>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200">
                  {t('Vector SVG Icon Pack')}
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  {t('Scalable vector graphics for web and video')}
                </p>
              </div>
              <a href="/icon.svg" download>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-slate-300 text-xs text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {t('Download SVG')}
                </Button>
              </a>
            </Card>
          </div>
        </div>

        {/* Copywriting Swipes */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {t('High-Converting Copywriting Swipes')}
            </h2>
          </div>

          <div className="space-y-3">
            {copyTexts.map((copy, idx) => (
              <Card
                key={idx}
                className="space-y-3 border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-[#090b14]/90"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200">
                    {copy.title}
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copySwipe(copy.text, idx)}
                    className="text-xs text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                  >
                    {copiedIndex === idx ? (
                      <>
                        <Check className="mr-1 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{t('Copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1 h-3.5 w-3.5" />
                        <span>{t('Copy Text')}</span>
                      </>
                    )}
                  </Button>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800 select-all dark:border-slate-800 dark:bg-[#06080e] dark:text-slate-300">
                  {t(copy.text)}
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {t('Frequently Asked Questions')}
            </h2>
          </div>

          <Card className="divide-y divide-slate-200 border-slate-200 bg-white p-0 shadow-sm dark:divide-slate-800/80 dark:border-slate-800/80 dark:bg-[#090b14]/90">
            <div className="space-y-1 p-5">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200">
                {t('How much do I earn per referral?')}
              </h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                {t(
                  'You earn 30% of net recurring revenue on every PRO-tier subscriber you refer, for as long as they stay subscribed.'
                )}
              </p>
            </div>
            <div className="space-y-1 p-5">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200">
                {t('When do I get paid?')}
              </h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                {t(
                  'Payouts run automatically via Wise/Rise on the 1st of every month. Track the status of each batch on the'
                )}{' '}
                <Link
                  href="/affiliate/dashboard/payouts"
                  className="text-amber-600 hover:underline dark:text-amber-400"
                >
                  {t('Payouts')}
                </Link>{' '}
                {t('page.')}
              </p>
            </div>
            <div className="space-y-1 p-5">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200">
                {t('How are my payouts set up and paid?')}
              </h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                {t(
                  'Payout configurations and disbursements are handled directly by the Admin Disbursement Team via Wise and RiseWorks. You can view your payment records anytime in'
                )}{' '}
                <Link
                  href="/affiliate/dashboard/payouts"
                  className="text-amber-600 hover:underline dark:text-amber-400"
                >
                  {t('Payouts')}
                </Link>
                .
              </p>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
