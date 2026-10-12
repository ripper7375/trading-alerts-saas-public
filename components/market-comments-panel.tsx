'use client';

import Link from 'next/link';
import {
  Bell,
  ChevronRight,
  Lock,
  MessageSquareText,
  Sparkles,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ContainmentRateStrip } from '@/components/market-sessions/containment-rate-strip';
import { SessionStatusBanner } from '@/components/market-sessions/session-status-banner';
import type { Tier } from '@/lib/tier-config';
import { useLocale } from '@/lib/context/locale-context';

interface MarketCommentsPanelProps {
  tier: Tier;
  onCollapsePanel?: () => void;
  onOpenUpgradeModal?: () => void;
}

/**
 * Market Comments & Quality Metrics Panel -- Session 9-4 empty state.
 *
 * Stack E (the real generated market-comments feed, Phase 13) is not built
 * yet. `seed-code`'s own `market-comments-panel.tsx` is a full mock
 * prototype -- fabricated SSA-cross/EDT-touch comment history, a fake
 * countdown timer, an invented trade-setup card with fictional entry/TP/SL
 * prices. Per this session's Decision 2 (zero mock data, Session 6-1b's own
 * founding lesson), this panel renders a genuine empty state instead --
 * real line alerts fire from the real alert engine today, the narrated
 * comments feed does not exist yet, and the panel says exactly that rather
 * than simulating market commentary or a fabricated trade recommendation.
 */
export default function MarketCommentsPanel({
  tier,
  onCollapsePanel,
  onOpenUpgradeModal,
}: MarketCommentsPanelProps): React.JSX.Element {
  const { t } = useLocale();

  return (
    <div className="flex h-full w-full flex-col overflow-hidden border-l border-border bg-card">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3.5">
        <div className="flex items-center gap-2">
          {tier === 'FREE' ? (
            <Avatar className="h-7 w-7 rounded-lg border border-amber-500/30">
              <AvatarImage
                src="/DavinTrade_Logo.jpg"
                alt="DavinTrade"
                className="rounded-lg object-cover"
              />
              <AvatarFallback className="rounded-lg bg-amber-500/10 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                DT
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <MessageSquareText className="h-4 w-4" />
            </div>
          )}
          <span className="text-xs font-bold text-foreground">
            {tier === 'FREE' ? t('FREE Tier') : t('Market Comments')}
          </span>
          {tier === 'PRO' && (
            <Badge
              variant="outline"
              className="border-border font-mono text-[9px] text-muted-foreground"
            >
              {t('PRO Tier')}
            </Badge>
          )}
        </div>
        {onCollapsePanel && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCollapsePanel}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title={t('Collapse panel')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/*
        The genuinely real content in this panel today: session state
        (computed from the clock, not simulated) and a Containment Rate
        reading from `indicator_statistics` (a raw stored percentage, not a
        fabricated score -- see ContainmentRateStrip's own header). Neither
        falls under this panel's zero-mock-data rule.

        PRO-only, matching the design: `seed-code`'s own /free treatment
        blurs this entire panel behind a lock whose copy names the feature
        set explicitly -- "Live Market Comments, SESSION COUNTDOWNS, Gauges,
        and EDT Quality Metrics require a PRO subscription". This monolith
        has no such overlay only because the panel had no real content to
        gate; these two blocks are it, so the gate applies to them instead.

        NOTE -- this is a presentation gate, NOT an entitlement boundary for
        the session-clock half. Session state is computed client-side from
        the clock, so nothing secret is being withheld there. The
        containment-rate half IS a genuine entitlement boundary, enforced
        server-side by /api/market/indicator-statistics itself -- this
        client-side check only spares a FREE session a request that route
        would 403 anyway. Neither should be mistaken for the
        `requireChartDownload()` class of check.
      */}
      {tier !== 'FREE' && (
        <div className="pt-3">
          <SessionStatusBanner />
          <ContainmentRateStrip />
        </div>
      )}

      {tier === 'FREE' ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Lock className="h-6 w-6" />
          </div>

          <div className="mt-4 space-y-1.5 text-xs font-semibold text-foreground">
            <p>{t('comments.free_tier_feature_1', 'Market Comments')}</p>
            <p>{t('comments.free_tier_feature_2', 'Market Session')}</p>
            <p>
              {t('comments.free_tier_feature_3', 'High Impact News and Events')}
            </p>
            <p>
              {t('comments.free_tier_feature_4', 'Market Context Analysis')}
            </p>
            <p>{t('comments.free_tier_feature_5', 'Trade Setup Analysis')}</p>
            <p>{t('comments.free_tier_feature_6', 'EDT Quality Metrics')}</p>
          </div>

          <p className="mt-4 text-xs font-medium text-muted-foreground">
            {t(
              'comments.free_tier_unavailable',
              'are unavailable for FREE Tier'
            )}
          </p>

          <div className="mt-5">
            <Button
              asChild
              size="sm"
              className="bg-amber-500 font-bold text-slate-950 shadow-md shadow-amber-500/20 hover:bg-amber-400"
            >
              <Link href="/pricing">
                <Sparkles className="mr-1.5 h-3.5 w-3.5 fill-black" />
                {t('dashboard.upgrade_to_pro', 'Upgrade to PRO')}
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <MessageSquareText className="h-6 w-6" />
          </div>
          <p className="text-sm font-bold text-foreground">
            {t('Live Market Comments Coming Soon')}
          </p>
          <p className="max-w-[220px] text-xs leading-relaxed text-muted-foreground">
            {t(
              'The generated market-comments feed connects in a future phase — line alerts you draw on the chart fire for real today.'
            )}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
            <Bell className="h-3.5 w-3.5" />
            <span>{t('Real-time line alerts are live')}</span>
          </div>
          {onOpenUpgradeModal && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenUpgradeModal}
              className="mt-3 h-7 border-amber-500/40 bg-amber-500/10 text-[11px] font-bold text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
            >
              {t('Get priority access on PRO')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
