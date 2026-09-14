'use client';

/**
 * CurrencyLegendStrip — 8 currency chips beneath the chart.
 *
 * Each chip has two targets:
 * - the eye button shows or hides that currency's line on the chart, so a
 *   viewer can cut the 8 lines down to the ones they are comparing;
 * - the rest of the chip opens the HRMA/SMMA detail modal, which is Phase 3's
 *   own trigger for it (the analysis-table rows open the same modal through
 *   the same `onSelectCurrency` callback shape).
 *
 * A hidden chip stays in place, dashed and dimmed with its code struck
 * through (the same hidden styling as the comparison PRO page's toggles), and
 * keeps showing its latest value, so the reading is still available with the
 * line off the chart. The toggle is a separate button rather than the whole
 * chip so the detail modal keeps its existing entry point.
 *
 * @module components/currency-index-pro/chart/currency-legend-strip
 */

import { Eye, EyeOff } from 'lucide-react';

import {
  ALL_CURRENCIES,
  indexNameForCurrency,
  type CurrencyCode,
} from '@/lib/currency-index-pro/pairs';
import { currencyColor } from '@/lib/currency-index-pro/colors';
import { useChartAppearance } from '@/components/providers/appearance-provider';
import { useLocale } from '@/lib/context/locale-context';

import type { CurrencyIndexChartData } from '../hooks/use-currency-index-chart';

interface CurrencyLegendStripProps {
  data: CurrencyIndexChartData | null;
  onSelectCurrency: (currency: CurrencyCode) => void;
  hiddenCurrencies: ReadonlySet<CurrencyCode>;
  onToggleCurrency: (currency: CurrencyCode) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

export function CurrencyLegendStrip({
  data,
  onSelectCurrency,
  hiddenCurrencies,
  onToggleCurrency,
  onShowAll,
  onHideAll,
}: CurrencyLegendStripProps): React.JSX.Element {
  const { resolvedTheme } = useChartAppearance();
  const { t } = useLocale();

  const hiddenCount = ALL_CURRENCIES.filter((c) =>
    hiddenCurrencies.has(c)
  ).length;

  return (
    <div
      role="group"
      aria-label={t('Currency lines')}
      className="flex flex-wrap items-center gap-2"
    >
      {ALL_CURRENCIES.map((currency) => {
        const points = data?.series[indexNameForCurrency(currency)] ?? [];
        const latest = points[points.length - 1];
        const changePct = latest?.changePct ?? null;
        const visible = !hiddenCurrencies.has(currency);
        const color = currencyColor(currency, resolvedTheme);

        return (
          <div
            key={currency}
            className={`flex items-stretch overflow-hidden rounded-md border bg-card text-xs font-medium transition-colors ${
              visible ? 'border-border' : 'border-dashed border-border'
            }`}
          >
            <button
              type="button"
              aria-pressed={visible}
              aria-label={t('{currency} line').replace('{currency}', currency)}
              title={(visible
                ? t('Hide {currency} line')
                : t('Show {currency} line')
              ).replace('{currency}', currency)}
              onClick={() => onToggleCurrency(currency)}
              className="flex items-center border-r border-border px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {visible ? (
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onSelectCurrency(currency)}
              title={t('View {currency} HRMA/SMMA detail').replace(
                '{currency}',
                currency
              )}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 transition-colors hover:bg-accent ${
                visible ? '' : 'opacity-60'
              }`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border-2"
                // A hollow dot for a hidden line: identity stays readable
                // without implying the line is on the chart.
                style={{
                  borderColor: color,
                  backgroundColor: visible ? color : 'transparent',
                }}
                aria-hidden="true"
              />
              <span className={visible ? '' : 'line-through'}>{currency}</span>
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
          </div>
        );
      })}

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onShowAll}
          disabled={hiddenCount === 0}
          className="rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          {t('Show all')}
        </button>
        <button
          type="button"
          onClick={onHideAll}
          disabled={hiddenCount === ALL_CURRENCIES.length}
          className="rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          {t('Hide all')}
        </button>
      </div>
    </div>
  );
}
