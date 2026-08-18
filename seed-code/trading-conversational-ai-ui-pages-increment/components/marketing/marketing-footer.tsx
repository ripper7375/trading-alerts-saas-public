'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Shield, Sparkles, Heart } from 'lucide-react';
import { useLocale } from '@/lib/context/locale-context';

export function MarketingFooter() {
  const { t } = useLocale();

  return (
    <footer className="border-t border-slate-800/80 bg-[#040508] text-slate-400">
      <div className="container mx-auto px-4 py-12 md:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          {/* Brand Col */}
          <div className="col-span-2 space-y-4">
            <Link href="/" className="flex items-center space-x-3">
              <div className="relative flex h-9 w-9 overflow-hidden rounded-xl border border-amber-500/40 bg-amber-500/20 p-0.5 shadow-md shadow-amber-500/20">
                <Image
                  src="/davintrade-ai-icon.png"
                  alt="DavinTrade AI"
                  width={36}
                  height={36}
                  className="h-full w-full rounded-[8px] object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <span className="bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-lg font-black text-transparent">
                DavinTrade AI
              </span>
            </Link>
            <p className="max-w-sm text-xs leading-relaxed text-slate-400">
              {t(
                'Next-generation conversational AI trading intelligence for Gold (XAUUSD) fractal analytics and precision algorithmic execution.'
              )}
            </p>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span>© {new Date().getFullYear()} DavinTrade AI, Inc.</span>
              <span>•</span>
              <span>{t('All rights reserved.')}</span>
            </div>
          </div>

          {/* Col 1: Product */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold tracking-wider text-slate-200 uppercase">
              {t('Product')}
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/terminal"
                  className="transition-colors hover:text-amber-400"
                >
                  {t('AI Workbench')}
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="transition-colors hover:text-amber-400"
                >
                  {t('Pricing & Plans')}
                </Link>
              </li>
              <li>
                <Link
                  href="/changelog"
                  className="transition-colors hover:text-amber-400"
                >
                  {t('Changelog')}
                </Link>
              </li>
              <li>
                <Link
                  href="/status"
                  className="transition-colors hover:text-amber-400"
                >
                  {t('System Status')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 2: Resources & Legal */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold tracking-wider text-slate-200 uppercase">
              {t('Resources')}
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/docs"
                  className="transition-colors hover:text-amber-400"
                >
                  {t('Documentation')}
                </Link>
              </li>
              <li>
                <Link
                  href="/blog"
                  className="transition-colors hover:text-amber-400"
                >
                  {t('Trading Insights Blog')}
                </Link>
              </li>
              <li>
                <Link
                  href="/help"
                  className="transition-colors hover:text-amber-400"
                >
                  {t('Help & Support')}
                </Link>
              </li>
              <li>
                <Link
                  href="/affiliate"
                  className="transition-colors hover:text-amber-400"
                >
                  {t('Affiliate Program')}
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="transition-colors hover:text-amber-400"
                >
                  {t('About Us')}
                </Link>
              </li>
              <li>
                <Link
                  href="/careers"
                  className="transition-colors hover:text-amber-400"
                >
                  {t('Careers')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Legal */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold tracking-wider text-slate-200 uppercase">
              {t('Legal')}
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/privacy"
                  className="transition-colors hover:text-amber-400"
                >
                  {t('Privacy Policy')}
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="transition-colors hover:text-amber-400"
                >
                  {t('Terms of Service')}
                </Link>
              </li>
              <li>
                <Link
                  href="/disclaimer"
                  className="transition-colors hover:text-amber-400"
                >
                  {t('Risk Disclaimer')}
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="transition-colors hover:text-amber-400"
                >
                  {t('About DavinTrade')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Disclaimer Strip */}
        <div className="mt-10 border-t border-slate-800/60 pt-6 text-center text-[11px] leading-relaxed text-slate-500">
          <p className="mx-auto max-w-4xl">
            {t(
              'Risk Disclosure: Trading Forex, CFDs, and precious metals on margin carries high risk and may not be suitable for all investors. DavinTrade provides algorithmic and quantitative analysis tools for informational purposes and does not provide financial or investment advice.'
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}
