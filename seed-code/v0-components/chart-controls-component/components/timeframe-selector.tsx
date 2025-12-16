'use client';

import { useState } from 'react';
import { ChevronDown, Lock } from 'lucide-react';
import {
  ALL_TIMEFRAMES,
  FREE_TIMEFRAMES,
  type UserTier,
} from '@/lib/chart-data';
import { cn } from '@/lib/utils';

interface TimeframeSelectorProps {
  userTier: UserTier;
  selectedTimeframe: string;
  onTimeframeChange: (timeframe: string) => void;
  onUpgradeClick: (itemType: 'symbol' | 'timeframe', itemName: string) => void;
}

export function TimeframeSelector({
  userTier,
  selectedTimeframe,
  onTimeframeChange,
  onUpgradeClick,
}: TimeframeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedTimeframeData = ALL_TIMEFRAMES.find(
    (t) => t.code === selectedTimeframe
  );

  const handleTimeframeSelect = (timeframeCode: string) => {
    if (userTier === 'FREE' && !FREE_TIMEFRAMES.includes(timeframeCode)) {
      const timeframe = ALL_TIMEFRAMES.find((t) => t.code === timeframeCode);
      onUpgradeClick(
        'timeframe',
        `${timeframe?.code} (${timeframe?.name})` || timeframeCode
      );
      return;
    }
    onTimeframeChange(timeframeCode);
    setIsOpen(false);
  };

  const isTimeframeLocked = (timeframeCode: string) => {
    return userTier === 'FREE' && !FREE_TIMEFRAMES.includes(timeframeCode);
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 border-2 rounded-lg px-4 py-2 cursor-pointer transition-colors',
          isOpen
            ? 'border-blue-600 bg-blue-50'
            : 'border-gray-300 hover:border-blue-600'
        )}
      >
        <div className="flex items-center gap-2 flex-1">
          <span className="text-lg font-bold text-gray-900">
            {selectedTimeframeData?.code || selectedTimeframe}
          </span>
          <span className="text-sm text-gray-600 hidden sm:inline">
            {selectedTimeframeData?.name}
          </span>
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-500 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border-2 border-gray-200 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Timeframe Grid */}
            <div className="grid grid-cols-3 gap-2 p-4">
              {ALL_TIMEFRAMES.map((timeframe) => {
                const isLocked = isTimeframeLocked(timeframe.code);
                const isSelected = timeframe.code === selectedTimeframe;

                return (
                  <button
                    key={timeframe.code}
                    onClick={() => handleTimeframeSelect(timeframe.code)}
                    disabled={isLocked}
                    className={cn(
                      'relative border-2 rounded-lg p-3 text-center transition-all',
                      isSelected &&
                        'border-blue-600 bg-blue-50 text-blue-600 font-semibold',
                      !isSelected &&
                        !isLocked &&
                        'border-gray-200 hover:border-blue-400 hover:bg-blue-50',
                      isLocked &&
                        'border-gray-200 opacity-50 cursor-not-allowed'
                    )}
                  >
                    {isLocked && (
                      <span className="absolute top-1 right-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                        PRO
                      </span>
                    )}
                    <div className="text-xl font-bold text-gray-900 mb-1">
                      {timeframe.code}
                    </div>
                    <div className="text-xs text-gray-600">
                      {timeframe.name}
                    </div>
                    {isLocked && (
                      <Lock className="w-4 h-4 text-gray-400 mx-auto mt-1" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Upgrade Prompt */}
            {userTier === 'FREE' && (
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-4 m-4 mt-0">
                <div className="text-2xl mb-2">⭐</div>
                <div className="text-sm font-semibold mb-1">
                  Unlock 6 more timeframes
                </div>
                <div className="text-xs opacity-90 mb-3">
                  Upgrade to PRO for M5-H12
                </div>
                <button
                  onClick={() =>
                    onUpgradeClick('timeframe', 'additional timeframes')
                  }
                  className="w-full bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
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
