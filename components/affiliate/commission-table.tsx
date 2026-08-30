/**
 * CommissionTable Component
 *
 * Displays affiliate commissions in a table format with status badges and amounts.
 * Used in the affiliate dashboard to show earnings history.
 *
 * @module components/affiliate/commission-table
 */

import React from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE DEFINITIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type CommissionStatus = 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED';

interface Commission {
  id: string;
  /** Real Prisma field is `commissionAmount` (Decimal — arrives as a string
   *  over JSON); accept both so callers passing an already-numeric value
   *  (e.g. tests) keep working. */
  commissionAmount: string | number;
  status: CommissionStatus;
  earnedAt: Date;
  paidAt?: Date | null;
  affiliateCode: {
    code: string;
  };
  /**
   * davintrade-vat-stack follow-up: set only on a clawback deduction row --
   * created when a refund/dispute arrives for a customer whose commission
   * was already PAID, netted against the affiliate's next payout instead
   * of clawing back a disbursement that already happened.
   */
  clawbackOfCommissionId?: string | null;
}

interface CommissionTableProps {
  /** Array of commissions to display */
  commissions: Commission[];
  /** Additional CSS classes */
  className?: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATUS BADGE STYLES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const statusStyles: Record<CommissionStatus, string> = {
  PENDING:
    'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30',
  APPROVED:
    'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30',
  PAID: 'bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30',
  CANCELLED:
    'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30',
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * CommissionTable component displays affiliate commissions in a table format
 *
 * @example
 * ```tsx
 * <CommissionTable commissions={commissionData} />
 * ```
 */
export function CommissionTable({
  commissions,
  className,
}: CommissionTableProps): React.ReactElement {
  if (commissions.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No commissions yet
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted/40">
          <tr>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Code
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Amount
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Status
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Earned
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Paid
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {commissions.map((commission) => {
            const isClawback = Boolean(commission.clawbackOfCommissionId);
            const amount = Number(commission.commissionAmount);

            return (
              <tr key={commission.id}>
                <td className="whitespace-nowrap px-6 py-4 font-mono text-sm text-foreground">
                  {commission.affiliateCode.code}
                </td>
                <td
                  className={cn(
                    'whitespace-nowrap px-6 py-4 text-sm font-semibold',
                    isClawback
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-foreground'
                  )}
                >
                  {`${isClawback && amount < 0 ? '-' : ''}$${Math.abs(amount).toFixed(2)}`}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        'rounded px-2 py-1 text-xs font-medium',
                        statusStyles[commission.status]
                      )}
                    >
                      {commission.status}
                    </span>
                    {isClawback && (
                      <span
                        title="Deducted for a refund/dispute on a commission already paid out; nets against your next payout."
                        className="rounded border border-red-500/30 bg-red-500/15 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400"
                      >
                        Clawback
                      </span>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                  {format(new Date(commission.earnedAt), 'MMM d, yyyy')}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                  {commission.paidAt
                    ? format(new Date(commission.paidAt), 'MMM d, yyyy')
                    : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default CommissionTable;
