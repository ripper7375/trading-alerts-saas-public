import Link from 'next/link';
import { Trophy, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

import { TopAffiliatesLeaderboard } from '@/components/admin/analytics/top-affiliates-leaderboard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MarketingNavbar } from '@/components/marketing/marketing-navbar';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { getPublicAffiliateLeaderboard } from '@/lib/admin/analytics/affiliates';

export const metadata = {
  title: 'Top Affiliate Earners | DavinTrade Partner Program',
  description:
    'See what our top-performing DavinTrade affiliate partners are earning right now.',
};

/**
 * Public, unauthenticated affiliate leaderboard -- marketing social proof
 * for the Partner Program (Davin, 2026-08-31 ad-hoc follow-up). Reachable
 * without login from `/affiliate`. Renders only the privacy-preserving
 * subset returned by `getPublicAffiliateLeaderboard()` (masked partner
 * IDs, country, real gross-sales/commission dollar figures) -- never the
 * full admin affiliate analytics payload.
 */
export default async function PublicAffiliateLeaderboardPage(): Promise<React.ReactElement> {
  const data = await getPublicAffiliateLeaderboard();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-[#050609] dark:text-slate-100">
      <MarketingNavbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-slate-200 px-4 py-16 dark:border-slate-800/80 md:px-6 md:py-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.15),transparent_60%)]" />
          <div className="container relative mx-auto max-w-4xl space-y-5 text-center">
            <Badge className="border-amber-500/40 bg-amber-500/15 px-3 py-1 font-mono text-xs text-amber-700 dark:text-amber-400">
              DavinTrade Partner Program
            </Badge>

            <h1 className="flex items-center justify-center gap-3 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl md:text-5xl">
              <Trophy className="h-9 w-9 text-amber-500" />
              Top Affiliate Earners
            </h1>

            <p className="mx-auto max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-400 md:text-lg">
              {data.totalActiveAffiliates.toLocaleString()} active partners are
              already earning recurring commission by introducing traders to
              DavinTrade. Here&apos;s what our top 20 are making right now.
            </p>

            <div className="flex justify-center pt-2">
              <Link href="/affiliate/register">
                <Button className="bg-gradient-to-r from-amber-500 to-amber-600 px-8 py-5 font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Become an Affiliate Now
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Leaderboard */}
        <section className="container mx-auto max-w-5xl px-4 py-14 md:px-6">
          <Card className="border-amber-500/40 bg-white p-4 shadow-2xl dark:border-amber-500/20 dark:bg-[#090b14]/90 md:p-6">
            <CardContent className="space-y-4 p-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    This Period&apos;s Top 20
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-500">
                    Trailing 3-month gross sales &amp; commission earned
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-500">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Names and contact details are never shown
                </div>
              </div>

              <TopAffiliatesLeaderboard rows={data.top20Leaderboard} />
            </CardContent>
          </Card>
        </section>

        {/* Bottom CTA */}
        <section className="border-t border-slate-200 bg-slate-100/60 px-4 py-14 text-center dark:border-slate-800/80 dark:bg-[#070910] md:px-6">
          <div className="container mx-auto max-w-2xl space-y-5">
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 md:text-3xl">
              Ready to join them?
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Get your own referral codes and start earning lifetime recurring
              commission today.
            </p>
            <Link href="/affiliate/register">
              <Button className="bg-amber-500 px-8 py-5 font-bold text-slate-950 hover:bg-amber-400">
                Join Affiliate Program
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
