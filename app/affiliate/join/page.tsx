'use client';

/**
 * Partner Onboarding Highlights Page (Row 43, Session 9-7a)
 *
 * Replaces the legacy 1-line redirect to /affiliate/register with the
 * full DavinTrade partner onboarding page: program highlights, payout
 * overview, and a direct CTA into registration.
 *
 * @module app/affiliate/join/page
 */

import Link from 'next/link';
import {
  Share2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Percent,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarketingNavbar } from '@/components/marketing/marketing-navbar';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { useLocale } from '@/lib/context/locale-context';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

export default function AffiliateJoinPage(): React.ReactElement {
  const { t } = useLocale();
  const { commissionPercent } = useAffiliateConfig();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-[#050609] dark:text-slate-100">
      <MarketingNavbar />

      <main className="container mx-auto max-w-3xl flex-1 px-4 py-16 md:px-6">
        <div className="space-y-8 text-center">
          <div className="space-y-3">
            <Badge className="border-amber-500/40 bg-amber-500/15 px-3 py-1 font-mono text-xs text-amber-700 dark:text-amber-400">
              {t('Partner Onboarding')}
            </Badge>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 md:text-4xl">
              {t('Join the DavinTrade Partner Network')}
            </h1>
            <p className="mx-auto max-w-xl text-sm text-slate-600 dark:text-slate-400">
              {t(
                `Instant partner application. Start creating custom promo codes and earning ${commissionPercent}% lifetime recurring commissions immediately.`
              )}
            </p>
          </div>

          <Card className="space-y-6 border-slate-200 bg-white p-6 text-left shadow-2xl dark:border-amber-500/30 dark:bg-[#090b14]/95 dark:backdrop-blur-2xl md:p-8">
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {t('Program Highlights')}
              </h3>

              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-[#06080e]">
                  <Percent className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200">
                      {t(`${commissionPercent}% Recurring Monthly Share`)}
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      {t(
                        'Earn every month as long as referred subscribers remain active.'
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-[#06080e]">
                  <Share2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200">
                      {t('Unique Promo Code Attribution')}
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      {t(
                        'Give your referrals a signup discount while binding their account to you forever.'
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-[#06080e]">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-400" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200">
                      {t('Automated Wise Payouts on the 1st of every month')}
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      {t(
                        'Transparent ledger with zero hidden fees and direct bank transfer options.'
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <Link href="/affiliate/register">
                <Button className="w-full bg-amber-500 py-5 font-bold text-slate-950 hover:bg-amber-400">
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t('Proceed to Partner Registration')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <p className="text-center text-[11px] text-slate-600 dark:text-slate-500">
                {t('Already registered?')}{' '}
                <Link
                  href="/affiliate/dashboard"
                  className="text-amber-600 hover:underline dark:text-amber-400"
                >
                  {t('Access Partner Dashboard')}
                </Link>
              </p>
            </div>
          </Card>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
