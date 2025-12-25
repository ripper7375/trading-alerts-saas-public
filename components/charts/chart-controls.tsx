'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { Tier } from '@/lib/tier-config';
import {
  FREE_SYMBOLS,
  FREE_TIMEFRAMES,
  PRO_SYMBOLS,
  PRO_TIMEFRAMES,
  BASIC_INDICATORS,
  PRO_ONLY_INDICATORS,
  INDICATOR_CONFIG,
  type IndicatorId,
} from '@/lib/tier-config';
import { cn } from '@/lib/utils';

import { TimeframeSelector } from './timeframe-selector';

/**
 * ChartControls Props
 */
interface ChartControlsProps {
  userTier: Tier;
  selectedSymbol: string;
  selectedTimeframe: string;
  selectedIndicators?: string[];
  onIndicatorToggle?: (indicatorId: string) => void;
}

/**
 * Symbol display info
 */
const SYMBOL_INFO: Record<string, { name: string; category: string }> = {
  AUDJPY: { name: 'AUD/JPY', category: 'Forex' },
  AUDUSD: { name: 'AUD/USD', category: 'Forex' },
  BTCUSD: { name: 'Bitcoin', category: 'Crypto' },
  ETHUSD: { name: 'Ethereum', category: 'Crypto' },
  EURUSD: { name: 'EUR/USD', category: 'Forex' },
  GBPJPY: { name: 'GBP/JPY', category: 'Forex' },
  GBPUSD: { name: 'GBP/USD', category: 'Forex' },
  NDX100: { name: 'Nasdaq 100', category: 'Index' },
  NZDUSD: { name: 'NZD/USD', category: 'Forex' },
  US30: { name: 'Dow Jones', category: 'Index' },
  USDCAD: { name: 'USD/CAD', category: 'Forex' },
  USDCHF: { name: 'USD/CHF', category: 'Forex' },
  USDJPY: { name: 'USD/JPY', category: 'Forex' },
  XAGUSD: { name: 'Silver', category: 'Commodity' },
  XAUUSD: { name: 'Gold', category: 'Commodity' },
};

/**
 * ChartControls Component
 *
 * Displays symbol and timeframe selectors with tier-based filtering.
 * Shows upgrade prompts for locked options.
 *
 * Features:
 * - Symbol dropdown with tier filtering
 * - Timeframe selector with tier gates
 * - Shows PRO badge on locked options
 * - Upgrade button for FREE users
 */
