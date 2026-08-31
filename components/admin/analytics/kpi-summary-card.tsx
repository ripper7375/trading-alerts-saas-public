import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface KpiSummaryCardProps {
  label: string;
  metricBadge?: string;
  value: string;
  /** null renders a neutral "New" badge instead of a misleading +0.0%. */
  deltaPct: number | null;
  deltaLabel?: string;
  comparisonSubtext?: string;
  /** Optional trailing values for the mini bar-sparkline (oldest first). */
  sparkline?: number[];
  accentClassName?: string;
}

/**
 * Standard BI dashboard metric card: label + metric-number badge, big
 * value, color-coded delta pill, comparison subtext, and an optional mini
 * bar-sparkline. Mirrors the prototype's `.glass-panel` KPI card layout
 * using theme-aware design tokens instead of raw slate/emerald/amber hex.
 */
export function KpiSummaryCard({
  label,
  metricBadge,
  value,
  deltaPct,
  deltaLabel,
  comparisonSubtext,
  sparkline,
  accentClassName,
}: KpiSummaryCardProps): React.ReactElement {
  const isPositive = deltaPct !== null && deltaPct >= 0;
  const isNegative = deltaPct !== null && deltaPct < 0;

  return (
    <Card className="border-border bg-card">
      <CardContent className="px-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          {metricBadge && (
            <span className="whitespace-nowrap rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">
              {metricBadge}
            </span>
          )}
        </div>

        <div
          className={cn(
            'mt-1.5 font-mono text-3xl font-black tracking-tight text-foreground',
            accentClassName
          )}
        >
          {value}
        </div>

        {(deltaPct !== null || comparisonSubtext) && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium">
            {deltaPct === null ? (
              <span className="rounded-full bg-muted px-2 py-0.5 font-bold text-muted-foreground">
                New
              </span>
            ) : (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 font-bold',
                  isPositive && 'bg-success/15 text-success',
                  isNegative && 'bg-destructive/15 text-destructive'
                )}
              >
                {isPositive ? '▲' : '▼'} {isPositive ? '+' : ''}
                {deltaPct.toFixed(2)}% {deltaLabel}
              </span>
            )}
            {comparisonSubtext && (
              <span className="text-muted-foreground">{comparisonSubtext}</span>
            )}
          </div>
        )}

        {sparkline && sparkline.length > 1 && (
          <div className="mt-3 flex h-6 items-end gap-1 pt-1">
            {sparkline.map((v, i) => {
              const max = Math.max(...sparkline, 1);
              const heightPct = Math.max((v / max) * 100, 8);
              const isLast = i === sparkline.length - 1;
              return (
                <div
                  key={i}
                  className={cn(
                    'flex-1 rounded-t',
                    isLast ? 'bg-primary' : 'bg-primary/30'
                  )}
                  style={{ height: `${heightPct}%` }}
                />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
