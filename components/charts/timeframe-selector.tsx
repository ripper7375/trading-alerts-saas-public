'use client';

import { useState } from 'react';

import type { Tier } from '@/lib/tier-config';
import { FREE_TIMEFRAMES, PRO_TIMEFRAMES } from '@/lib/tier-config';
import { cn } from '@/lib/utils';

/**
 * TimeframeSelector Props
 */
interface TimeframeSelectorProps {
  userTier: Tier;
  selectedTimeframe: string;
  onTimeframeChange: (timeframe: string) => void;
  onUpgradeClick: (timeframe: string) => void;
}

/**
 * Timeframe display info
 */
const TIMEFRAME_INFO: Record<string, { name: string; description: string }> = {
  M5: { name: '5 Minutes', description: 'Scalping' },
  M15: { name: '15 Minutes', description: 'Short-term' },
  M30: { name: '30 Minutes', description: 'Intraday' },
  H1: { name: '1 Hour', description: 'Intraday' },
  H2: { name: '2 Hours', description: 'Intraday' },
  H4: { name: '4 Hours', description: 'Swing' },
  H8: { name: '8 Hours', description: 'Swing' },
  H12: { name: '12 Hours', description: 'Position' },
  D1: { name: 'Daily', description: 'Position' },
};

/**
 * TimeframeSelector Component
 *
 * Displays a timeframe button group with tier-based gating.
 * PRO-only timeframes show lock icon and PRO badge for FREE users.
 *
 * FREE Tier: H1, H4, D1 (3 timeframes)
 * PRO Tier: M5, M15, M30, H1, H2, H4, H8, H12, D1 (9 timeframes)
 */
export function TimeframeSelector({
  userTier,
  selectedTimeframe,
  onTimeframeChange,
  onUpgradeClick,
}: TimeframeSelectorProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  const availableTimeframes: readonly string[] =
    userTier === 'PRO' ? PRO_TIMEFRAMES : FREE_TIMEFRAMES;

  /**
   * Check if timeframe is available for current tier
   */
  const isTimeframeAvailable = (timeframe: string): boolean => {
    return availableTimeframes.includes(timeframe);
  };

  /**
   * Handle timeframe click
   */
  const handleClick = (timeframe: string): void => {
    if (isTimeframeAvailable(timeframe)) {
      onTimeframeChange(timeframe);
      setIsOpen(false);
    } else {
      onUpgradeClick(timeframe);
    }
  };

  const selectedInfo = TIMEFRAME_INFO[selectedTimeframe];

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-2.5 border-2 rounded-lg transition-colors',
          isOpen
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 hover:border-blue-500'
        )}
      >
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-900">{selectedTimeframe}</span>
          <span className="text-sm text-gray-500">{selectedInfo?.name}</span>
        </div>
        <svg
          className={cn(
            'w-4 h-4 text-gray-500 transition-transform',
            isOpen && 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border-2 border-gray-200 z-50 p-4">
            {/* Timeframe Grid */}
            <div className="grid grid-cols-3 gap-2">
              {PRO_TIMEFRAMES.map((tf) => {
                const isAvailable = isTimeframeAvailable(tf);
                const isSelected = tf === selectedTimeframe;
                const info = TIMEFRAME_INFO[tf];

                return (
                  <button
                    key={tf}
                    onClick={() => handleClick(tf)}
                    className={cn(
                      'relative p-3 rounded-lg border-2 text-center transition-all',
                      isSelected && isAvailable && 'border-blue-500 bg-blue-50',
                      !isSelected &&
                        isAvailable &&
                        'border-gray-200 hover:border-blue-400 hover:bg-blue-50',
                      !isAvailable && 'border-gray-100 bg-gray-50 opacity-60'
                    )}
                  >
                    {/* PRO Badge for locked timeframes */}
                    {!isAvailable && (
                      <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded">
                        PRO
                      </span>
                    )}

                    {/* Timeframe Code */}
                    <div
                      className={cn(
                        'text-lg font-bold',
                        isSelected && isAvailable
                          ? 'text-blue-600'
                          : 'text-gray-900',
                        !isAvailable && 'text-gray-400'
                      )}
                    >
                      {tf}
                    </div>

                    {/* Timeframe Name */}
                    <div
                      className={cn(
                        'text-xs',
                        isAvailable ? 'text-gray-500' : 'text-gray-400'
                      )}
                    >
                      {info?.name}
                    </div>

                    {/* Lock Icon for unavailable */}
                    {!isAvailable && (
                      <svg
                        className="w-3 h-3 mx-auto mt-1 text-gray-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Upgrade Prompt for FREE users */}
            {userTier === 'FREE' && (
              <div className="mt-4 p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg text-white">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">⭐</span>
                  <span className="font-semibold text-sm">
                    Unlock 6 more timeframes
                  </span>
                </div>
                <p className="text-xs opacity-90 mb-2">
                  Upgrade to PRO for M5, M15, M30, H2, H8, H12
                </p>
                <button
                  onClick={() => onUpgradeClick('all PRO timeframes')}
                  className="w-full py-1.5 bg-white text-blue-600 text-sm font-semibold rounded hover:bg-gray-100 transition-colors"
                >
                  Upgrade to PRO
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
