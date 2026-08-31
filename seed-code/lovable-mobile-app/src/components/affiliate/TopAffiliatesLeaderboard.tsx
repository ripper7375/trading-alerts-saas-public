/**
 * Top Affiliates Leaderboard (mobile reference)
 *
 * Mobile card-list version of the monolith's
 * components/admin/analytics/top-affiliates-leaderboard.tsx, reused by the
 * public marketing leaderboard (business-intelligence-dashboard manifest
 * §1.6). Carries no name/email/contact field -- PII redaction is a
 * property of the row shape itself, not just hidden here in the UI.
 */

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface LeaderboardRow {
  rank: number;
  anonymizedPartnerId: string;
  country: string;
  countryIso: string;
  saasTier: 'FREE' | 'PRO';
  activeCode: string;
  subscribersReferred: number;
  grossSalesUsd: number;
  commissionEarnedUsd: number;
  payoutStatus: 'APPROVED' | 'PAID' | 'PENDING';
}

const PAYOUT_BADGE_CLASS: Record<LeaderboardRow['payoutStatus'], string> = {
  PAID: 'bg-green-500/15 text-green-700 dark:text-green-400',
  APPROVED: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  PENDING: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
};

export function TopAffiliatesLeaderboard({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No affiliate earnings recorded for this period yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <Card
          key={row.anonymizedPartnerId}
          className={cn(row.rank === 1 && 'border-amber-500/40 bg-amber-500/5')}
        >
          <CardContent className="space-y-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    row.rank === 1
                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {row.rank}
                </span>
                <div>
                  <p className="font-mono text-sm font-bold">
                    {row.anonymizedPartnerId}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.country} ({row.countryIso})
                  </p>
                </div>
              </div>
              <Badge
                className={cn(
                  'text-[10px]',
                  row.saasTier === 'PRO'
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {row.saasTier}
              </Badge>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-blue-600 dark:text-blue-400">
                {row.activeCode}
              </span>
              <span className="text-muted-foreground">
                {row.subscribersReferred} subscribers
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-2">
              <div>
                <p className="text-[11px] text-muted-foreground">Gross sales</p>
                <p className="text-sm font-semibold">
                  ${row.grossSalesUsd.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">Commission</p>
                <p className="text-sm font-black text-green-600 dark:text-green-400">
                  ${row.commissionEarnedUsd.toFixed(2)}
                </p>
              </div>
              <Badge
                className={cn(
                  'text-[10px]',
                  PAYOUT_BADGE_CLASS[row.payoutStatus]
                )}
              >
                {row.payoutStatus}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
