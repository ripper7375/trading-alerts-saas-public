import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface LeaderboardRow {
  rank: number;
  anonymizedPartnerId: string;
  country: string;
  countryIso: string;
  saasTier: 'FREE' | 'PRO';
  activeCode: string;
  codesUsed: number;
  subscribersReferred: number;
  grossSalesUsd: number;
  commissionEarnedUsd: number;
  payoutStatus: 'APPROVED' | 'PAID' | 'PENDING';
}

export interface TopAffiliatesLeaderboardProps {
  rows: LeaderboardRow[];
}

const PAYOUT_BADGE_CLASS: Record<LeaderboardRow['payoutStatus'], string> = {
  PAID: 'bg-success/15 text-success hover:bg-success/15',
  APPROVED: 'bg-info/15 text-info hover:bg-info/15',
  PENDING: 'bg-warning/15 text-warning hover:bg-warning/15',
};

/**
 * Metric #25: privacy-preserving Top 20 affiliates leaderboard. The
 * `LeaderboardRow` type carries no name/email/contact field at all --
 * PII redaction is enforced at compile time by the API response shape,
 * not just hidden here in the UI.
 */
export function TopAffiliatesLeaderboard({
  rows,
}: TopAffiliatesLeaderboardProps): React.ReactElement {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/50 font-mono text-muted-foreground">
          <tr>
            <th className="px-3 py-2.5 text-center">Rank</th>
            <th className="px-3 py-2.5">Masked Partner ID</th>
            <th className="px-3 py-2.5">Country</th>
            <th className="px-3 py-2.5 text-center">Tier</th>
            <th className="px-3 py-2.5">Referral Code</th>
            <th className="px-3 py-2.5 text-right">Codes Used</th>
            <th className="px-3 py-2.5 text-right">Subscribers</th>
            <th className="px-3 py-2.5 text-right">Gross Sales</th>
            <th className="px-3 py-2.5 text-right text-success">Commission</th>
            <th className="px-3 py-2.5 text-center">Payout</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border font-mono">
          {rows.map((row) => (
            <tr
              key={row.anonymizedPartnerId}
              className={cn(
                'hover:bg-accent/40',
                row.rank === 1 && 'bg-warning/10'
              )}
            >
              <td
                className={cn(
                  'px-3 py-2 text-center font-bold',
                  row.rank === 1 ? 'text-warning' : 'text-muted-foreground'
                )}
              >
                {row.rank}
              </td>
              <td className="px-3 py-2 font-bold text-foreground">
                {row.anonymizedPartnerId}
              </td>
              <td className="px-3 py-2 font-sans">
                {row.country}{' '}
                <span className="text-muted-foreground">
                  ({row.countryIso})
                </span>
              </td>
              <td className="px-3 py-2 text-center">
                <Badge
                  className={cn(
                    'text-[10px]',
                    row.saasTier === 'PRO'
                      ? 'bg-primary/15 hover:bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground hover:bg-muted'
                  )}
                >
                  {row.saasTier}
                </Badge>
              </td>
              <td className="px-3 py-2 font-bold text-info">
                {row.activeCode}
              </td>
              <td className="px-3 py-2 text-right">{row.codesUsed}</td>
              <td className="px-3 py-2 text-right">
                {row.subscribersReferred}
              </td>
              <td className="px-3 py-2 text-right font-semibold">
                ${row.grossSalesUsd.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right font-black text-success">
                ${row.commissionEarnedUsd.toFixed(2)}
              </td>
              <td className="px-3 py-2 text-center">
                <Badge
                  className={cn(
                    'text-[10px]',
                    PAYOUT_BADGE_CLASS[row.payoutStatus]
                  )}
                >
                  {row.payoutStatus}
                </Badge>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={10}
                className="px-3 py-8 text-center font-sans text-muted-foreground"
              >
                No affiliate earnings recorded for this period yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
