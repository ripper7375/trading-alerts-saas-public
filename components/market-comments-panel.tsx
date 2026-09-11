'use client';

import { ChevronRight, MessageSquareText, Bell } from 'lucide-react';

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
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <MessageSquareText className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold text-foreground">
            {t('Market Comments')}
          </span>
          <Badge
            variant="outline"
            className="border-border font-mono text-[9px] text-muted-foreground"
          >
            {tier}
          </Badge>
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
        {tier === 'FREE' && onOpenUpgradeModal && (
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
    </div>
  );
}
