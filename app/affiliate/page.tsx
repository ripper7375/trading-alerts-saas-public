/**
 * Public Affiliate Landing Page (Row 48, Session 9-7a)
 *
 * Lives directly under app/affiliate/ (own passthrough layout.tsx, no
 * shared (marketing) chrome) -- mounts MarketingNavbar/MarketingFooter
 * directly, matching every other ungrouped app/affiliate/* page.
 *
 * A Server Component: the three pages it can show (administrator, existing
 * affiliate, visitor) are built here, and `AffiliateSessionGate` picks one in
 * the browser from the session. What needs the browser is small and lives in
 * `components/affiliate/` -- the sentences that quote the live commission and
 * price, and the earnings calculator.
 *
 * @module app/affiliate/page
 */

import Link from 'next/link';
import {
  Share2,
  Percent,
  Landmark,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Users,
  CheckCircle2,
  Calculator,
  Trophy,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CommissionPercentText } from '@/components/affiliate/commission-percent-text';
import {
  AffiliateCalculatorBasisText,
  AffiliateEarningsCalculator,
  AffiliateSessionGate,
} from '@/components/affiliate/affiliate-landing-leaves';
import { MarketingNavbar } from '@/components/marketing/marketing-navbar';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { getServerTranslator } from '@/lib/i18n/server-translator';

