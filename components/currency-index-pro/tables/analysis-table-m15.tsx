'use client';

/**
 * AnalysisTableM15 — the M15 Stage A/B analysis table (spec Requirement 6).
 *
 * Each currency's own label is clickable and opens the SAME
 * `HrmaSmmaDetailModal` the chart's `CurrencyLegendStrip` already opens
 * (via the shared `onSelectCurrency` callback) -- a second, independent
 * entry point into the one modal, not a second modal.
 *
 * @module components/currency-index-pro/tables/analysis-table-m15
 */

import { Badge } from '@/components/ui/badge';
import type { AnalysisRowM15 } from '../hooks/use-currency-index-screener';
import type { CurrencyCode } from '@/lib/currency-index-pro/pairs';

interface AnalysisTableM15Props {
  rows: AnalysisRowM15[];
  onSelectCurrency: (currency: CurrencyCode) => void;
}

const ZONE_BADGE_CLASS: Record<string, string> = {
  OVERBOUGHT:
    'border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-300',
  OVERSOLD:
    'border-blue-500/60 bg-blue-500/15 text-blue-700 dark:text-blue-300',
  NEUTRAL: 'border-border bg-muted text-muted-foreground',
};

const CROSSOVER_LABEL: Record<string, string> = {
  CONFIRMED_BUY: 'Bullish Reversal',
  CONFIRMED_SELL: 'Bearish Reversal',
  NONE: '—',
};

export function AnalysisTableM15({
  rows,
  onSelectCurrency,
}: AnalysisTableM15Props): React.JSX.Element | null {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/40 border-b border-border text-xs uppercase tracking-tight text-muted-foreground">
            <th className="px-3 py-2 text-left font-semibold">Currency</th>
            <th className="px-3 py-2 text-left font-semibold">Status</th>
            <th className="px-3 py-2 text-right font-semibold">HRMA</th>
            <th className="px-3 py-2 text-right font-semibold">SMMA</th>
            <th className="px-3 py-2 text-left font-semibold">
              HRMA × SMMA Cross
            </th>
            <th className="px-3 py-2 text-left font-semibold">Target Pairs</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.currency}
              className="border-b border-border last:border-0"
            >
              <td className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => onSelectCurrency(row.currency as CurrencyCode)}
                  className="font-semibold text-primary underline-offset-2 hover:underline"
                >
                  {row.currency}
                </button>
              </td>
              <td className="px-3 py-2">
                <Badge
                  variant="outline"
                  className={
                    ZONE_BADGE_CLASS[row.zone] ?? ZONE_BADGE_CLASS['NEUTRAL']
                  }
                >
                  {row.zone}
                </Badge>
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                {row.hrma !== null ? row.hrma.toFixed(3) : '—'}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                {row.smma !== null ? row.smma.toFixed(3) : '—'}
              </td>
              <td className="px-3 py-2">
                {row.crossoverState !== 'NONE' ? (
                  <span
                    className={
                      row.crossoverState === 'CONFIRMED_BUY'
                        ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                        : 'font-semibold text-red-600 dark:text-red-400'
                    }
                  >
                    {CROSSOVER_LABEL[row.crossoverState]}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {CROSSOVER_LABEL['NONE']}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-xs">
                {row.recommendedActions.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <span className="space-x-1">
                    {row.recommendedActions.map((a) => (
                      <span
                        key={a.pair}
                        className={
                          a.action === 'BUY'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }
                      >
                        {a.action} {a.pair}
                      </span>
                    ))}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
