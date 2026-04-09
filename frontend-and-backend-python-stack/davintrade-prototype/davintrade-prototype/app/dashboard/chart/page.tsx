// app/dashboard/chart/page.tsx
// THROWAWAY PROTOTYPE — uses hardcoded mock data instead of live API calls.
// When wiring to backend: replace mock imports with parallel fetch to NestJS Controller.
// BACKEND_URL = NestJS Controller on Railway — NEVER Python directly.
//
// Production shape (commented out below):
//   GET /api/v1/heatmap/zones?symbol=XAUUSD&timeframe=M5  → next: { revalidate: 300 }
//   GET /api/v1/ohlcv?symbol=XAUUSD&timeframe=M5          → next: { revalidate: 60 }

import { Suspense } from 'react';

import { ChartLoadingSkeleton } from './loading';

import { DualPanelLayout } from '@/components/layout/DualPanelLayout';
import { MOCK_HEATMAP_PAYLOAD, MOCK_OHLCV } from '@/data/mockData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ symbol?: string; timeframe?: string }>;
}

export default async function ChartPage({ searchParams }: PageProps) {
  // Next.js 15+ — searchParams is async
  const params = await searchParams;
  const symbol = params.symbol ?? 'XAUUSD';
  const timeframe = params.timeframe ?? 'M5';

  // ── PROTOTYPE: use mock data ─────────────────────────────────────────────
  // To swap in real API data, replace the two lines below with:
  //
  //   const BACKEND_URL = process.env.BACKEND_URL; // NestJS Railway URL
  //   const [heatmapRes, ohlcvRes] = await Promise.all([
  //     fetch(`${BACKEND_URL}/api/v1/heatmap/zones?symbol=${symbol}&timeframe=${timeframe}`, {
  //       next: { revalidate: 300 },
  //     }),
  //     fetch(`${BACKEND_URL}/api/v1/ohlcv?symbol=${symbol}&timeframe=${timeframe}`, {
  //       next: { revalidate: 60 },
  //     }),
  //   ]);
  //   const heatmapPayload = await heatmapRes.json() as HeatmapApiResponse;
  //   const ohlcvPayload   = await ohlcvRes.json();
  //   const ohlcvData = ohlcvPayload.data;

  const heatmapPayload = {
    ...MOCK_HEATMAP_PAYLOAD,
    symbol,
    timeframe,
  };
  const ohlcvData = MOCK_OHLCV;

  return (
    <Suspense fallback={<ChartLoadingSkeleton />}>
      <DualPanelLayout
        heatmapPayload={heatmapPayload}
        ohlcvData={ohlcvData}
        symbol={symbol}
        timeframe={timeframe}
      />
    </Suspense>
  );
}
