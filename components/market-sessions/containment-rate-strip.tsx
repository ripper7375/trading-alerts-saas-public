'use client';

import { useLocale } from '@/lib/context/locale-context';

import { useContainmentRates } from './useContainmentRates';

/**
 * Containment Rate strip -- the one EDT Quality Metrics figure shipped so
 * far: "price stayed inside this channel N% of the time", read directly
 * from `indicator_statistics.containment_rate`.
 *
 * Deliberately not a composite "quality score" -- see
 * lib/indicator-statistics/queries.ts's header for why R², Bar Coverage and
 * Baseline Symmetry are withheld until their formula problems are settled.
 *
 * Renders nothing at all when there is nothing to show (no rows yet, the
 * lane not deployed, or FREE tier) -- same "an absent row is the honest
 * rendering of we do not know" rule SessionStatusBanner's news row already
 * follows, rather than a placeholder or an error state.
 */
export function ContainmentRateStrip() {
  const { t } = useLocale();
  const rates = useContainmentRates().filter((r) => r.containmentRate !== null);

  if (rates.length === 0) return null;

  return (
    <div className="mt-2 px-3">
      <div className="bg-muted/60 rounded-xl border border-border p-3">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
          {t('EDT Channel Containment')}
        </div>
        <div className="max-h-32 space-y-1 overflow-y-auto">
          {rates.map((r) => (
            <div
              key={`${r.symbol}-${r.timeframe}-${r.source}`}
              className="flex items-center justify-between gap-2"
            >
              <span className="truncate text-[11px] font-semibold capitalize text-foreground">
                {r.timeframe} · {r.source.replace(/_/g, ' ')}
              </span>
              <span className="shrink-0 font-mono text-[11px] font-bold text-muted-foreground">
                {Math.round(r.containmentRate as number)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
