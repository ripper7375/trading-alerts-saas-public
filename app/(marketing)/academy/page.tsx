import Link from 'next/link';
import {
  GraduationCap,
  Sparkles,
  ArrowRight,
  Star,
  PlayCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  listPublishedTutorials,
  type TutorialCategory,
} from '@/lib/tutorials/service';
import { TUTORIAL_CATEGORIES } from '@/lib/tutorials/validators';
import { getYouTubeThumbnailUrl } from '@/lib/tutorials/youtube';
import { getServerLanguage } from '@/lib/i18n/server-locale';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export async function generateMetadata(): Promise<{
  title: string;
  description: string;
}> {
  const dict = getDictionary(await getServerLanguage());
  return {
    title:
      dict['academy.meta_title'] ??
      'DavinTrade Academy | Learn to Trade & Master the Platform',
    description:
      dict['academy.meta_description'] ??
      'Free video tutorials on trading fundamentals, risk management, market analysis, and how to get the most out of the DavinTrade AI platform.',
  };
}

const CATEGORY_LABEL_KEYS: Record<TutorialCategory, string> = {
  GETTING_STARTED: 'academy.category.getting_started',
  PLATFORM_WALKTHROUGH: 'academy.category.platform_walkthrough',
  TRADING_STRATEGIES: 'academy.category.trading_strategies',
  RISK_MANAGEMENT: 'academy.category.risk_management',
  MARKET_ANALYSIS: 'academy.category.market_analysis',
};

const CATEGORY_LABELS: Record<TutorialCategory, string> = {
  GETTING_STARTED: 'Getting Started',
  PLATFORM_WALKTHROUGH: 'Platform Walkthrough',
  TRADING_STRATEGIES: 'Trading Strategies',
  RISK_MANAGEMENT: 'Risk Management',
  MARKET_ANALYSIS: 'Market Analysis',
};

interface AcademyPageProps {
  searchParams: Promise<{ category?: string }>;
}