export default async function AffiliateLandingPage(): Promise<React.ReactElement> {
  const t = await getServerTranslator();

  const benefits = [
    {
      icon: Percent,
      title: (
        <CommissionPercentText
          template={t(
            'affiliate.landing.lifetime_commission',
            '{percent}% Lifetime Recurring Commission'
          )}
        />
      ),
      desc: t(
        'Earn every renewal as long as your referred trader maintains their PRO subscription.'
      ),
    },
    {
      icon: Landmark,
      title: t('Automated Wise Payouts'),
      desc: t(
        'Direct monthly disbursements via Wise with minimal gateway friction.'
      ),
    },
    {
      icon: Share2,
      title: t('Custom Promo Code Engine'),
      desc: t(
        'Generate branded discount coupons that give your audience a signup discount while securing your tracking attribution.'
      ),
    },
    {
      icon: Users,
      title: t('Dedicated Partner Success Manager'),
      desc: t(
        'Direct Telegram/Discord channel access, marketing banner packs, and high-converting video assets.'
      ),
    },
  ];

  const adminView = (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-[#050609] dark:text-slate-100">
      <MarketingNavbar />
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <Card className="w-full max-w-lg p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('Administrator Hub')}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t(
              'You are signed in with System Administrator privileges. Affiliate program oversight is managed from the Admin console.'
            )}
          </p>
          <div className="mt-6 space-y-3">
            <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
              <Link href="/admin">{t('Go to Admin Executive Dashboard')}</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/admin/affiliates/view-as">
                {t(
                  'affiliate.view_as.open_picker',
                  "View an affiliate's dashboard (read-only)"
                )}
              </Link>
            </Button>
          </div>
        </Card>
      </div>
      <MarketingFooter />
    </div>
  );

  const affiliateView = (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-[#050609] dark:text-slate-100">
      <MarketingNavbar />
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <Card className="w-full max-w-lg p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("You're Already an Affiliate Partner")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t(
              'Your account is active in our Affiliate Partner Program. You can access your referral codes, earnings, and promotional resources below.'
            )}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href="/affiliate/dashboard">
                {t('Go to Affiliate Dashboard')}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">{t('Go to Trading Dashboard')}</Link>
            </Button>
          </div>
        </Card>
      </div>
      <MarketingFooter />
    </div>
  );

  return (
    <AffiliateSessionGate adminView={adminView} affiliateView={affiliateView}>
      <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-[#050609] dark:text-slate-100">
        <MarketingNavbar />

        <main className="flex-1">
          {/* Hero */}
          <section className="relative overflow-hidden border-b border-slate-200 px-4 py-20 dark:border-slate-800/80 md:px-6 md:py-28">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.15),transparent_60%)]" />
            <div className="container relative mx-auto max-w-5xl space-y-6 text-center">
              <Badge className="border-amber-500/40 bg-amber-500/15 px-3 py-1 font-mono text-xs text-amber-700 dark:text-amber-400">
                {t('DavinTrade Partner Program')}
              </Badge>

              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl md:text-6xl">
                {t('Partner with the Leader in')}{' '}
                <span className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 bg-clip-text text-transparent dark:from-amber-400 dark:via-amber-200 dark:to-yellow-500">
                  {t('Quantitative AI Trading')}
                </span>
              </h1>

              <p className="mx-auto max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-400 md:text-lg">
                <CommissionPercentText
                  template={t(
                    'affiliate.landing.subtitle',
                    'Earn {percent}% recurring monthly revenue by introducing traders to DavinTrade AI precision fractal analytics and conversational copilots.'
                  )}
                />
              </p>

              <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                <Link href="/affiliate/register">
                  <Button className="bg-gradient-to-r from-amber-500 to-amber-600 px-8 py-5 font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500">
                    <Sparkles className="mr-2 h-4 w-4" />
                    {t('Join Affiliate Program')}
                  </Button>
                </Link>
                <Link href="/affiliate/leaderboard">
                  <Button
                    variant="outline"
                    className="border-slate-300 bg-white px-6 py-5 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Trophy className="mr-2 h-4 w-4 text-amber-600 dark:text-amber-400" />
                    {t('See Top Earners')}
                  </Button>
                </Link>
                <Link href="/affiliate/dashboard">
                  <Button
                    variant="outline"
                    className="border-slate-300 bg-white px-6 py-5 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Share2 className="mr-2 h-4 w-4 text-amber-600 dark:text-amber-400" />
                    {t('Partner Login')}
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          {/* Earnings Calculator */}
          <section className="container mx-auto max-w-4xl px-4 py-16 md:px-6">
            <Card className="border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-slate-100 p-6 shadow-2xl backdrop-blur-xl dark:from-[#0c0f1d] dark:via-[#090b14] dark:to-[#07080e] md:p-10">
              <div className="mb-8 space-y-2 text-center">
                <div className="flex justify-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Calculator className="h-5 w-5" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {t('Estimate Your Monthly Recurring Revenue')}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  <AffiliateCalculatorBasisText
                    template={t(
                      'affiliate.landing.calculator_basis',
                      'Based on active PRO subscriptions at {price}/mo with {percent}% commission.'
                    )}
                  />
                </p>
              </div>

              <div className="mx-auto max-w-xl space-y-6">
                <AffiliateEarningsCalculator
                  labels={{
                    activeReferredTraders: t('Active Referred Traders'),
                    traders: t('traders'),
                    monthlyRecurring: t('Monthly Recurring'),
                    perMonth: t('/ month'),
                    annualPotential: t('Annual Potential'),
                    perYear: t('/ year'),
                  }}
                />

                <div className="pt-2 text-center">
                  <Link href="/affiliate/register">
                    <Button className="w-full bg-amber-500 py-5 font-bold text-slate-950 hover:bg-amber-400">
                      {t('Start Earning Today')}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          </section>

          {/* Benefits Grid */}
          <section className="border-t border-slate-200 bg-slate-100/60 px-4 py-16 dark:border-slate-800/80 dark:bg-[#070910] md:px-6">
            <div className="container mx-auto max-w-6xl">
              <div className="mb-12 space-y-3 text-center">
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 md:text-3xl">
                  {t('Why Top Creators & Educators Choose DavinTrade')}
                </h2>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {benefits.map((b, index) => {
                  const Icon = b.icon;
                  return (
                    <Card
                      key={index}
                      className="space-y-4 border-slate-200 bg-white p-6 shadow-md transition-colors hover:border-amber-500/40 dark:border-slate-800/80 dark:bg-[#090b14]/90"
                    >
                      <CardContent className="space-y-4 p-0">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          <Icon className="h-6 w-6" />
                        </div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                          {b.title}
                        </h3>
                        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400 md:text-sm">
                          {b.desc}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </section>
        </main>

        <MarketingFooter />
      </div>
    </AffiliateSessionGate>
  );
}
