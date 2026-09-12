'use client';

/**
 * DashboardTableM5 — the fast M5 dashboard table (spec Requirement 5).
 *
 * A plain semantic `<table>` -- no shared `Table` UI primitive exists in
 * this repo (confirmed via search), so this mirrors the app's existing
 * border/muted-foreground Tailwind conventions directly rather than
 * inventing a new one-off shared component for a single consumer.
 *
 * @module components/currency-index-pro/tables/dashboard-table-m5
 */

import type { DashboardRowM5 } from '../hooks/use-currency-index-screener';

interface DashboardTableM5Props {
  rows: DashboardRowM5[];
}

function signColor(value: number): string {
  if (value > 0) return 'text-emerald-600 dark:text-emerald-400';
  if (value < 0) return 'text-red-600 dark:text-red-400';
  return 'text-muted-foreground';
}

export function DashboardTableM5({
  rows,
}: DashboardTableM5Props): React.JSX.Element | null {
  // Absent is the honest rendering of "Lane 4 hasn't pushed today's data
  // yet" -- same rule this app's own containment-rate-strip.tsx follows,
  // rather than a placeholder/broken-looking table.
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/40 border-b border-border text-xs uppercase tracking-tight text-muted-foreground">
            <th className="px-3 py-2 text-left font-semibold">Currency</th>
            <th className="px-3 py-2 text-right font-semibold">Price</th>
            <th className="px-3 py-2 text-right font-semibold">Change %</th>
            <th className="px-3 py-2 text-right font-semibold">High %</th>
            <th className="px-3 py-2 text-right font-semibold">Low %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.currency}
              className="border-b border-border last:border-0"
            >
              <td className="px-3 py-2 font-medium">{row.currency}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                {row.price.toFixed(2)}
              </td>
              <td
                className={`px-3 py-2 text-right font-mono tabular-nums ${signColor(row.changePct)}`}
              >
                {row.changePct >= 0 ? '+' : ''}
                {row.changePct.toFixed(2)}%
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                +{row.highPct.toFixed(2)}%
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-red-600 dark:text-red-400">
                {row.lowPct.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
