'use client';

import { useState } from 'react';
import { Search, Mail, CreditCard, User, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';

/**
 * Public Help Centre.
 *
 * Session 9-1 deferred the seed-code support-chat widget
 * (components/chat-widget/*) to Phase 14 -- it isn't wired into
 * ClientProviders yet, so this page does not call useSupportChat()/openChat().
 * Both contact channels below route to the real support inbox until the
 * live chat widget ships.
 */
export default function HelpPage() {
  const { t } = useLocale();
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
    <div className="bg-slate-50 text-slate-900 dark:bg-[#050609] dark:text-slate-100">
      <div className="container mx-auto max-w-5xl px-4 py-16 md:px-6">
        <div className="space-y-10">
          <div className="mx-auto max-w-2xl space-y-4 text-center">
            <Badge className="border-amber-500/40 bg-amber-500/15 px-3 py-1 font-mono text-xs text-amber-700 dark:text-amber-400">
              {t('DavinTrade Help Centre')}
            </Badge>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 md:text-5xl">
              {t('How can we help you today?')}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t(
                'Search our knowledge base or reach the support desk directly.'
              )}
            </p>

            <div className="relative mx-auto max-w-md pt-2">
              <Search className="absolute left-3.5 top-5 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t('Search questions, billing, signals...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 border-slate-200 bg-white pl-10 text-slate-900 focus:border-amber-500/60 dark:border-slate-800 dark:bg-[#090b14] dark:text-slate-200"
              />
            </div>
          </div>

          {/* Direct Support Channel */}
          <div className="mx-auto max-w-md">
            <a href="mailto:support@davintrade.com" className="block">
              <Card className="border-slate-200 bg-white p-5 shadow-md transition-all hover:border-amber-500/40 dark:border-slate-800 dark:bg-[#090b14]/80">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
                    <Mail className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {t('Email Support Desk')}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      support@davintrade.com • {t('Response within 4 hours')}
                    </p>
                  </div>
                </div>
              </Card>
            </a>
          </div>

          {/* Categorized FAQs */}
          <div className="space-y-8 pt-4">
            {faqs.map((cat, idx) => {
              const Icon = cat.icon;
              return (
                <div key={idx} className="space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3 dark:border-slate-800/80">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {cat.category}
                    </h2>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {cat.questions.map((item, qIdx) => (
                      <Card
                        key={qIdx}
                        className="space-y-2 border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 dark:border-slate-800/80 dark:bg-[#080a12]/80 dark:hover:border-slate-700"
                      >
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-200">
                          {item.q}
                        </h4>
                        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
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
      </div>
    </div>
  );
}
