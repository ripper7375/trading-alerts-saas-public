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
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
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
      <div className="py-8 text-center text-gray-500">No commissions yet</div>
    );
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Code
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Amount
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Status
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Earned
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Paid
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {commissions.map((commission) => (
            <tr key={commission.id}>
              <td className="whitespace-nowrap px-6 py-4 font-mono text-sm">
                {commission.affiliateCode.code}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold">
                ${Number(commission.commissionAmount).toFixed(2)}
              </td>
              <td className="whitespace-nowrap px-6 py-4">
                <span
                  className={cn(
                    'rounded px-2 py-1 text-xs font-medium',
                    statusStyles[commission.status]
                  )}
                >
                  {commission.status}
                </span>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                {format(new Date(commission.earnedAt), 'MMM d, yyyy')}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                {commission.paidAt
                  ? format(new Date(commission.paidAt), 'MMM d, yyyy')
                  : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default CommissionTable;
