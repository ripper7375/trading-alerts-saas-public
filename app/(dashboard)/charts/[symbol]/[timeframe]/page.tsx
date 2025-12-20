import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ChartControls } from '@/components/charts/chart-controls';
import { TradingChart } from '@/components/charts/trading-chart';
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
 * Dynamic Chart Page Props
 */
interface ChartPageProps {
  params: Promise<{
    symbol: string;
    timeframe: string;
  }>;
}

/**
 * Check if tier can access symbol
 */
function canAccessSymbol(tier: Tier, symbol: string): boolean {
  const symbols: readonly string[] =
    tier === 'PRO' ? PRO_SYMBOLS : FREE_SYMBOLS;
  return symbols.includes(symbol);
}

/**
 * Check if tier can access timeframe
 */
function canAccessTimeframe(tier: Tier, timeframe: string): boolean {
  const timeframes: readonly string[] =
    tier === 'PRO' ? PRO_TIMEFRAMES : FREE_TIMEFRAMES;
  return timeframes.includes(timeframe);
}

/**
 * Dynamic Chart Page
 *
 * Displays a trading chart for a specific symbol/timeframe combination.
 * Validates tier access before rendering the chart.
 *
 * @route /charts/[symbol]/[timeframe]
 * @example /charts/XAUUSD/H1
 */
export default async function ChartPage({
  params,
}: ChartPageProps): Promise<React.JSX.Element> {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const { symbol, timeframe } = await params;
  const upperSymbol = symbol.toUpperCase();
  const upperTimeframe = timeframe.toUpperCase();
  const tier = (session.user?.tier as Tier) || 'FREE';

  // Validate symbol exists in the system
  const allSymbols: readonly string[] = PRO_SYMBOLS;
  if (!allSymbols.includes(upperSymbol)) {
    notFound();
  }

  // Validate timeframe exists in the system
  const allTimeframes: readonly string[] = PRO_TIMEFRAMES;
  if (!allTimeframes.includes(upperTimeframe)) {
    notFound();
  }

  // Check tier access
  const hasSymbolAccess = canAccessSymbol(tier, upperSymbol);
  const hasTimeframeAccess = canAccessTimeframe(tier, upperTimeframe);

  // Access denied - show upgrade prompt
  if (!hasSymbolAccess || !hasTimeframeAccess) {
    return (
      <div className="space-y-6">
        {/* Back Link */}
        <Link
          href="/charts"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <span className="mr-1">←</span> Back to Charts
        </Link>

        {/* Access Denied Card */}
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-xl border-2 border-red-200 p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-3xl">🔒</span>
            </div>

            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Access Denied
            </h1>

            <p className="text-gray-600 mb-4">
              {!hasSymbolAccess && (
                <>
                  The symbol <strong>{upperSymbol}</strong> is not available in
                  your {tier} tier.
                </>
              )}
              {hasSymbolAccess && !hasTimeframeAccess && (
                <>
                  The <strong>{upperTimeframe}</strong> timeframe is not
                  available in your {tier} tier.
                </>
              )}
            </p>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 mb-2">
                Your {tier} tier includes:
              </p>
              <div className="flex justify-around text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {tier === 'PRO' ? 15 : 5}
                  </p>
                  <p className="text-xs text-gray-500">symbols</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {tier === 'PRO' ? 9 : 3}
                  </p>
                  <p className="text-xs text-gray-500">timeframes</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Link
                href="/pricing"
                className="block w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Upgrade to PRO - $29/month
              </Link>
              <Link
                href="/charts"
                className="block w-full px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              >
                Choose Available Chart
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Access granted - show chart
  return (
    <div className="space-y-6">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/charts"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <span className="mr-1">←</span> Charts
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {upperSymbol}
            <span className="text-gray-400 mx-2">/</span>
            <span className="text-gray-600">{upperTimeframe}</span>
          </h1>
        </div>
        <span className="px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">
          {tier}
        </span>
      </div>

      {/* Chart Controls */}
      <ChartControls
        userTier={tier}
        selectedSymbol={upperSymbol}
        selectedTimeframe={upperTimeframe}
      />

      {/* Trading Chart */}
      <TradingChart
        symbol={upperSymbol}
        timeframe={upperTimeframe}
        tier={tier}
      />
    </div>
  );
}

/**
 * Generate static params for static generation
 * (Optional - generates pages for all valid combinations)
 */
export function generateStaticParams(): Array<{
  symbol: string;
  timeframe: string;
}> {
  // Only pre-generate FREE tier combinations for faster build
  const combinations: Array<{ symbol: string; timeframe: string }> = [];

  for (const symbol of FREE_SYMBOLS) {
    for (const timeframe of FREE_TIMEFRAMES) {
      combinations.push({
        symbol: symbol.toLowerCase(),
        timeframe: timeframe.toLowerCase(),
      });
    }
  }

  return combinations;
}
