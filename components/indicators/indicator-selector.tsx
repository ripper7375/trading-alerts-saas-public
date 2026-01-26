'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 57-COLUMN SCHEMA INDICATOR DEFINITIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * FREE tier indicators (2 groups, 16 columns total)
 * Available to both FREE and PRO tier users
 */
const FREE_TIER_INDICATORS = [
  {
    id: 'fractal_diagonal',
    name: 'Fractal Diagonal Lines',
    description: 'Dynamic ascending/descending trendlines (8 columns)',
    isPro: false,
  },
  {
    id: 'fractal_horizontal',
    name: 'Fractal Horizontal Lines',
    description: 'Support/resistance levels from fractals (8 columns)',
    isPro: false,
  },
] as const;

/**
 * PRO tier indicators (6 groups, 33 columns total)
 * Requires PRO subscription to access
 */
const PRO_ONLY_INDICATORS = [
  {
    id: 'moving_averages',
    name: 'Moving Averages (TEMA/HRMA/SMMA)',
    description: 'Triple exponential, hull-like, smoothed MAs (3 columns)',
    isPro: true,
  },
  {
    id: 'body_momentum',
    name: 'Body Size Momentum',
    description: 'Candle body Z-score analysis (2 columns)',
    isPro: true,
  },
  {
    id: 'heiken_ashi',
    name: 'Heiken Ashi',
    description: 'Smoothed candlesticks with classification (7 columns)',
    isPro: true,
  },
  {
    id: 'keltner_channels',
    name: 'Keltner Channels',
    description: '10-band volatility channel system (10 columns)',
    isPro: true,
  },
  {
    id: 'support_resistance',
    name: 'Support & Resistance',
    description: 'Fractal-based S/R levels (8 columns)',
    isPro: true,
  },
  {
    id: 'zigzag',
    name: 'ZigZag + EMA',
    description: 'Market structure with swing points (3 columns)',
    isPro: true,
  },
] as const;

type IndicatorId =
  | (typeof FREE_TIER_INDICATORS)[number]['id']
  | (typeof PRO_ONLY_INDICATORS)[number]['id'];

interface IndicatorSelectorProps {
  tier: 'FREE' | 'PRO';
  selectedIndicators?: IndicatorId[];
  onSelectionChange?: (indicators: IndicatorId[]) => void;
  className?: string;
}

/**
 * IndicatorSelector Component (57-Column Schema)
 *
 * Allows users to select chart indicators with tier-based access control.
 * PRO-only indicators are locked and display a lock icon for FREE users.
 *
 * 57-Column Schema Structure:
 * - System columns (8): OHLCV + timeframe + timestamps
 * - FREE tier (16 columns): fractal_diagonal (8) + fractal_horizontal (8)
 * - PRO tier (33 columns): moving_averages (3) + body_momentum (2) + heiken_ashi (7)
 *                          + keltner_channels (10) + support_resistance (8) + zigzag (3)
 *
 * Features:
 * - FREE indicators: Fractal Diagonal Lines, Fractal Horizontal Lines
 * - PRO indicators: Moving Averages, Body Momentum, Heiken Ashi, Keltner Channels, S/R, ZigZag
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
      {/* FREE Tier Indicators Section */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Free Indicators
          </h3>
          <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800 dark:bg-green-900 dark:text-green-200">
            16 columns
          </span>
        </div>
        <div className="space-y-2">
          {FREE_TIER_INDICATORS.map((indicator) => (
            <label
              key={indicator.id}
              className="flex cursor-pointer items-center space-x-2 rounded-md p-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <input
                type="checkbox"
                checked={selected.includes(indicator.id)}
                onChange={() => handleToggle(indicator.id, false)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex flex-col">
                <span className="text-gray-700 dark:text-gray-300">
                  {indicator.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {indicator.description}
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* PRO Tier Indicators Section */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Pro Indicators
          </h3>
          <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            33 columns
          </span>
        </div>
        <div className="space-y-2">
          {PRO_ONLY_INDICATORS.map((indicator) => (
            <label
              key={indicator.id}
              className={cn(
                'flex items-center space-x-2 rounded-md p-2 transition-colors',
                tier === 'FREE'
                  ? 'cursor-not-allowed opacity-50'
                  : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
            >
              <input
                type="checkbox"
                checked={selected.includes(indicator.id)}
                onChange={() => handleToggle(indicator.id, true)}
                disabled={tier === 'FREE'}
                className={cn(
                  'h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500',
                  tier === 'FREE' && 'cursor-not-allowed'
                )}
              />
              <div className="flex flex-col">
                <span className="flex items-center space-x-2">
                  <span className="text-gray-700 dark:text-gray-300">
                    {indicator.name}
                  </span>
                  {tier === 'FREE' && <Lock className="h-4 w-4 text-gray-400" />}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {indicator.description}
                </span>
              </div>
            </label>
          ))}
        </div>

        {/* Upgrade Prompt for FREE users */}
        {tier === 'FREE' && (
          <Link href="/pricing">
            <Button
              variant="ghost"
              className="mt-3 w-full bg-blue-50 text-sm text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
            >
              Unlock 6 More Indicator Groups with Pro
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

export type { IndicatorSelectorProps, IndicatorId };
