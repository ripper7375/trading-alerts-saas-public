'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Rocket,
  Bell,
  LineChart,
  Code,
  CreditCard,
  Users,
  ChevronDown,
  ChevronUp,
  Brain,
  Sparkles,
  Zap,
  Terminal,
  Shield,
  Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarketingNavbar } from '@/components/marketing/marketing-navbar';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { useLocale } from '@/lib/context/locale-context';

export default function DocsPage() {
  const { t } = useLocale();
  const [searchQuery, setSearchQuery] = useState('');
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({
    0: true,
    1: true,
  });

  const toggleSection = (index: number) => {
    setOpenSections((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const docSections = [
    {
      icon: Rocket,
      title: t('1. Getting Started & Setup'),
      summary: t(
        'Account creation, tier activation, and connecting to DavinTrade AI workspaces.'
      ),
      content: [
        t(
          'Create an account via /register using email or Google single sign-on.'
        ),
        t(
          'Configure appearance themes, chart candlestick colors, and language in Settings.'
        ),
        t(
          'Launch the Free Workspace (/free) or PRO Terminal (/terminal) to begin real-time quantitative monitoring.'
        ),
      ],
    },
    {
      icon: Brain,
      title: t('2. Conversational AI Copilot'),
      summary: t(
        'How to interact with Davin AI for market structure queries, harmonic levels, and risk calculations.'
      ),
      content: [
        t(
          'Click the AI Mascot chat trigger at the bottom right of any workspace or terminal.'
        ),
        t(
          'Ask prompts such as "Summarize current XAUUSD M15 fractal structure" or "What is today\'s key liquidity pool?".'
        ),
        t(
          'Davin AI references live order flow, MT5 tick feeds, and historical volatility matrices.'
        ),
      ],
    },
    {
      icon: LineChart,
      title: t('3. Fractal Analysis & Multi-Timeframe Signals'),
      summary: t(
        'Understanding M5/M15 fractal markers, liquidity sweeps, and trend alignment metrics.'
      ),
      content: [
        t(
          'High & Low fractals indicate key structural pivots identified by 5-bar mathematical models.'
        ),
        t(
          'Multi-timeframe confirmation: M15 sets the macro trend bias, while M5 provides precision tactical trigger points.'
        ),
        t(
          'Candle color synchronization dynamically updates charts across your selected DavinTrade theme.'
        ),
      ],
    },
    {
      icon: Bell,
      title: t('4. Real-Time Alert Engine'),
      summary: t(
        'Creating custom price triggers, fractal breach alerts, and webhook notifications.'
      ),
      content: [
        t('Navigate to /alerts/new to build conditional trigger logic.'),
        t(
          'Select delivery methods: In-app real-time popups, sound pings, Telegram bot, or custom webhook JSON payloads.'
        ),
        t(
          'Monitor alert execution velocity and historical triggers in /alerts.'
        ),
      ],
    },
    {
      icon: CreditCard,
      title: t('5. Subscriptions, Invoicing & dLocal/Stripe Billing'),
      summary: t(
        'Managing PRO access, localized payment gateways, and recurring invoices.'
      ),
      content: [
        t(
          'Upgrade seamlessly through /checkout supporting Credit Cards, PromptPay, Pix, and regional bank transfers via dLocal & Stripe.'
        ),
        t(
          'Download official PDF invoices and change payment methods under /settings/billing.'
        ),
        t(
          'Manage auto-renewals or cancel subscription at any time with zero lock-in.'
        ),
      ],
    },
    {
      icon: Users,
      title: t('6. Affiliate Partner Program & Wise Payouts'),
      summary: t(
        'Referral code generation, commission tracking, and automated disbursement batches.'
      ),
      content: [
        t('Register as an affiliate partner at /affiliate/register.'),
        t(
          'Create custom discount promo codes for your audience in /affiliate/dashboard/codes.'
        ),
        t(
          'Receive 30% recurring commissions disbursed directly to your Wise or RiseWorks account.'
        ),
      ],
    },
  ];

  const filtered = docSections.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.summary.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-[#050609] dark:text-slate-100">
      <MarketingNavbar />

      <main className="container mx-auto max-w-5xl flex-1 px-4 py-16 md:px-6">
        <div className="space-y-8">
          <div className="mx-auto max-w-2xl space-y-4 text-center">
            <Badge className="border-amber-500/40 bg-amber-500/15 px-3 py-1 font-mono text-xs text-amber-700 dark:text-amber-400">
              {t('DavinTrade AI Knowledge Hub')}
            </Badge>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-5xl dark:text-slate-100">
              {t('Documentation & Platform Guides')}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t(
                'Complete reference for trading workspaces, algorithmic signals, conversational AI, billing, and API endpoints.'
              )}
            </p>

            {/* Search Input */}
            <div className="relative mx-auto max-w-md pt-2">
              <Search className="absolute top-5 left-3.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t('Search topics, signals, webhooks...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 border-slate-200 bg-white pl-10 text-slate-900 focus:border-amber-500/60 dark:border-slate-800 dark:bg-[#090b14] dark:text-slate-200"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4">
            {filtered.map((section, idx) => {
              const Icon = section.icon;
              const isOpen = openSections[idx];

              return (
                <Card
                  key={idx}
                  className="border-slate-200 bg-white shadow-md transition-colors hover:border-slate-300 dark:border-slate-800/80 dark:bg-[#090b14]/90 dark:backdrop-blur-xl dark:hover:border-slate-700"
                >
                  <div
                    onClick={() => toggleSection(idx)}
                    className="flex cursor-pointer items-center justify-between p-5 select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                          {section.title}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {section.summary}
                        </p>
                      </div>
                    </div>
                    <button className="p-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                      {isOpen ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </button>
                  </div>

                  {isOpen && (
                    <CardContent className="space-y-2 border-t border-slate-200 bg-slate-50/80 px-6 py-4 dark:border-slate-800/80 dark:bg-[#06080e]/60">
                      <ul className="space-y-2 text-xs text-slate-700 md:text-sm dark:text-slate-300">
                        {section.content.map((point, pIdx) => (
                          <li key={pIdx} className="flex items-start gap-2">
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              •
                            </span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
