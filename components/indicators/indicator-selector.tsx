'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * Indicator definitions with PRO-only flag
 */
const PRO_ONLY_INDICATORS = [
  { id: 'momentum_candles', name: 'Momentum Candles', isPro: true },
  { id: 'keltner_channels', name: 'Keltner Channels', isPro: true },
  { id: 'tema', name: 'TEMA', isPro: true },
  { id: 'hrma', name: 'HRMA', isPro: true },
  { id: 'smma', name: 'SMMA', isPro: true },
  { id: 'zigzag', name: 'ZigZag', isPro: true },
] as const;

const BASIC_INDICATORS = [
  { id: 'fractals', name: 'Fractals', isPro: false },
  { id: 'trendlines', name: 'Trendlines', isPro: false },
] as const;

type IndicatorId =
  | (typeof BASIC_INDICATORS)[number]['id']
  | (typeof PRO_ONLY_INDICATORS)[number]['id'];

interface IndicatorSelectorProps {
  tier: 'FREE' | 'PRO';
  selectedIndicators?: IndicatorId[];
  onSelectionChange?: (indicators: IndicatorId[]) => void;
  className?: string;
}

/**
 * IndicatorSelector Component
 *
 * Allows users to select chart indicators with tier-based access control.
 * PRO-only indicators are locked and display a lock icon for FREE users.
 *
 * Features:
 * - Basic indicators (FREE + PRO): Fractals, Trendlines
 * - PRO indicators: Momentum Candles, Keltner Channels, TEMA, HRMA, SMMA, ZigZag
 * - Lock icons for tier-gated indicators
 * - Upgrade prompt for FREE users
 */
export function IndicatorSelector({
  tier,
  selectedIndicators = [],
  onSelectionChange,
  className,
}: IndicatorSelectorProps): React.ReactElement {
  const [selected, setSelected] = useState<IndicatorId[]>(selectedIndicators);
  const { info } = useToast();

  const handleToggle = (indicatorId: IndicatorId, isPro: boolean): void => {
    if (isPro && tier === 'FREE') {
      info(
        'Pro Feature',
        'Upgrade to Pro to access this indicator. 7-day free trial available.'
      );
      return;
    }

    const newSelected = selected.includes(indicatorId)
      ? selected.filter((id) => id !== indicatorId)
      : [...selected, indicatorId];

    setSelected(newSelected);
    onSelectionChange?.(newSelected);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Basic Indicators Section */}
      <div>
        <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">
          Basic Indicators (Free)
        </h3>
        <div className="space-y-2">
          {BASIC_INDICATORS.map((indicator) => (
            <label
              key={indicator.id}
              className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded-md transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.includes(indicator.id)}
                onChange={() => handleToggle(indicator.id, false)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700 dark:text-gray-300">
                {indicator.name}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* PRO Indicators Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Pro Indicators
          </h3>
          {tier === 'FREE' && (
            <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
              Pro Only
            </span>
          )}
        </div>
        <div className="space-y-2">
          {PRO_ONLY_INDICATORS.map((indicator) => (
            <label
              key={indicator.id}
              className={cn(
                'flex items-center space-x-2 p-2 rounded-md transition-colors',
                tier === 'FREE'
                  ? 'opacity-50 cursor-not-allowed'
                  : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
            >
              <input
                type="checkbox"
                checked={selected.includes(indicator.id)}
                onChange={() => handleToggle(indicator.id, true)}
                disabled={tier === 'FREE'}
                className={cn(
                  'w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500',
                  tier === 'FREE' && 'cursor-not-allowed'
                )}
              />
              <span className="flex items-center space-x-2">
                <span className="text-gray-700 dark:text-gray-300">
                  {indicator.name}
                </span>
                {tier === 'FREE' && (
                  <Lock className="h-4 w-4 text-gray-400" />
                )}
              </span>
            </label>
          ))}
        </div>

        {/* Upgrade Prompt for FREE users */}
        {tier === 'FREE' && (
          <Link href="/pricing">
            <Button
              variant="ghost"
              className="mt-3 w-full text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
            >
              Unlock 6 More Indicators with Pro
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

export type { IndicatorSelectorProps, IndicatorId };
