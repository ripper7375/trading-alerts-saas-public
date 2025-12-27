'use client';

/**
 * Upgrade Button Component
 *
 * Client component that displays an upgrade button/link with dynamic pricing
 * from SystemConfig. Used in server components that need to show upgrade CTAs.
 *
 * @module components/ui/upgrade-button
 */

import Link from 'next/link';

import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';
import { cn } from '@/lib/utils';

interface UpgradeButtonProps {
  /** Variant style */
  variant?: 'primary' | 'amber' | 'outline';
  /** Additional CSS classes */
  className?: string;
  /** Link destination */
  href?: string;
  /** Whether to display as a full-width block */
  block?: boolean;
}

export function UpgradeButton({
  variant = 'primary',
  className,
  href = '/pricing',
  block = false,
}: UpgradeButtonProps): React.ReactElement {
  // Get dynamic PRO price from SystemConfig
  const { regularPrice } = useAffiliateConfig();

  const baseStyles = cn(
    'inline-block px-4 py-2 font-medium rounded-lg transition-colors',
    block && 'block w-full text-center',
    {
      'bg-blue-600 text-white hover:bg-blue-700': variant === 'primary',
      'bg-amber-600 text-white hover:bg-amber-700': variant === 'amber',
      'border border-gray-300 text-gray-700 hover:bg-gray-50':
        variant === 'outline',
    },
    className
  );

  return (
    <Link href={href} className={baseStyles}>
      Upgrade to PRO - ${regularPrice}/month
    </Link>
  );
}
