'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  HelpCircle,
  MessageSquare,
  Mail,
  Search,
  ChevronRight,
  ShieldAlert,
  Zap,
  CreditCard,
  User,
  Sparkles,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarketingNavbar } from '@/components/marketing/marketing-navbar';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { useSupportChat } from '@/components/chat-widget/chat-context';
import { useLocale } from '@/lib/context/locale-context';

export default function HelpPage() {
  const { t } = useLocale();
  const { openChat } = useSupportChat();
  const [search, setSearch] = useState('');

  const faqs = [
    {
      category: t('Account & Access'),
      icon: User,
      questions: [
        {
          q: t('How do I reset my account password?'),
          a: t(
            'Go to /forgot-password, enter your registered email address, and follow the secure link sent to your inbox.'
          ),
        },
        {
          q: t('How do I enable 2-Factor Authentication (2FA)?'),
          a: t(
            'Visit /settings/security, toggle Two-Factor Authentication, and scan the QR code with Google Authenticator or Authy.'
          ),
        },
      ],
    },
    {
      category: t('Signals & Workspace'),
      icon: Zap,
      questions: [
        {
          q: t('What is the difference between /free and /terminal?'),
          a: t(
            '/free provides delayed sample telemetry and baseline charts. /terminal delivers zero-latency tick updates, advanced fractal triggers, multi-timeframe overlays, and unrestricted Davin AI analysis.'
          ),
        },
        {
          q: t('Which symbols and timeframes are supported?'),
          a: t(
            'DavinTrade AI focuses exclusively on Spot Gold (XAUUSD) across M5 (5-minute) and M15 (15-minute) precision algorithmic timeframes.'
          ),
        },
      ],
    },
    {
      category: t('Billing & Subscriptions'),
      icon: CreditCard,
      questions: [
        {
          q: t('What payment methods do you accept?'),
          a: t(
            'We accept major credit/debit cards, PromptPay (Thailand), Pix (Brazil), and localized bank transfers via dLocal and Stripe.'
          ),
        },
        {
          q: t('Can I cancel my subscription anytime?'),
          a: t(
            'Yes. You can manage and cancel auto-renewals anytime from /settings/billing with zero cancellation fees.'
          ),
        },
      ],
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#050609] text-slate-100">
      <MarketingNavbar />

      <main className="container mx-auto max-w-5xl flex-1 px-4 py-16 md:px-6">
        <div className="space-y-10">
          <div className="mx-auto max-w-2xl space-y-4 text-center">
            <Badge className="border-amber-500/40 bg-amber-500/15 px-3 py-1 font-mono text-xs text-amber-400">
              {t('DavinTrade Help Centre')}
            </Badge>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 md:text-5xl">
              {t('How can we help you today?')}
            </h1>
            <p className="text-sm text-slate-400">
              {t(
                'Search our knowledge base or chat directly with Davin AI support.'
              )}
            </p>

            <div className="relative mx-auto max-w-md pt-2">
              <Search className="absolute top-5 left-3.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t('Search questions, billing, signals...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 border-slate-800 bg-[#090b14] pl-10 text-slate-200 focus:border-amber-500/60"
              />
            </div>
          </div>

          {/* Direct Support Channels */}
          <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
            <Card
              onClick={openChat}
              className="cursor-pointer border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-[#0d101a] to-[#090b14] p-5 transition-all hover:border-amber-500/60"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/20 text-amber-400">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-100">
                    {t('Live Conversational AI Support')}
                    <Badge className="border-emerald-500/40 bg-emerald-500/20 text-[10px] text-emerald-400">
                      24/7
                    </Badge>
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    {t(
                      'Instant answers about market analytics, account setup, and billing.'
                    )}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="border-slate-800 bg-[#090b14]/80 p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800/50 text-slate-300">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    {t('Email Support Desk')}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    support@davintrade.com • {t('Response within 4 hours')}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Categorized FAQs */}
          <div className="space-y-8 pt-4">
            {faqs.map((cat, idx) => {
              const Icon = cat.icon;
              return (
                <div key={idx} className="space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-100">
                      {cat.category}
                    </h2>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {cat.questions.map((item, qIdx) => (
                      <Card
                        key={qIdx}
                        className="space-y-2 border-slate-800/80 bg-[#080a12]/80 p-5 hover:border-slate-700"
                      >
                        <h4 className="text-sm font-bold text-slate-200">
                          {item.q}
                        </h4>
                        <p className="text-xs leading-relaxed text-slate-400">
                          {item.a}
                        </p>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
