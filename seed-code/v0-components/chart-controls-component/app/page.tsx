'use client';

import { useState } from 'react';
import { ChartControls } from '@/components/chart-controls';
import type { UserTier } from '@/lib/chart-data';

export default function HomePage() {
  // Mock authentication - Toggle this to test FREE vs PRO features
  const [userTier, setUserTier] = useState<UserTier>('FREE');
  const [selectedSymbol, setSelectedSymbol] = useState('XAUUSD');
  const [selectedTimeframe, setSelectedTimeframe] = useState('H1');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('5s ago');

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setLastUpdated('0s ago');
    }, 1000);
  };

  const toggleTier = () => {
    setUserTier((current) => (current === 'FREE' ? 'PRO' : 'FREE'));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">
              Trading Dashboard
            </h1>

            {/* Mock Authentication Toggle */}
            <button
              onClick={toggleTier}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
            >
              Switch to {userTier === 'FREE' ? 'PRO' : 'FREE'}
            </button>
          </div>
          <p className="text-gray-600">
            Tier-aware chart controls with symbol and timeframe selectors
          </p>
        </div>

        {/* Chart Controls */}
        <ChartControls
          userTier={userTier}
          selectedSymbol={selectedSymbol}
          selectedTimeframe={selectedTimeframe}
          onSymbolChange={setSelectedSymbol}
          onTimeframeChange={setSelectedTimeframe}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
          lastUpdated={lastUpdated}
        />

        {/* Chart Placeholder */}
        <div className="bg-white rounded-xl shadow-md p-8">
          <div className="aspect-video bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">📈</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {selectedSymbol} - {selectedTimeframe}
              </h2>
              <p className="text-gray-600">
                Chart data would be displayed here
              </p>
              <div className="mt-4 text-sm text-gray-500">
                Current Tier: <span className="font-semibold">{userTier}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              Symbols Available
            </h3>
            <p className="text-2xl font-bold text-blue-600">
              {userTier === 'FREE' ? '5' : '15'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {userTier === 'FREE'
                ? 'Upgrade for 10 more'
                : 'All symbols unlocked'}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Timeframes</h3>
            <p className="text-2xl font-bold text-purple-600">
              {userTier === 'FREE' ? '3' : '9'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {userTier === 'FREE'
                ? 'Upgrade for 6 more'
                : 'All timeframes unlocked'}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              Update Frequency
            </h3>
            <p className="text-2xl font-bold text-green-600">
              {userTier === 'FREE' ? '60s' : '30s'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {userTier === 'FREE'
                ? 'Upgrade for faster updates'
                : 'Priority updates'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
