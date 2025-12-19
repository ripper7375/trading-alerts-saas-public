/**
 * StatsCard Component
 *
 * Displays a single statistic with optional icon and trend indicator.
 * Used in the affiliate dashboard to show key metrics.
 *
 * @module components/affiliate/stats-card
 */

import React from 'react';
import { cn } from '@/lib/utils';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE DEFINITIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface StatsCardProps {
  /** Title label for the statistic */
  title: string;
  /** The value to display (formatted string) */
  value: string;
  /** Optional icon to display */
  icon?: React.ReactNode;
  /** Optional trend indicator */
  trend?: {
    /** Percentage change value */
    value: number;
    /** Direction of change */
    direction: 'up' | 'down';
  };
  /** Additional CSS classes */
  className?: string;
  /** Data test id for testing */
  'data-testid'?: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * StatsCard component displays a metric with optional icon and trend
 *
 * @example
 * ```tsx
 * <StatsCard
 *   title="Total Earnings"
 *   value="$142.50"
 *   icon={<DollarIcon />}
 *   trend={{ value: 8.5, direction: 'up' }}
 * />
 * ```
 */
export function StatsCard({
  title,
  value,
  icon,
  trend,
  className,
  'data-testid': dataTestId,
}: StatsCardProps): React.ReactElement {
  return (
    <div
      className={cn(
        'bg-white p-6 rounded-lg shadow',
        className
      )}
      data-testid={dataTestId}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold mt-2">{value}</p>
          {trend && (
            <p
              className={cn(
                'text-sm mt-1',
                trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
              )}
            >
              {trend.direction === 'up' ? '↑' : '↓'} {trend.value}%
            </p>
          )}
        </div>
        {icon && (
          <div className="text-gray-400" data-testid="icon-container">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

export default StatsCard;
