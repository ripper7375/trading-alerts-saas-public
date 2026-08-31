import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Eye, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  getPublishedTutorialById,
  incrementTutorialViewCount,
  getRelatedTutorials,
  type TutorialCategory,
} from '@/lib/tutorials/service';
import {
  getYouTubeEmbedUrl,
  getYouTubeThumbnailUrl,
} from '@/lib/tutorials/youtube';

const CATEGORY_LABELS: Record<TutorialCategory, string> = {
  GETTING_STARTED: 'Getting Started',
  PLATFORM_WALKTHROUGH: 'Platform Walkthrough',
  TRADING_STRATEGIES: 'Trading Strategies',
  RISK_MANAGEMENT: 'Risk Management',
  MARKET_ANALYSIS: 'Market Analysis',
};

interface TutorialDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: TutorialDetailPageProps) {
  const { id } = await params;
  const tutorial = await getPublishedTutorialById(id);

  if (!tutorial) {
    return { title: 'Tutorial Not Found | DavinTrade Academy' };
  }

  return {
    title: `${tutorial.title} | DavinTrade Academy`,
    description: tutorial.description,
  };
}

/**
 * Public, unauthenticated Academy video-detail page (Davin, 2026-08-31
 * ad-hoc request). `getPublishedTutorialById` is read-only, so it's safe to
 * call again here even though `generateMetadata` already called it for this
 * same request -- only `incrementTutorialViewCount` runs, exactly once,
 * from this page body.
 */
export default async function TutorialDetailPage({
  params,
}: TutorialDetailPageProps): Promise<React.ReactElement> {
  const { id } = await params;
  const tutorial = await getPublishedTutorialById(id);

  if (!tutorial) {
    notFound();
  }

  await incrementTutorialViewCount(id);

  const related = await getRelatedTutorials(tutorial.category, tutorial.id);

  return (
    <div className="bg-slate-50 text-slate-900 dark:bg-[#050609] dark:text-slate-100">
      <div className="container mx-auto max-w-5xl px-4 py-12 md:px-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          {/* Player + details */}
          <div className="space-y-5">
            <div className="aspect-video w-full overflow-hidden rounded-xl border border-slate-200 shadow-lg dark:border-slate-800/80">
              <iframe
                src={getYouTubeEmbedUrl(tutorial.youtubeVideoId)}
                title={tutorial.title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  {CATEGORY_LABELS[tutorial.category]}
                </Badge>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Eye className="h-3.5 w-3.5" />
                  {(tutorial.viewCount + 1).toLocaleString()} views
                </span>
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 md:text-3xl">
                {tutorial.title}
              </h1>

              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {tutorial.description}
              </p>
            </div>

            <Link
              href="/academy"
              className="inline-block text-sm font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
            >
              &larr; Back to all tutorials
            </Link>
          </div>

          {/* CTA sidebar */}
          <aside className="space-y-4">
            <Card className="border-amber-500/40 bg-white shadow-xl dark:border-amber-500/20 dark:bg-[#090b14]/90">
              <CardContent className="space-y-3 p-5">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Ready to put it into practice?
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Get full AI pattern recognition and real-time alerts with
                  DavinTrade PRO.
                </p>
                <Button
                  asChild
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 font-bold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
                >
                  <Link href="/checkout">
                    Upgrade to PRO Now
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/affiliate/register">
                    <Sparkles className="mr-1.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
                    Join Affiliate Program
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {related.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Related Tutorials
                </h3>
                {related.map((r) => (
                  <Link
                    key={r.id}
                    href={`/academy/${r.id}`}
                    className="flex gap-3 rounded-lg border border-slate-200 bg-white p-2 transition-colors hover:border-amber-500/40 dark:border-slate-800/80 dark:bg-[#090b14]/90"
                  >
                    <img
                      src={getYouTubeThumbnailUrl(r.youtubeVideoId)}
                      alt={r.title}
                      className="h-12 w-20 shrink-0 rounded object-cover"
                    />
                    <span className="line-clamp-2 text-xs font-medium text-slate-800 dark:text-slate-200">
                      {r.title}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
