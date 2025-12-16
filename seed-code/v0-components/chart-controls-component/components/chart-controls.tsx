'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { SymbolSelector } from './symbol-selector';
import { TimeframeSelector } from './timeframe-selector';
import { UpgradeModal } from './upgrade-modal';
import type { UserTier } from '@/lib/chart-data';
import { cn } from '@/lib/utils';

interface ChartControlsProps {
  userTier: UserTier;
  selectedSymbol: string;
  selectedTimeframe: string;
  onSymbolChange: (symbol: string) => void;
  onTimeframeChange: (timeframe: string) => void;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  lastUpdated?: string;
}

export function ChartControls({
  userTier,
  selectedSymbol,
  selectedTimeframe,
  onSymbolChange,
  onTimeframeChange,
  isRefreshing = false,
  onRefresh,
  lastUpdated = '5s ago',
}: ChartControlsProps) {
  const [upgradeModal, setUpgradeModal] = useState<{
    isOpen: boolean;
    itemType: 'symbol' | 'timeframe';
    itemName: string;
  }>({
    isOpen: false,
    itemType: 'symbol',
    itemName: '',
  });

  const handleUpgradeClick = (
    itemType: 'symbol' | 'timeframe',
    itemName: string
  ) => {
    setUpgradeModal({
      isOpen: true,
      itemType,
      itemName,
    });
  };

  const handleCloseModal = () => {
    setUpgradeModal({
      ...upgradeModal,
      isOpen: false,
    });
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
          {/* Symbol Selector */}
          <div className="flex-1">
            <SymbolSelector
              userTier={userTier}
              selectedSymbol={selectedSymbol}
              onSymbolChange={onSymbolChange}
              onUpgradeClick={handleUpgradeClick}
            />
          </div>

          {/* Timeframe Selector */}
          <div className="flex-1">
            <TimeframeSelector
              userTier={userTier}
              selectedTimeframe={selectedTimeframe}
              onTimeframeChange={onTimeframeChange}
              onUpgradeClick={handleUpgradeClick}
            />
          </div>

          {/* Additional Controls */}
          {onRefresh && (
            <div className="flex items-center gap-3 justify-between sm:justify-end">
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh data"
              >
                <RefreshCw
                  className={cn(
                    'w-5 h-5 text-gray-600',
                    isRefreshing && 'animate-spin'
                  )}
                />
              </button>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                Updated {lastUpdated}
              </span>
            </div>
          )}
        </div>

        {/* Tier Badge */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Current Plan: <span className="font-semibold">{userTier}</span>
            </span>
            {userTier === 'FREE' && (
              <button
                onClick={() => handleUpgradeClick('symbol', 'all features')}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold hover:underline"
              >
                Upgrade to PRO →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={upgradeModal.isOpen}
        onClose={handleCloseModal}
        itemType={upgradeModal.itemType}
        itemName={upgradeModal.itemName}
      />
    </>
  );
}
