import type { LucideIcon } from 'lucide-react';
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  description?: string;
  variant?: 'default' | 'usage';
  current?: number;
  max?: number;
}

/**
 * Stats Card Component
 *
 * Reusable card for displaying dashboard statistics.
 *
 * Features:
 * - Icon with title
 * - Main value display
 * - Optional change percentage with trend indicator
 * - Optional usage progress bar variant
 *
 * @param title - Card title
 * @param value - Main value to display
 * @param change - Percentage change (optional)
 * @param changeLabel - Label for change, e.g., "from last month"
 * @param icon - Lucide icon component
 * @param description - Optional description text
 * @param variant - 'default' or 'usage' for progress bar
 * @param current - Current value for usage variant
 * @param max - Maximum value for usage variant
 */
export function StatsCard({
  title,
  value,
  change,
  changeLabel = 'from last month',
  icon: Icon,
  description,
  variant = 'default',
  current,
  max,
}: StatsCardProps): React.ReactElement {
  // Calculate usage percentage for usage variant
  const usagePercentage =
    variant === 'usage' && current !== undefined && max !== undefined
      ? Math.round((current / max) * 100)
      : 0;

  // Determine if usage is high (>80%)
  const isHighUsage = usagePercentage > 80;

  return (
    <Card className="bg-white dark:bg-gray-800">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {title}
        </CardTitle>
        <Icon className="h-5 w-5 text-gray-400" />
      </CardHeader>
      <CardContent className="pt-0">
        {/* Main Value */}
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {value}
        </div>

        {/* Description or Change indicator */}
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {description}
          </p>
        )}

        {/* Change indicator */}
        {change !== undefined && (
          <div className="flex items-center gap-1 mt-1">
            {change >= 0 ? (
              <ArrowUpIcon className="h-3 w-3 text-green-500" />
            ) : (
              <ArrowDownIcon className="h-3 w-3 text-red-500" />
            )}
            <span
              className={cn(
                'text-xs font-medium',
                change >= 0 ? 'text-green-600' : 'text-red-600'
              )}
            >
              {change >= 0 ? '+' : ''}
              {change}%
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {changeLabel}
            </span>
          </div>
        )}

        {/* Usage Progress Bar */}
        {variant === 'usage' && current !== undefined && max !== undefined && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>
                {current} / {max}
              </span>
              <span>{usagePercentage}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className={cn(
                  'h-full transition-all rounded-full',
                  isHighUsage ? 'bg-amber-500' : 'bg-blue-600'
                )}
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              />
            </div>
            {isHighUsage && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                ⚠️ Approaching limit
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
