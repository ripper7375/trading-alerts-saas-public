'use client';

/**
 * ChartControlHeader — timeframe switch, daily-reset countdown, and the
 * spread-delta "jackpot meter" gauge (spec Sections 2.2/5.2).
 *
 * @module components/currency-index-pro/chart/chart-control-header
 */

import { formatCountdown } from '@/lib/market-sessions/sessions';
import { useLocale } from '@/lib/context/locale-context';

import { useSessionCountdown } from '../hooks/use-session-countdown';
import type { SpreadDelta } from '../hooks/use-currency-index-screener';

interface ChartControlHeaderProps {
  timeframe: 'M5' | 'M15';
  onTimeframeChange: (timeframe: 'M5' | 'M15') => void;
  todaySessionOpen: number | null;
  spreadDelta: SpreadDelta | null;
}

const SPREAD_BADGE_CLASS: Record<SpreadDelta['status'], string> = {
  LOW: 'border-border bg-muted text-muted-foreground',
  ACTIVE:
    'border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-300',
  // Spec Section 2.3: pulsing neon red/orange glow on the EXTREME gap.
  EXTREME:
    'border-red-500/60 bg-red-500/15 text-red-700 dark:text-red-300 animate-pulse',
};

const SPREAD_BADGE_LABEL_KEY: Record<
  SpreadDelta['status'],
  { key: string; label: string }
> = {
  LOW: {
    key: 'currency_index_pro.spread.low_volatility',
    label: 'LOW VOLATILITY',
  },
  ACTIVE: {
    key: 'currency_index_pro.spread.active_divergence',
    label: 'ACTIVE DIVERGENCE',
  },
  EXTREME: {
    key: 'currency_index_pro.spread.extreme_gap',
    label: 'EXTREME GAP',
  },
};

export function ChartControlHeader({
  timeframe,
  onTimeframeChange,
  todaySessionOpen,
  spreadDelta,
}: ChartControlHeaderProps): React.JSX.Element {
  const { t } = useLocale();
  // Approximation, same as the chart route's own comment: the exact
  // next-rollover instant is only known to the VPS engine's DST-aware
  // logic; +24h is good enough for a countdown display.
  const nextSessionOpen =
    todaySessionOpen !== null ? todaySessionOpen + 86400 : null;
  const secondsRemaining = useSessionCountdown(nextSessionOpen);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
        <span className="uppercase tracking-tight">
          {t('currency_index_pro.header.reset_in', 'Reset in')}
        </span>
        <span className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-sm tabular-nums text-foreground">
          {secondsRemaining === null
            ? '--:--:--'
            : formatCountdown(secondsRemaining)}
        </span>
      </div>

      <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
        {(['M5', 'M15'] as const).map((tf) => (
          <button
            key={tf}
            type="button"
            onClick={() => onTimeframeChange(tf)}
            aria-pressed={timeframe === tf}
            className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
              timeframe === tf
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {spreadDelta && (
        <span
          className={`rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-tight ${SPREAD_BADGE_CLASS[spreadDelta.status]}`}
          title={`${spreadDelta.leader.currency} +${spreadDelta.leader.changePct.toFixed(2)}% vs ${spreadDelta.laggard.currency} ${spreadDelta.laggard.changePct.toFixed(2)}%`}
        >
          {spreadDelta.status === 'EXTREME' && '🔥 '}
          {t(
            SPREAD_BADGE_LABEL_KEY[spreadDelta.status].key,
            SPREAD_BADGE_LABEL_KEY[spreadDelta.status].label
          )}
          : {spreadDelta.spreadPct.toFixed(2)}%
        </span>
      )}
    </div>
  );
}
