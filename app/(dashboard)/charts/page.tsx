import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import {
  FREE_SYMBOLS,
  FREE_TIMEFRAMES,
  PRO_SYMBOLS,
  PRO_TIMEFRAMES,
  type Tier,
} from '@/lib/tier-config';

// Force dynamic rendering since this page uses headers via getSession
export const dynamic = 'force-dynamic';

/**
 * Charts Page
 *
 * Displays symbol/timeframe selectors with tier-based filtering.
 * FREE tier: 5 symbols, 3 timeframes (15 combinations)
 * PRO tier: 15 symbols, 9 timeframes (135 combinations)
 */
export default async function ChartsPage(): Promise<React.JSX.Element> {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const tier = (session.user?.tier as Tier) || 'FREE';
  const symbols: readonly string[] =
    tier === 'PRO' ? PRO_SYMBOLS : FREE_SYMBOLS;
  const timeframes: readonly string[] =
    tier === 'PRO' ? PRO_TIMEFRAMES : FREE_TIMEFRAMES;

  // Default chart selection
  const defaultSymbol = 'XAUUSD';
  const defaultTimeframe = 'H1';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Trading Charts</h1>
        <p className="mt-1 text-sm text-gray-600">
          Select a symbol and timeframe to view charts with indicator overlays
        </p>
      </div>

      {/* Upgrade Banner for FREE tier */}
      {tier === 'FREE' && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚡</span>
            <div className="flex-1">
              <p className="font-semibold text-amber-900">
                Upgrade to PRO for more charts
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Access all 15 symbols and 9 timeframes (135 combinations) plus
                faster 30s data updates.
              </p>
              <Link
                href="/pricing"
                className="inline-block mt-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
              >
                Upgrade to PRO - $29/month
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Tier Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Available Symbols</p>
          <p className="text-2xl font-bold text-gray-900">{symbols.length}</p>
          <p className="text-xs text-gray-500 mt-1">
            {tier === 'FREE' ? 'of 15' : 'all symbols'}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Available Timeframes</p>
          <p className="text-2xl font-bold text-gray-900">
            {timeframes.length}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {tier === 'FREE' ? 'of 9' : 'all timeframes'}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Chart Combinations</p>
          <p className="text-2xl font-bold text-gray-900">
            {symbols.length * timeframes.length}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {tier === 'FREE' ? 'of 135' : 'all combinations'}
          </p>
        </div>
      </div>

      {/* Symbol Grid */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Select a Symbol
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {PRO_SYMBOLS.map((symbol) => {
            const isAvailable = symbols.includes(symbol);
            return (
              <div key={symbol} className="relative">
                {isAvailable ? (
                  <Link
                    href={`/charts/${symbol}/${defaultTimeframe}`}
                    className="block px-4 py-3 text-center rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    <span className="font-semibold text-gray-900">
                      {symbol}
                    </span>
                  </Link>
                ) : (
                  <div className="px-4 py-3 text-center rounded-lg border-2 border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed relative">
                    <span className="font-semibold text-gray-400">
                      {symbol}
                    </span>
                    <span className="absolute top-1 right-1 px-1.5 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded">
                      PRO
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeframe Grid */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Select a Timeframe
        </h2>
        <div className="flex flex-wrap gap-3">
          {PRO_TIMEFRAMES.map((tf) => {
            const isAvailable = timeframes.includes(tf);
            const timeframeLabels: Record<string, string> = {
              M5: '5 Min',
              M15: '15 Min',
              M30: '30 Min',
              H1: '1 Hour',
              H2: '2 Hours',
              H4: '4 Hours',
              H8: '8 Hours',
              H12: '12 Hours',
              D1: 'Daily',
            };
            return (
              <div key={tf} className="relative">
                {isAvailable ? (
                  <Link
                    href={`/charts/${defaultSymbol}/${tf}`}
                    className="block px-6 py-3 text-center rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors min-w-[100px]"
                  >
                    <span className="font-bold text-lg text-gray-900">
                      {tf}
                    </span>
                    <span className="block text-xs text-gray-500 mt-0.5">
                      {timeframeLabels[tf]}
                    </span>
                  </Link>
                ) : (
                  <div className="px-6 py-3 text-center rounded-lg border-2 border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed relative min-w-[100px]">
                    <span className="font-bold text-lg text-gray-400">
                      {tf}
                    </span>
                    <span className="block text-xs text-gray-400 mt-0.5">
                      {timeframeLabels[tf]}
                    </span>
                    <span className="absolute top-1 right-1 px-1.5 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded">
                      PRO
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Access - Popular Charts */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Quick Access
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { symbol: 'XAUUSD', timeframe: 'H1', label: 'Gold - 1 Hour' },
            { symbol: 'BTCUSD', timeframe: 'H4', label: 'Bitcoin - 4 Hours' },
            { symbol: 'EURUSD', timeframe: 'D1', label: 'EUR/USD - Daily' },
            { symbol: 'US30', timeframe: 'H1', label: 'Dow Jones - 1 Hour' },
          ].map(({ symbol, timeframe, label }) => {
            const symbolAvailable = symbols.includes(symbol);
            const tfAvailable = timeframes.includes(timeframe);
            const isAvailable = symbolAvailable && tfAvailable;

            return (
              <div key={`${symbol}-${timeframe}`}>
                {isAvailable ? (
                  <Link
                    href={`/charts/${symbol}/${timeframe}`}
                    className="block p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    <span className="font-bold text-gray-900">
                      {symbol}/{timeframe}
                    </span>
                    <span className="block text-sm text-gray-500 mt-1">
                      {label}
                    </span>
                  </Link>
                ) : (
                  <div className="p-4 rounded-lg border-2 border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed">
                    <span className="font-bold text-gray-400">
                      {symbol}/{timeframe}
                    </span>
                    <span className="block text-sm text-gray-400 mt-1">
                      {label}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
