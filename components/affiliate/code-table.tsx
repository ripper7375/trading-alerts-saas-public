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
  ACTIVE:
    'bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30',
  USED: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30',
  EXPIRED: 'bg-muted text-muted-foreground border border-border',
  CANCELLED:
    'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30',
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
export function CodeTable({
  codes,
  className,
}: CodeTableProps): React.ReactElement {
  if (codes.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No codes available
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
              Status
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Distributed
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Expires
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Used
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {codes.map((code) => (
            <tr key={code.id}>
              <td className="whitespace-nowrap px-6 py-4 font-mono text-sm text-foreground">
                {code.code}
              </td>
              <td className="whitespace-nowrap px-6 py-4">
                <span
                  className={cn(
                    'rounded px-2 py-1 text-xs font-medium',
                    statusStyles[code.status]
                  )}
                >
                  {code.status}
                </span>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                {format(new Date(code.distributedAt), 'MMM d, yyyy')}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                {format(new Date(code.expiresAt), 'MMM d, yyyy')}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
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
