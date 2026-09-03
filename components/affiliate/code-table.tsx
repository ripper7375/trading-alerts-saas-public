/**
 * CodeTable Component
 *
 * Displays affiliate codes in a table format with status badges and dates.
 * Used in the affiliate dashboard to show code inventory.
 *
 * @module components/affiliate/code-table
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/context/locale-context';

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
const statusLabelKeys: Record<CodeStatus, string> = {
  ACTIVE: 'affiliate.codes.status_active',
  USED: 'affiliate.codes.status_used',
  EXPIRED: 'affiliate.codes.status_expired',
  CANCELLED: 'affiliate.codes.status_cancelled',
};

export function CodeTable({
  codes,
  className,
}: CodeTableProps): React.ReactElement {
  const { t, formatDate } = useLocale();

  if (codes.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        {t('affiliate.codes.no_codes_available', 'No codes available')}
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
              {t('affiliate.codes.code', 'Code')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {t('affiliate.codes.status', 'Status')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {t('affiliate.codes.distributed', 'Distributed')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {t('affiliate.codes.expires', 'Expires')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {t('affiliate.codes.used', 'Used')}
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
                  {t(statusLabelKeys[code.status], code.status)}
                </span>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                {formatDate(code.distributedAt)}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                {formatDate(code.expiresAt)}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                {code.usedAt ? formatDate(code.usedAt) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default CodeTable;