export function ChartControls({
  userTier,
  selectedSymbol,
  selectedTimeframe,
  selectedIndicators = ['fractals', 'trendlines'],
  onIndicatorToggle,
}: ChartControlsProps): React.JSX.Element {
  const router = useRouter();
  const [isSymbolDropdownOpen, setIsSymbolDropdownOpen] = useState(false);
  const [isIndicatorPanelOpen, setIsIndicatorPanelOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');

  const availableSymbols: readonly string[] =
    userTier === 'PRO' ? PRO_SYMBOLS : FREE_SYMBOLS;
  const availableTimeframes: readonly string[] =
    userTier === 'PRO' ? PRO_TIMEFRAMES : FREE_TIMEFRAMES;

  /**
   * Handle symbol change
   */
  const handleSymbolChange = (symbol: string): void => {
    const isAvailable = availableSymbols.includes(symbol);

    if (isAvailable) {
      router.push(`/charts/${symbol}/${selectedTimeframe}`);
      setIsSymbolDropdownOpen(false);
    } else {
      setUpgradeReason(`Access to ${symbol} requires PRO tier`);
      setShowUpgradeModal(true);
    }
  };

  /**
   * Handle timeframe change
   */
  const handleTimeframeChange = (timeframe: string): void => {
    const isAvailable = availableTimeframes.includes(timeframe);

    if (isAvailable) {
      router.push(`/charts/${selectedSymbol}/${timeframe}`);
    } else {
      setUpgradeReason(`Access to ${timeframe} timeframe requires PRO tier`);
      setShowUpgradeModal(true);
    }
  };

  /**
   * Check if symbol is available for current tier
   */
  const isSymbolAvailable = (symbol: string): boolean => {
    return availableSymbols.includes(symbol);
  };

  /**
   * Handle indicator toggle
   */
  const handleIndicatorToggle = (indicatorId: string): void => {
    const isPro = PRO_ONLY_INDICATORS.includes(indicatorId as typeof PRO_ONLY_INDICATORS[number]);

    if (isPro && userTier !== 'PRO') {
      const config = INDICATOR_CONFIG[indicatorId as IndicatorId];
      setUpgradeReason(`Access to ${config?.label || indicatorId} requires PRO tier`);
      setShowUpgradeModal(true);
      return;
    }

    onIndicatorToggle?.(indicatorId);
  };

  /**
   * Check if indicator is available for current tier
   */
  const isIndicatorAvailable = (indicatorId: string): boolean => {
    const isPro = PRO_ONLY_INDICATORS.includes(indicatorId as typeof PRO_ONLY_INDICATORS[number]);
    return !isPro || userTier === 'PRO';
  };

  /**
   * Get selected indicator count
   */
  const selectedCount = selectedIndicators.length;
  const totalCount = userTier === 'PRO'
    ? BASIC_INDICATORS.length + PRO_ONLY_INDICATORS.length
    : BASIC_INDICATORS.length;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
        {/* Symbol Selector */}
        <div className="relative flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Symbol
          </label>
          <button
            onClick={() => setIsSymbolDropdownOpen(!isSymbolDropdownOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 border-2 border-gray-200 rounded-lg hover:border-blue-500 focus:outline-none focus:border-blue-500 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900">{selectedSymbol}</span>
              <span className="text-sm text-gray-500">
                {SYMBOL_INFO[selectedSymbol]?.name || selectedSymbol}
              </span>
            </div>
            <svg
              className={cn(
                'w-4 h-4 text-gray-500 transition-transform',
                isSymbolDropdownOpen && 'rotate-180'
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

          {/* Symbol Dropdown */}
          {isSymbolDropdownOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsSymbolDropdownOpen(false)}
              />

              {/* Dropdown Menu */}
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border-2 border-gray-200 z-50 max-h-80 overflow-y-auto">
                {/* Group by category */}
                {['Commodity', 'Forex', 'Crypto', 'Index'].map((category) => (
                  <div key={category}>
                    <div className="px-3 py-1.5 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky top-0">
                      {category}
                    </div>
                    {PRO_SYMBOLS.filter(
                      (symbol) => SYMBOL_INFO[symbol]?.category === category
                    ).map((symbol) => {
                      const isAvailable = isSymbolAvailable(symbol);
                      const isSelected = symbol === selectedSymbol;

                      return (
                        <button
                          key={symbol}
                          onClick={() => handleSymbolChange(symbol)}
                          className={cn(
                            'w-full flex items-center justify-between px-3 py-2 text-left transition-colors',
                            isSelected && 'bg-blue-50',
                            isAvailable && !isSelected && 'hover:bg-gray-50',
                            !isAvailable && 'opacity-60'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'font-semibold',
                                isSelected ? 'text-blue-600' : 'text-gray-900',
                                !isAvailable && 'text-gray-400'
                              )}
                            >
                              {symbol}
                            </span>
                            <span className="text-sm text-gray-500">
                              {SYMBOL_INFO[symbol]?.name}
                            </span>
                          </div>
                          {!isAvailable && (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded">
                              PRO
                            </span>
                          )}
                          {isSelected && isAvailable && (
                            <svg
                              className="w-4 h-4 text-blue-600"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Timeframe Selector */}
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Timeframe
          </label>
          <TimeframeSelector
            userTier={userTier}
            selectedTimeframe={selectedTimeframe}
            onTimeframeChange={handleTimeframeChange}
            onUpgradeClick={(timeframe) => {
              setUpgradeReason(
                `Access to ${timeframe} timeframe requires PRO tier`
              );
              setShowUpgradeModal(true);
            }}
          />
        </div>

        {/* Indicators Selector */}
        <div className="relative flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Indicators
          </label>
          <button
            onClick={() => setIsIndicatorPanelOpen(!isIndicatorPanelOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 border-2 border-gray-200 rounded-lg hover:border-blue-500 focus:outline-none focus:border-blue-500 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900">{selectedCount}</span>
              <span className="text-sm text-gray-500">
                of {totalCount} active
              </span>
            </div>
            <svg
              className={cn(
                'w-4 h-4 text-gray-500 transition-transform',
                isIndicatorPanelOpen && 'rotate-180'
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

          {/* Indicator Dropdown Panel */}
          {isIndicatorPanelOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsIndicatorPanelOpen(false)}
              />

              {/* Dropdown Menu */}
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border-2 border-gray-200 z-50 max-h-96 overflow-y-auto">
                {/* Basic Indicators */}
                <div>
                  <div className="px-3 py-1.5 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky top-0">
                    Basic Indicators
                  </div>
                  {BASIC_INDICATORS.map((indicatorId) => {
                    const config = INDICATOR_CONFIG[indicatorId];
                    const isSelected = selectedIndicators.includes(indicatorId);

                    return (
                      <button
                        key={indicatorId}
                        onClick={() => handleIndicatorToggle(indicatorId)}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-2 text-left transition-colors hover:bg-gray-50',
                          isSelected && 'bg-blue-50'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                              isSelected
                                ? 'bg-blue-600 border-blue-600'
                                : 'border-gray-300'
                            )}
                          >
                            {isSelected && (
                              <svg
                                className="w-3 h-3 text-white"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </div>
                          <div>
                            <span className="font-semibold text-gray-900">
                              {config.label}
                            </span>
                            <p className="text-xs text-gray-500">
                              {config.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* PRO Indicators */}
                <div>
                  <div className="px-3 py-1.5 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky top-0 flex items-center gap-2">
                    PRO Indicators
                    {userTier !== 'PRO' && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-600 text-white rounded">
                        PRO
                      </span>
                    )}
                  </div>
                  {PRO_ONLY_INDICATORS.map((indicatorId) => {
                    const config = INDICATOR_CONFIG[indicatorId];
                    const isSelected = selectedIndicators.includes(indicatorId);
                    const isAvailable = isIndicatorAvailable(indicatorId);

                    return (
                      <button
                        key={indicatorId}
                        onClick={() => handleIndicatorToggle(indicatorId)}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-2 text-left transition-colors',
                          isSelected && isAvailable && 'bg-blue-50',
                          isAvailable && !isSelected && 'hover:bg-gray-50',
                          !isAvailable && 'opacity-60'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                              isSelected && isAvailable
                                ? 'bg-blue-600 border-blue-600'
                                : 'border-gray-300',
                              !isAvailable && 'bg-gray-100'
                            )}
                          >
                            {isSelected && isAvailable && (
                              <svg
                                className="w-3 h-3 text-white"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                            {!isAvailable && (
                              <svg
                                className="w-3 h-3 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                              </svg>
                            )}
                          </div>
                          <div>
                            <span
                              className={cn(
                                'font-semibold',
                                isAvailable ? 'text-gray-900' : 'text-gray-400'
                              )}
                            >
                              {config.label}
                            </span>
                            <p className="text-xs text-gray-500">
                              {config.description}
                            </p>
                          </div>
                        </div>
                        {!isAvailable && (
                          <span className="px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded">
                            PRO
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {userTier !== 'PRO' && (
                    <div className="p-3 border-t border-gray-100">
                      <Link
                        href="/pricing"
                        className="block text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Upgrade to PRO for advanced indicators
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Tier Badge & Actions */}
        <div className="flex items-end gap-2">
          {userTier === 'FREE' && (
            <Link
              href="/pricing"
              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors whitespace-nowrap"
            >
              ⚡ Upgrade to PRO
            </Link>
          )}
        </div>
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setShowUpgradeModal(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-3xl">⭐</span>
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Upgrade to PRO
                </h3>

                <p className="text-gray-600 mb-4">{upgradeReason}</p>

                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <p className="font-semibold text-gray-900 mb-2">
                    PRO includes:
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>✓ All 15 trading symbols</li>
                    <li>✓ All 9 timeframes (M5-D1)</li>
                    <li>✓ 30-second data updates</li>
                    <li>✓ 20 alerts & 50 watchlist items</li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowUpgradeModal(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <Link
                    href="/pricing"
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-center"
                  >
                    View Plans
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
