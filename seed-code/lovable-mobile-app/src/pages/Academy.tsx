/**
 * DavinTrade Academy — listing (mobile reference)
 *
 * Mobile version of the monolith's app/(marketing)/academy/page.tsx --
 * public, unauthenticated video-tutorial library teaching trading
 * fundamentals and how to use the DavinTrade platform, built to drive PRO
 * upgrades and Affiliate Program signups. Reachable without login, mirrors
 * the /affiliate/leaderboard public-page pattern established earlier.
 */

import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  PlayCircle,
  Sparkles,
  Star,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  CATEGORY_LABELS,
  MOCK_TUTORIALS,
  TUTORIAL_CATEGORIES,
} from '@/lib/tutorials/constants';
import { getYouTubeThumbnailUrl } from '@/lib/tutorials/youtube';
import type { TutorialCategory } from '@/types/tutorial';
import { cn } from '@/lib/utils';

function isValidCategory(value: string | null): value is TutorialCategory {
  return !!value && (TUTORIAL_CATEGORIES as readonly string[]).includes(value);
}

export default function Academy() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const categoryParam = searchParams.get('category');
  const activeCategory = isValidCategory(categoryParam)
    ? categoryParam
    : undefined;

  const tutorials = activeCategory
    ? MOCK_TUTORIALS.filter((t) => t.category === activeCategory)
    : MOCK_TUTORIALS;

  const selectCategory = (category?: TutorialCategory) => {
    if (category) {
      setSearchParams({ category });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">DavinTrade Academy</h1>
        </div>
      </div>

      <div className="space-y-6 p-4 pb-10">
        <div className="space-y-3 text-center">
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
            DavinTrade Academy
          </Badge>
          <div className="flex items-center justify-center gap-2">
            <GraduationCap className="h-7 w-7 text-amber-500" />
            <h2 className="text-xl font-extrabold">
              Learn to Trade. Master the Platform.
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Free video lessons on trading fundamentals and risk management, plus
            hands-on walkthroughs of DavinTrade's AI pattern recognition,
            alerts, and fractal analytics.
          </p>
        </div>

        {/* Category filter pills */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <button
            onClick={() => selectCategory(undefined)}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all',
              !activeCategory
                ? 'bg-amber-500 font-bold text-slate-950'
                : 'border border-border bg-card text-muted-foreground'
            )}
          >
            All
          </button>
          {TUTORIAL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => selectCategory(cat)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all',
                activeCategory === cat
                  ? 'bg-amber-500 font-bold text-slate-950'
                  : 'border border-border bg-card text-muted-foreground'
              )}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Video list */}
        {tutorials.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <PlayCircle className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No tutorials in this category yet — check back soon.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tutorials.map((tutorial) => (
              <Card
                key={tutorial.id}
                className="cursor-pointer overflow-hidden transition-colors hover:border-amber-500/40"
                onClick={() => navigate(`/academy/${tutorial.id}`)}
              >
                <div className="relative">
                  <img
                    src={getYouTubeThumbnailUrl(tutorial.youtubeVideoId)}
                    alt={tutorial.title}
                    className="aspect-video w-full object-cover"
                  />
                  {tutorial.featured && (
                    <Badge className="absolute left-2 top-2 gap-1 bg-amber-500 text-slate-950">
                      <Star className="h-3 w-3 fill-slate-950" />
                      Featured
                    </Badge>
                  )}
                </div>
                <CardContent className="space-y-1.5 p-3">
                  <Badge className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400">
                    {CATEGORY_LABELS[tutorial.category]}
                  </Badge>
                  <h3 className="text-sm font-bold leading-snug">
                    {tutorial.title}
                  </h3>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {tutorial.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Bottom CTA */}
        <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-center">
          <h3 className="text-base font-extrabold">
            Ready to put it into practice?
          </h3>
          <p className="text-xs text-muted-foreground">
            Upgrade to PRO for full AI pattern recognition and real-time alerts,
            or turn what you've learned into recurring income.
          </p>
          <div className="space-y-2">
            <Button
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 font-bold text-slate-950 hover:from-amber-400 hover:to-amber-500"
              onClick={() => navigate('/settings/subscription')}
            >
              Upgrade to PRO Now
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="w-full border-amber-500/40"
              onClick={() => navigate('/settings/affiliate')}
            >
              <Sparkles className="mr-1.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
              Join Affiliate Program
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
