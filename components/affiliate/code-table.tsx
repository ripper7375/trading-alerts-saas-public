/**
 * CodeTable Component
 *
 * Displays affiliate codes in a table format with status badges and dates.
 * Used in the affiliate dashboard to show code inventory.
 *
 * @module components/affiliate/code-table
 */

import React from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE DEFINITIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type CodeStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';

interface AffiliateCode {
  id: string;
  code: string;
  status: CodeStatus;
  distributedAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
}

interface CodeTableProps {
  /** Array of affiliate codes to display */
  codes: AffiliateCode[];
  /** Additional CSS classes */
  className?: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATUS BADGE STYLES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const statusStyles: Record<CodeStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  USED: 'bg-blue-100 text-blue-800',
  EXPIRED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * CodeTable component displays affiliate codes in a table format
 *
 * @example
 * ```tsx
 * <CodeTable codes={affiliateCodes} />
 * ```
 */
export function CodeTable({ codes, className }: CodeTableProps): React.ReactElement {
  if (codes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No codes available
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
              Status
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Distributed
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Expires
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Used
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {codes.map((code) => (
            <tr key={code.id}>
              <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">
                {code.code}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={cn(
                    'px-2 py-1 text-xs font-medium rounded',
                    statusStyles[code.status]
                  )}
                >
                  {code.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {format(new Date(code.distributedAt), 'MMM d, yyyy')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {format(new Date(code.expiresAt), 'MMM d, yyyy')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {code.usedAt
                  ? format(new Date(code.usedAt), 'MMM d, yyyy')
                  : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default CodeTable;