function isValidCategory(value: string | undefined): value is TutorialCategory {
  return !!value && (TUTORIAL_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Public, unauthenticated Academy landing page (Davin, 2026-08-31 ad-hoc
 * request) -- admin-curated YouTube tutorials teaching trading fundamentals
 * and how to use the DavinTrade platform, built to drive PRO upgrades and
 * Affiliate Program signups. Server Component: calls the tutorials service
 * directly, same pattern app/affiliate/leaderboard/page.tsx established for
 * public Prisma-backed marketing content -- no separate public API route.
 */
export default async function AcademyPage({
  searchParams,
}: AcademyPageProps): Promise<React.ReactElement> {
  const params = (await searchParams) || {};
  const activeCategory = isValidCategory(params.category)
    ? params.category
    : undefined;

  const tutorials = await listPublishedTutorials({ category: activeCategory });
  const dict = getDictionary(await getServerLanguage());
  const categoryLabel = (cat: TutorialCategory): string =>
    dict[CATEGORY_LABEL_KEYS[cat]] ?? CATEGORY_LABELS[cat];

  return (
    <div className="bg-slate-50 text-slate-900 dark:bg-[#050609] dark:text-slate-100">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200 px-4 py-16 dark:border-slate-800/80 md:px-6 md:py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.15),transparent_60%)]" />
        <div className="container relative mx-auto max-w-4xl space-y-5 text-center">
          <Badge className="border-amber-500/40 bg-amber-500/15 px-3 py-1 font-mono text-xs text-amber-700 dark:text-amber-400">
            {dict['academy.badge'] ?? 'DavinTrade Academy'}
          </Badge>

          <h1 className="flex items-center justify-center gap-3 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl md:text-5xl">
            <GraduationCap className="h-9 w-9 text-amber-500" />
            {dict['academy.hero_title'] ??
              'Learn to Trade. Master the Platform.'}
          </h1>

          <p className="mx-auto max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-400 md:text-lg">
            {dict['academy.hero_subtitle'] ??
              "Free video lessons on trading fundamentals and risk management, plus hands-on walkthroughs of DavinTrade's AI pattern recognition, alerts, and fractal analytics -- everything you need to trade with confidence."}
          </p>

          {/* Category filter pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <Link
              href="/academy"
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                !activeCategory
                  ? 'bg-amber-500 font-bold text-slate-950 shadow-md shadow-amber-500/20'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {dict['academy.category.all'] ?? 'All'}
            </Link>
            {TUTORIAL_CATEGORIES.map((cat) => (
              <Link
                key={cat}
                href={`/academy?category=${cat}`}
                className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                  activeCategory === cat
                    ? 'bg-amber-500 font-bold text-slate-950 shadow-md shadow-amber-500/20'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {categoryLabel(cat)}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Video Grid */}
      <section className="container mx-auto max-w-6xl px-4 py-14 md:px-6">
        {tutorials.length === 0 ? (
          <Card className="border-slate-200 bg-white dark:border-slate-800/80 dark:bg-[#090b14]/90">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <PlayCircle className="h-10 w-10 text-slate-400" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {activeCategory
                  ? (dict['academy.no_tutorials_in_category'] ??
                    'No tutorials in this category yet -- check back soon.')
                  : (dict['academy.no_tutorials_yet'] ??
                    'New tutorials are on the way -- check back soon.')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {tutorials.map((tutorial) => (
              <Link key={tutorial.id} href={`/academy/${tutorial.id}`}>
                <Card className="h-full border-slate-200 bg-white shadow-md transition-all duration-200 hover:border-amber-500/40 hover:bg-slate-50 dark:border-slate-800/80 dark:bg-[#090b14]/90 dark:backdrop-blur-xl dark:hover:bg-[#0c0f1c]">
                  <CardContent className="flex h-full flex-col justify-between space-y-3 p-0">
                    <div className="relative">
                      <img
                        src={getYouTubeThumbnailUrl(tutorial.youtubeVideoId)}
                        alt={tutorial.title}
                        className="aspect-video w-full rounded-t-xl object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center rounded-t-xl bg-black/0 transition-colors hover:bg-black/20">
                        <PlayCircle className="h-10 w-10 text-white opacity-0 drop-shadow-lg transition-opacity hover:opacity-90" />
                      </div>
                      {tutorial.featured && (
                        <Badge className="absolute left-2 top-2 gap-1 bg-amber-500 text-slate-950">
                          <Star className="h-3 w-3 fill-slate-950" />
                          {dict['academy.featured'] ?? 'Featured'}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col justify-between space-y-2 p-4 pt-0">
                      <div className="space-y-2">
                        <Badge className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400">
                          {categoryLabel(tutorial.category)}
                        </Badge>
                        <h3 className="text-base font-bold leading-snug text-slate-900 dark:text-slate-100">
                          {tutorial.title}
                        </h3>
                        <p className="line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                          {tutorial.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-slate-200 bg-slate-100/60 px-4 py-14 dark:border-slate-800/80 dark:bg-[#070910] md:px-6">
        <div className="container mx-auto max-w-3xl space-y-5 text-center">
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 md:text-3xl">
            {dict['academy.cta_title'] ?? 'Ready to put it into practice?'}
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            {dict['academy.cta_subtitle'] ??
              "Upgrade to PRO for full AI pattern recognition and real-time alerts, or turn what you've learned into recurring income by introducing other traders to DavinTrade."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Button
              asChild
              className="bg-gradient-to-r from-amber-500 to-amber-600 px-8 py-5 font-bold text-slate-950 shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-amber-500"
            >
              <Link href="/checkout">
                {dict['academy.upgrade_to_pro_now'] ?? 'Upgrade to PRO Now'}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-slate-300 bg-white px-6 py-5 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Link href="/affiliate/register">
                <Sparkles className="mr-2 h-4 w-4 text-amber-600 dark:text-amber-400" />
                {dict['analytics.join_affiliate_program'] ??
                  'Join Affiliate Program'}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
