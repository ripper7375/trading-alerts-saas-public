/**
 * DavinTrade Academy — video detail (mobile reference)
 *
 * Mobile version of the monolith's app/(marketing)/academy/[id]/page.tsx --
 * embedded YouTube player, related tutorials, and the same PRO/Affiliate
 * CTA as the listing page. Public, unauthenticated, reachable without login.
 */

import { ArrowLeft, ArrowRight, Eye, Sparkles } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  CATEGORY_LABELS,
  getRelatedTutorials,
  getTutorialById,
} from '@/lib/tutorials/constants';
import {
  getYouTubeEmbedUrl,
  getYouTubeThumbnailUrl,
} from '@/lib/tutorials/youtube';

export default function AcademyDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const tutorial = id ? getTutorialById(id) : undefined;

  if (!tutorial) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4 text-center">
        <p className="text-sm text-muted-foreground">Tutorial not found.</p>
        <Button variant="outline" onClick={() => navigate('/academy')}>
          Back to all tutorials
        </Button>
      </div>
    );
  }

  const related = getRelatedTutorials(tutorial.category, tutorial.id);

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/academy')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="truncate text-lg font-semibold">{tutorial.title}</h1>
        </div>
      </div>

      <div className="space-y-5 p-4 pb-10">
        <div className="aspect-video w-full overflow-hidden rounded-xl border border-border shadow-lg">
          <iframe
            src={getYouTubeEmbedUrl(tutorial.youtubeVideoId)}
            title={tutorial.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
              {CATEGORY_LABELS[tutorial.category]}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
              {(tutorial.viewCount + 1).toLocaleString()} views
            </span>
          </div>

          <h2 className="text-xl font-extrabold tracking-tight">
            {tutorial.title}
          </h2>

          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {tutorial.description}
          </p>
        </div>

        <Card className="border-amber-500/40">
          <CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-bold">
              Ready to put it into practice?
            </h3>
            <p className="text-xs text-muted-foreground">
              Get full AI pattern recognition and real-time alerts with
              DavinTrade PRO.
            </p>
            <Button
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 font-bold text-slate-950 hover:from-amber-400 hover:to-amber-500"
              onClick={() => navigate('/settings/subscription')}
            >
              Upgrade to PRO Now
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/settings/affiliate')}
            >
              <Sparkles className="mr-1.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
              Join Affiliate Program
            </Button>
          </CardContent>
        </Card>

        {related.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Related Tutorials
            </h3>
            {related.map((r) => (
              <button
                key={r.id}
                onClick={() => navigate(`/academy/${r.id}`)}
                className="flex w-full gap-3 rounded-lg border border-border bg-card p-2 text-left transition-colors hover:border-amber-500/40"
              >
                <img
                  src={getYouTubeThumbnailUrl(r.youtubeVideoId)}
                  alt={r.title}
                  className="h-12 w-20 shrink-0 rounded object-cover"
                />
                <span className="line-clamp-2 text-xs font-medium">
                  {r.title}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
