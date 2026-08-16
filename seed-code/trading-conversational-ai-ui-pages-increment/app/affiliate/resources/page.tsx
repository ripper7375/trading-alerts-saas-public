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
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AffiliateNav } from '@/components/affiliate/affiliate-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';

export default function AffiliateResourcesPage() {
  const { t } = useLocale();
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

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
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#06070a] text-slate-100 select-none">
      <AppHeader
        title={t('Affiliate Marketing Resources & Media Kit')}
        subtitle={t(
          'Official DavinTrade AI Logos, Mascot Assets, Ad Banners & Copywriting Swipe Files'
        )}
      />

      <AffiliateNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 p-4 md:p-6">
        {/* Logos & Mascot Assets */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-amber-400" />
            <h2 className="text-base font-bold text-slate-100">
              {t('Official Brand Assets & AI Mascots')}
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="space-y-4 border-slate-800/80 bg-[#090b14]/90 p-5 text-center">
              <div className="flex h-32 items-center justify-center rounded-xl border border-slate-800 bg-[#05060a] p-4">
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
                <h4 className="text-xs font-bold text-slate-200">
                  {t('Davin AI App Icon (512x512 PNG)')}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {t('High resolution icon with transparent background')}
                </p>
              </div>
              <a href="/davintrade-ai-icon.png" download>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-slate-700 text-xs"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {t('Download PNG')}
                </Button>
              </a>
            </Card>

            <Card className="space-y-4 border-slate-800/80 bg-[#090b14]/90 p-5 text-center">
              <div className="flex h-32 items-center justify-center rounded-xl border border-slate-800 bg-[#05060a] p-4">
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
                <h4 className="text-xs font-bold text-slate-200">
                  {t('DavinTrade Full Brand Logo')}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {t('Official horizontal banner brand logo')}
                </p>
              </div>
              <a href="/DavinTrade_Logo.jpg" download>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-slate-700 text-xs"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {t('Download JPG')}
                </Button>
              </a>
            </Card>

            <Card className="space-y-4 border-slate-800/80 bg-[#090b14]/90 p-5 text-center">
              <div className="flex h-32 items-center justify-center rounded-xl border border-slate-800 bg-[#05060a] p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-8 w-8 text-amber-400" />
                  <span className="text-lg font-extrabold text-amber-400">
                    DavinTrade
                  </span>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">
                  {t('Vector SVG Icon Pack')}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {t('Scalable vector graphics for web and video')}
                </p>
              </div>
              <a href="/icon.svg" download>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-slate-700 text-xs"
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
            <FileText className="h-5 w-5 text-amber-400" />
            <h2 className="text-base font-bold text-slate-100">
              {t('High-Converting Copywriting Swipes')}
            </h2>
          </div>

          <div className="space-y-3">
            {copyTexts.map((copy, idx) => (
              <Card
                key={idx}
                className="space-y-3 border-slate-800/80 bg-[#090b14]/90 p-5"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200">
                    {copy.title}
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copySwipe(copy.text, idx)}
                    className="text-xs text-amber-400 hover:bg-amber-500/10"
                  >
                    {copiedIndex === idx ? (
                      <>
                        <Check className="mr-1 h-3.5 w-3.5 text-emerald-400" />
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
                <div className="rounded-xl border border-slate-800 bg-[#06080e] p-3 font-mono text-xs leading-relaxed text-slate-300 select-all">
                  {copy.text}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
