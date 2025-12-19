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
  amount: number;
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
      <div className="text-center py-8 text-gray-500">
        No commissions yet
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Code
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Amount
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Status
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Earned
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Paid
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {commissions.map((commission) => (
            <tr key={commission.id}>
              <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">
                {commission.affiliateCode.code}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                ${commission.amount.toFixed(2)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={cn(
                    'px-2 py-1 text-xs font-medium rounded',
                    statusStyles[commission.status]
                  )}
                >
                  {commission.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {format(new Date(commission.earnedAt), 'MMM d, yyyy')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
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
