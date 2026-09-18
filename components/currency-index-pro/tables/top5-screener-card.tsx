'use client';

/**
 * Top5ScreenerCard — ranked Top-5 pairs from the 28-pair confluence
 * screener (spec Requirement 9), with a "View Chart" quick action per row.
 *
 * @module components/currency-index-pro/tables/top5-screener-card
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/lib/context/locale-context';
import type { TopTrade } from '../hooks/use-currency-index-screener';

interface Top5ScreenerCardProps {
  trades: TopTrade[];
  onViewChart: (pair: string) => void;
}

const CONFLUENCE_LABEL_KEY: Record<string, { key: string; label: string }> = {
  DOUBLE_CONFLUENCE: {
    key: 'currency_index_pro.confluence.double',
    label: 'Double Confirmed',
  },
  SINGLE_CONFIRMED: {
    key: 'currency_index_pro.confluence.single_confirmed',
    label: 'Stage B Confirmed',
  },
  SINGLE_CONFLUENCE: {
    key: 'currency_index_pro.confluence.single_zone',
    label: 'Stage A Zone',
  },
  BASELINE_DIVERGENCE: {
    key: 'currency_index_pro.confluence.baseline',
    label: 'Baseline',
  },
};

const CONFLUENCE_BADGE_CLASS: Record<string, string> = {
  DOUBLE_CONFLUENCE:
    'border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  SINGLE_CONFIRMED:
    'border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-300',
  SINGLE_CONFLUENCE: 'border-border bg-muted text-muted-foreground',
  BASELINE_DIVERGENCE: 'border-border bg-muted text-muted-foreground',
};

function actionColor(action: string): string {
  if (action.includes('BUY')) return 'text-emerald-600 dark:text-emerald-400';
  if (action.includes('SELL')) return 'text-red-600 dark:text-red-400';
  return 'text-muted-foreground';
}

export function Top5ScreenerCard({
  trades,
  onViewChart,
}: Top5ScreenerCardProps): React.JSX.Element | null {
  const { t } = useLocale();
  if (trades.length === 0) return null;

  return (
    <div className="space-y-1 rounded-lg border border-border bg-card p-3">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-tight text-muted-foreground">
        🏆{' '}
        {t('currency_index_pro.top5.title', 'Top 5 Highest Potential Trades')}
      </h2>
      {trades.map((trade) => (
        <div
          key={trade.pair}
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
        >
          <div className="flex items-center gap-2">
            <span className="w-5 text-xs font-bold text-muted-foreground">
              #{trade.rank}
            </span>
            <span className="font-semibold">{trade.pair}</span>
            <span className={`text-sm font-bold ${actionColor(trade.action)}`}>
              {trade.action}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {t('currency_index_pro.top5.spread', 'Spread')}:{' '}
              {trade.divergenceSpread.toFixed(2)}%
            </span>
            <Badge
              variant="outline"
              className={CONFLUENCE_BADGE_CLASS[trade.confluenceLevel]}
            >
              {(() => {
                const cfg = CONFLUENCE_LABEL_KEY[trade.confluenceLevel];
                return cfg ? t(cfg.key, cfg.label) : trade.confluenceLevel;
              })()}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onViewChart(trade.pair)}
            >
              🔍 {t('currency_index_pro.top5.view_chart', 'View Chart')}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
