'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';

import { useLocale } from '@/lib/context/locale-context';
import { CURRENCY_GOLD_INDEX_METADATA } from '@/lib/currency-gold-indices/metadata';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { FloatingSparkline } from './floating-sparkline';
import { useCurrencyGoldIndices } from './useCurrencyGoldIndices';

/**
 * Hero Section Widget: the G8 Currency & Gold Index Suite (Lane 4).
 *
 * Public, unauthenticated -- this is the marketing/conversion asset the
 * architecture doc's section 1.1 describes, not a PRO feature. Renders
 * nothing at all when there is nothing to show yet (Lane 4 not deployed, no
 * push has landed, or a genuine fetch failure) -- the same "an absent row is
 * the honest rendering of we do not know" rule
 * components/market-sessions/containment-rate-strip.tsx already follows,
 * rather than a placeholder or an error state on the public landing page.
 *
 * 4 rows visible, scrollable for the remaining 5 of 9 -- architecture doc
 * section 7.1's display constraint.
 *
 * @module components/market/currency-index-hero-widget
 */
export function CurrencyIndexHeroWidget() {
  const { t } = useLocale();
  const { indices, isLoading } = useCurrencyGoldIndices();

  if (!isLoading && indices.length === 0) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white/70 shadow-sm dark:border-slate-800/80 dark:bg-[#0c101a]/70">
        <div className="h-[240px] divide-y divide-slate-200 overflow-y-auto dark:divide-slate-800">
          {isLoading && indices.length === 0
            ? Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="bg-muted/40 h-8 w-16 animate-pulse rounded" />
                  <div className="bg-muted/40 h-6 w-16 flex-1 animate-pulse rounded" />
                  <div className="bg-muted/40 h-8 w-14 animate-pulse rounded" />
                </div>
              ))
            : indices.map((idx) => {
                const meta = CURRENCY_GOLD_INDEX_METADATA[idx.symbol];
                const isGain = idx.changePct >= 0;
                const changeColor = isGain
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400';
                const badgeColor = isGain
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400';

                return (
                  <Tooltip key={idx.symbol}>
                    <TooltipTrigger asChild>
                      <div className="flex cursor-default items-center gap-3 px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/40">
                        <div className="w-16 shrink-0">
                          <div className="text-sm font-bold leading-tight text-foreground">
                            {idx.symbol}
                          </div>
                          <div className="truncate text-[10px] font-medium text-muted-foreground">
                            {meta ? t(meta.name) : idx.symbol}
                          </div>
                        </div>

                        <div className="flex flex-1 justify-center">
                          <FloatingSparkline
                            data={idx.sparkline}
                            previousClose={idx.previousClose}
                          />
                        </div>

                        <div className="shrink-0 text-right">
                          {/* An index level (rebased to ~100), not money -- no
                              currency symbol, deliberately not run through
                              formatCurrency(). */}
                          <div className="font-mono text-sm font-bold text-foreground">
                            {idx.price.toFixed(2)}
                          </div>
                          <div
                            className={`flex items-center justify-end gap-0.5 text-[11px] font-semibold ${changeColor}`}
                          >
                            <span>
                              {isGain ? '+' : ''}
                              {idx.changePct.toFixed(2)}%
                            </span>
                            <span
                              className={`flex h-3.5 w-3.5 items-center justify-center rounded-full ${badgeColor}`}
                            >
                              {isGain ? (
                                <ArrowUp className="h-2.5 w-2.5" />
                              ) : (
                                <ArrowDown className="h-2.5 w-2.5" />
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </TooltipTrigger>
                    {meta && (
                      <TooltipContent side="top" align="start">
                        <p className="font-semibold text-foreground">
                          {t(meta.name)}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {t(meta.definition)}
                        </p>
                        <p className="mt-1.5 italic text-muted-foreground">
                          {t(meta.tradingEdge)}
                        </p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
        </div>
      </div>
    </TooltipProvider>
  );
}
