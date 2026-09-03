/**
 * Fraud Pattern Badge Component
 *
 * Displays fraud pattern severity with color coding:
 * - CRITICAL: Red badge
 * - HIGH: Orange badge
 * - MEDIUM: Yellow badge
 * - LOW: Blue badge
 *
 * @module components/admin/FraudPatternBadge
 */

import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/context/locale-context';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface FraudPatternBadgeProps {
  /** Severity level */
  severity: SeverityLevel;
  /** Optional pattern type label */
  pattern?: string;
  /** Show as small badge */
  size?: 'sm' | 'md';
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SEVERITY_CONFIG: Record<
  SeverityLevel,
  { bg: string; text: string; border: string }
> = {
  CRITICAL: {
    bg: 'bg-red-500/10',
    text: 'text-red-500',
    border: 'border-red-500/30',
  },
  HIGH: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-500',
    border: 'border-orange-500/30',
  },
  MEDIUM: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-500',
    border: 'border-yellow-500/30',
  },
  LOW: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    border: 'border-blue-500/30',
  },
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function FraudPatternBadge({
  severity,
  pattern,
  size = 'md',
}: FraudPatternBadgeProps): React.ReactElement {
  const { t } = useLocale();
  const config = SEVERITY_CONFIG[severity];
  const severityLabel = {
    CRITICAL: t('admin.fraud.critical', 'Critical').toUpperCase(),
    HIGH: t('admin.fraud.high', 'High').toUpperCase(),
    MEDIUM: t('admin.fraud.medium', 'Medium').toUpperCase(),
    LOW: t('admin.fraud.low', 'Low').toUpperCase(),
  }[severity];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        config.bg,
        config.text,
        config.border,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      )}
    >
      {severityLabel}
      {pattern && <span className="opacity-75">• {pattern}</span>}
    </span>
  );
}
