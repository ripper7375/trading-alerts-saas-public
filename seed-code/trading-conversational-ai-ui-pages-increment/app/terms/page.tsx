'use client';

import React from 'react';
import Link from 'next/link';
import { Scale, FileCheck, AlertCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarketingNavbar } from '@/components/marketing/marketing-navbar';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { useLocale } from '@/lib/context/locale-context';

export default function TermsPage() {
  const { t } = useLocale();

  return (
    <div className="flex min-h-screen flex-col bg-[#050609] text-slate-100">
      <MarketingNavbar />

      <main className="container mx-auto max-w-4xl flex-1 px-4 py-16 md:px-6">
        <div className="space-y-8">
          <div className="space-y-3">
            <Badge className="border-amber-500/40 bg-amber-500/15 px-3 py-1 font-mono text-xs text-amber-400">
              {t('Service Agreement')}
            </Badge>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 md:text-4xl">
              {t('Terms of Service')}
            </h1>
            <p className="text-sm text-slate-400">
              {t('Last Revised: August 2026')}
            </p>
          </div>

          <Card className="border-slate-800/80 bg-[#090b14]/80 backdrop-blur-xl">
            <CardContent className="flex items-start gap-4 p-6">
              <Scale className="mt-0.5 h-6 w-6 shrink-0 text-amber-400" />
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-200">
                  {t('Acceptance of Terms')}
                </h3>
                <p className="text-xs leading-relaxed text-slate-400">
                  {t(
                    'By accessing or using DavinTrade AI, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access our quantitative software or conversational trading interfaces.'
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6 border-t border-slate-800/80 pt-6 text-sm leading-relaxed text-slate-300">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-100">
                1. {t('Description of Service')}
              </h2>
              <p>{t('DavinTrade AI provides:')}</p>
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-400 md:text-sm">
                <li>
                  {t('Real-time XAUUSD price charts with fractal analysis')}
                </li>
                <li>{t('Conversational AI market analysis via Davin AI')}</li>
                <li>
                  {t('Custom price and line-touch alert notifications (PRO)')}
                </li>
                <li>
                  {t('Multi-timeframe visualization and drawing tools (PRO)')}
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-100">
                2. {t('User Accounts')}
              </h2>
              <p>
                {t(
                  'When you create an account with us, you must provide accurate and complete information. You are responsible for maintaining the security of your account credentials, all activities that occur under your account, and notifying us immediately of any unauthorized access.'
                )}
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-100">
                3. {t('Software License & Acceptable Use')}
              </h2>
              <p>
                {t(
                  'DavinTrade AI grants you a personal, non-exclusive, non-transferable license to utilize our web workspace and signal infrastructure. You agree not to reverse-engineer, redistribute, scrape, or resell algorithmic signals, proprietary indicators, or conversational models without express written consent.'
                )}
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-100">
                4. {t('Subscription Fees & Billing Cycles')}
              </h2>
              <p>
                {t(
                  'PRO subscriptions are billed in advance on a recurring monthly or annual basis. You may cancel at any time through /settings/billing prior to the renewal date. All payments are processed securely through accredited payment partners including dLocal and Stripe.'
                )}
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-100">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                5. {t('Financial Disclaimer')}
              </h2>
              <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-4">
                <p className="mb-1 text-xs font-bold text-amber-200">
                  {t('Important Notice:')}
                </p>
                <p className="text-xs text-amber-100/80">
                  {t(
                    'DavinTrade AI provides informational and analytical tools only and does NOT constitute financial advice. Trading in financial markets involves substantial risk of loss. See our full'
                  )}{' '}
                  <Link
                    href="/disclaimer"
                    className="underline hover:text-amber-200"
                  >
                    {t('Financial Risk Disclaimer')}
                  </Link>{' '}
                  {t('for details.')}
                </p>
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-100">
                6. {t('Intellectual Property')}
              </h2>
              <p>
                {t(
                  'The Service and its original content, features, and functionality are owned by DavinTrade AI and are protected by international copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, or reverse engineer any part of the Service without our prior written consent.'
                )}
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-100">
                7. {t('Limitation of Liability')}
              </h2>
              <p>
                {t(
                  'To the maximum extent permitted by law, DavinTrade AI, its officers, affiliates, and licensors shall not be liable for any direct, indirect, incidental, or consequential trading losses or damages resulting from market volatility, system downtime, or analytical interpretations.'
                )}
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-100">
                8. {t('Termination')}
              </h2>
              <p>
                {t(
                  'We may suspend or terminate your access to the Service at any time, with or without cause, with or without notice. You may cancel your account at any time from /settings/account. All provisions of these Terms which by their nature should survive termination shall survive, including ownership provisions, warranty disclaimers, and limitations of liability.'
                )}
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-100">
                9. {t('Governing Law')}
              </h2>
              <p>
                {t(
                  'These Terms shall be governed by and construed in accordance with applicable law, without regard to its conflict of law provisions. Any disputes arising from these Terms or the Service will be resolved through good-faith negotiation in the first instance.'
                )}
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-100">
                10. {t('Contact Information')}
              </h2>
              <p>
                {t(
                  'If you have any questions about these Terms, please contact us at:'
                )}{' '}
                <a
                  href="mailto:legal@davintrade.com"
                  className="text-amber-400 underline hover:text-amber-300"
                >
                  legal@davintrade.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
