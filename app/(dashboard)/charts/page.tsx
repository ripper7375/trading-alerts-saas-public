import Link from 'next/link';
import { redirect } from 'next/navigation';

import { UpgradeButton } from '@/components/ui/upgrade-button';
import { getSession } from '@/lib/auth/session';
import { SYMBOLS, TIMEFRAMES, type Tier } from '@/lib/tier-config';

// Force dynamic rendering since this page uses headers via getSession
export const dynamic = 'force-dynamic';

/**
 * Charts Page — V8 single-symbol architecture
 *
 * Both tiers have identical chart access: XAUUSD on M5 and M15.
 * PRO differentiation (alerts, multi-timeframe visualization, drawing
 * line alerts) is surfaced contextually, not by locking chart data.
 */
export default async function ChartsPage(): Promise<React.JSX.Element> {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const tier = (session.user?.tier as Tier) || 'FREE';

  // Default chart selection
  const defaultSymbol = 'XAUUSD';

  const timeframeLabels: Record<string, string> = {
    M5: '5 Min',
    M15: '15 Min',
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Trading Charts</h1>
        <p className="mt-1 text-sm text-gray-600">
          XAUUSD (Gold) charts on M5 and M15 with full indicator overlays
        </p>
      </div>

      {/* Upgrade Banner for FREE tier */}
      {tier === 'FREE' && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚡</span>
            <div className="flex-1">
              <p className="font-semibold text-amber-900">
                Upgrade to PRO for alerts and advanced tools
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Create up to 100 price alerts, unlock multi-timeframe
                visualization, and set line alerts directly from chart
                drawings.
              </p>
              <UpgradeButton variant="amber" className="mt-2 text-sm" />
            </div>
          </div>
        </div>
      )}

      {/* Chart Selection */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Select a Chart
        </h2>
        <div className="flex flex-wrap gap-3">
          {SYMBOLS.map((symbol) =>
            TIMEFRAMES.map((tf) => (
              <Link
                key={`${symbol}-${tf}`}
                href={`/charts/${symbol}/${tf}`}
                className="block px-6 py-4 text-center rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors min-w-[160px]"
              >
                <span className="font-bold text-lg text-gray-900">
                  {symbol} / {tf}
                </span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  Gold — {timeframeLabels[tf]}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Quick Access */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Quick Access
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              symbol: defaultSymbol,
              timeframe: 'M5',
              label: 'Gold — 5 Minutes (scalping)',
            },
            {
              symbol: defaultSymbol,
              timeframe: 'M15',
              label: 'Gold — 15 Minutes',
            },
          ].map(({ symbol, timeframe, label }) => (
            <Link
              key={`${symbol}-${timeframe}`}
              href={`/charts/${symbol}/${timeframe}`}
              className="block p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <span className="font-bold text-gray-900">
                {symbol}/{timeframe}
              </span>
              <span className="block text-sm text-gray-500 mt-1">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* PRO feature hint */}
      {tier === 'PRO' && (
        <p className="text-sm text-gray-500">
          PRO: use the drawing toolbar on any chart to draw lines and convert
          them into line-touch alerts, or enable multi-timeframe view to
          overlay M5 structure on M15.
        </p>
      )}
    </div>
  );
}
