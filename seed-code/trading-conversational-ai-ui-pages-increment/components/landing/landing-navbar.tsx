'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight, Globe, Zap } from 'lucide-react';
import { useLocale } from '@/lib/context/locale-context';

export function LandingNavbar() {
  const { t } = useLocale();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-slate-50/85 backdrop-blur-xl dark:border-slate-800/80 dark:bg-[#06070a]/85">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        {/* Brand Logo with Davin AI Icon (Annotation 1) */}
        <Link href="/" className="group flex items-center space-x-3">
          <div className="relative flex h-10 w-10 overflow-hidden rounded-xl border border-amber-500/40 bg-amber-500/20 p-0.5 shadow-lg shadow-amber-500/20 transition-transform group-hover:scale-105">
            <Image
              src="/davintrade-ai-icon.png"
              alt={t('DavinTrade AI Icon')}
              width={40}
              height={40}
              className="h-full w-full rounded-[9px] object-cover"
              priority
            />
          </div>
          <div className="flex flex-col">
            <span className="flex items-center gap-1.5 text-lg font-black tracking-tight text-white">
              Davin
              <span className="text-amber-600 dark:text-amber-400">Trade</span>
              <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-700 uppercase dark:text-amber-300">
                {t('AI SaaS')}
              </span>
            </span>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
              {t('Quantitative Conversational Intelligence')}
            </span>
          </div>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden items-center space-x-6 md:flex">
          <a
            href="#features"
            className="text-sm font-medium text-slate-700 transition-colors hover:text-amber-600 dark:text-slate-300 dark:hover:text-amber-400"
          >
            {t('Features')}
          </a>
          <Link
            href="/terminal"
            className="inline-flex items-center rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-3.5 py-1 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/20 transition-all hover:scale-[1.03] hover:from-amber-400 hover:to-amber-500"
          >
            <Sparkles className="mr-1 h-3.5 w-3.5 fill-slate-950" />
            {t('AI Workbench')}
          </Link>
          <Link
            href="/pricing"
            className="text-sm font-medium text-slate-700 transition-colors hover:text-amber-600 dark:text-slate-300 dark:hover:text-amber-400"
          >
            {t('Pricing')}
          </Link>
          <Link
            href="/alerts"
            className="flex items-center gap-1 text-sm font-medium text-slate-700 transition-colors hover:text-amber-600 dark:text-slate-300 dark:hover:text-amber-400"
          >
            <Zap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            {t('Live Alerts')}
          </Link>
          <Link
            href="/affiliate"
            className="text-sm font-medium text-slate-700 transition-colors hover:text-amber-600 dark:text-slate-300 dark:hover:text-amber-400"
          >
            {t('Affiliates')}
          </Link>
          <Link
            href="/status"
            className="text-sm font-medium text-slate-700 transition-colors hover:text-amber-600 dark:text-slate-300 dark:hover:text-amber-400"
          >
            {t('System Status')}
          </Link>
        </nav>

        {/* Right Action Controls */}
        <div className="flex items-center space-x-3">
          <Link href="/settings/language">
            <Button
              variant="outline"
              size="sm"
              className="hidden h-9 border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-amber-500/40 hover:bg-slate-100 sm:flex dark:border-slate-800 dark:bg-[#0d111c] dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Globe className="mr-1.5 h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              {t('en-GB (£)')}
            </Button>
          </Link>

          <Link href="/login">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-white dark:text-slate-300 dark:hover:bg-slate-800/80"
            >
              {t('Sign In')}
            </Button>
          </Link>

          {/* Top-Right Action Button: "Try Davin" (Annotation 2) */}
          <Link href="/terminal">
            <Button
              size="sm"
              className="h-9 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 font-bold text-slate-950 shadow-md shadow-amber-500/25 transition-all duration-300 hover:scale-[1.02] hover:from-amber-400 hover:to-amber-500 hover:shadow-amber-500/40"
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              {t('Try Davin')}
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
