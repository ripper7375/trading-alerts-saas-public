/**
 * Commission Table (mobile reference)
 *
 * Mobile card-list version of the monolith's
 * components/affiliate/commission-table.tsx -- a clawback row (created
 * when a refund/dispute arrives for a commission that was already PAID,
 * see the affiliate-commission-issues-fix manifest) renders its amount in
 * red with a leading "-" plus a red "Clawback" badge next to the normal
 * status badge.
 */

import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type CommissionStatus = 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED';

export interface Commission {
  id: string;
  commissionAmount: string | number;
  status: CommissionStatus;
  earnedAt: Date;
  paidAt?: Date | null;
  affiliateCode: { code: string };
  /** Set only on a clawback deduction row -- nets against the next payout
   *  rather than clawing back a disbursement that already happened. */
  clawbackOfCommissionId?: string | null;
}

const statusStyles: Record<CommissionStatus, string> = {
  PENDING:
    'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30',
  APPROVED:
    'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30',
  PAID: 'bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30',
  CANCELLED:
    'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30',
};

export function CommissionTable({
  commissions,
}: {
  commissions: Commission[];
}) {
  if (commissions.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No commissions yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {commissions.map((commission) => {
        const isClawback = Boolean(commission.clawbackOfCommissionId);
        const amount = Number(commission.commissionAmount);

        return (
          <Card key={commission.id}>
            <CardContent className="space-y-1.5 p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {commission.affiliateCode.code}
                </span>
                <span
                  className={cn(
                    'text-sm font-semibold',
                    isClawback
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-foreground'
                  )}
                >
                  {isClawback && amount < 0 ? '-' : ''}$
                  {Math.abs(amount).toFixed(2)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    'rounded px-2 py-0.5 text-[11px] font-medium',
                    statusStyles[commission.status]
                  )}
                >
                  {commission.status}
                </span>
                {isClawback && (
                  <span
                    title="Deducted for a refund/dispute on a commission already paid out; nets against your next payout."
                    className="rounded border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:text-red-400"
                  >
                    Clawback
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  Earned {format(new Date(commission.earnedAt), 'MMM d, yyyy')}
                </span>
                <span>
                  {commission.paidAt
                    ? `Paid ${format(new Date(commission.paidAt), 'MMM d, yyyy')}`
                    : 'Not paid yet'}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default CommissionTable;
