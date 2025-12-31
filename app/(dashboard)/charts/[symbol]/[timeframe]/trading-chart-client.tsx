'use client';

import dynamic from 'next/dynamic';
import type { Tier } from '@/lib/tier-config';

// Dynamic import for TradingChart to reduce initial bundle size
// lightweight-charts library (~200KB) is only loaded when needed
const TradingChart = dynamic(
  () =>
    import('@/components/charts/trading-chart').then((mod) => mod.TradingChart),
  {
    ssr: false, // Client-only component using canvas
    loading: () => (
      <div className="flex items-center justify-center h-[600px] bg-[#1e222d] rounded-lg">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-[#d1d4dc]">Loading chart...</p>
        </div>
      </div>
    ),
  }
);

interface TradingChartClientProps {
  symbol: string;
  timeframe: string;
  tier: Tier;
}

export function TradingChartClient({
  symbol,
  timeframe,
  tier,
}: TradingChartClientProps) {
  return <TradingChart symbol={symbol} timeframe={timeframe} tier={tier} />;
}
