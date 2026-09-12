'use client';

/**
 * CurrencyLegendStrip — 8 clickable currency chips beneath the chart.
 *
 * This is Phase 3's own trigger for the HRMA/SMMA detail modal (Davin's
 * ask this session) -- Phase 4's analysis-table rows will later open the
 * same modal from their own click handlers, reusing this component's
 * `onSelectCurrency` callback shape rather than a second entry point.
 *
 * @module components/currency-index-pro/chart/currency-legend-strip
 */

import {
  ALL_CURRENCIES,
  indexNameForCurrency,
  type CurrencyCode,
} from '@/lib/currency-index-pro/pairs';
import { currencyColor } from '@/lib/currency-index-pro/colors';
import { useChartAppearance } from '@/components/providers/appearance-provider';

import type { CurrencyIndexChartData } from '../hooks/use-currency-index-chart';

interface CurrencyLegendStripProps {
  data: CurrencyIndexChartData | null;
  onSelectCurrency: (currency: CurrencyCode) => void;
}

export function CurrencyLegendStrip({
  data,
  onSelectCurrency,
}: CurrencyLegendStripProps): React.JSX.Element {
  const { resolvedTheme } = useChartAppearance();

  return (
    <div className="flex flex-wrap gap-2">
      {ALL_CURRENCIES.map((currency) => {
        const points = data?.series[indexNameForCurrency(currency)] ?? [];
        const latest = points[points.length - 1];
        const changePct = latest?.changePct ?? null;

        return (
          <button
            key={currency}
            type="button"
            onClick={() => onSelectCurrency(currency)}
            title={`View ${currency} HRMA/SMMA detail`}
            className="hover:border-primary/50 flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{
                backgroundColor: currencyColor(currency, resolvedTheme),
              }}
              aria-hidden="true"
            />
            <span>{currency}</span>
            <span
              className={`font-mono tabular-nums ${
                changePct === null
                  ? 'text-muted-foreground'
                  : changePct > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : changePct < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-muted-foreground'
              }`}
            >
              {changePct === null
                ? '--'
                : `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
