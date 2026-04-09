// data/mockData.ts
// Throwaway prototype mock data — hardcoded payloads matching production API shapes.
// Replace with real API calls (NestJS Controller) when wiring to backend.
//
// Prices: XAUUSD around 4700
// Base timestamp: April 8, 2026 ~09:00 UTC = 1775606400
// M5 = 300 seconds per bar
// 100 bars = ~8.3 hours of data

import type { CandlestickData, UTCTimestamp } from 'lightweight-charts';

import type {
  HeatmapApiResponse,
  HeatZone,
  SSADataPoint,
  FractalPoint,
  TrendlineSegment,
} from '@/types/heatmap';

// ── Timestamp baseline ────────────────────────────────────────────────────────
const BASE_TS = 1775576400; // Unix seconds — April 8 2026 ~00:00 UTC
const M5_SECS = 300; // 5-minute bar width in seconds

// ── OHLCV — 100 realistic XAUUSD M5 bars ─────────────────────────────────────
// Price oscillates between ~4660 and ~4760 with realistic candle shapes.
function generateOHLCV(): CandlestickData[] {
  const bars: CandlestickData[] = [];
  let close = 4705.5;

  for (let i = 0; i < 100; i++) {
    const t = BASE_TS + i * M5_SECS;

    // Sinusoidal drift + random walk
    const drift = Math.sin(i * 0.18) * 18 + Math.sin(i * 0.07) * 9;
    const noise = (Math.random() - 0.5) * 8;
    const open = close;
    close = Math.max(4640, Math.min(4780, open + drift * 0.12 + noise));

    const range = Math.abs(close - open) * (1 + Math.random() * 1.8);
    const high = Math.max(open, close) + range * 0.4 + Math.random() * 3;
    const low = Math.min(open, close) - range * 0.4 - Math.random() * 3;

    bars.push({
      time: t as UTCTimestamp,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
    });
  }

  return bars;
}

export const MOCK_OHLCV: CandlestickData[] = generateOHLCV();

// ── SSA data — smooth sinusoidal curve over the same 100 bars ─────────────────
function generateSSA(): SSADataPoint[] {
  const pts: SSADataPoint[] = [];
  const closes = MOCK_OHLCV.map((b) => b.close as number);
  const n = closes.length;

  for (let i = 0; i < n; i++) {
    const t = BASE_TS + i * M5_SECS;
    // SSA = smoothed close (simple 8-period rolling average + long sine wave)
    const window8 = closes.slice(Math.max(0, i - 7), i + 1);
    const ma8 = window8.reduce((a, b) => a + b, 0) / window8.length;
    const ssa = ma8 + Math.sin(i * 0.11) * 5;
    // EMA-SSA = faster signal, lags SSA slightly
    const emaSsa = ssa - Math.sin(i * 0.11 + 0.4) * 3;

    pts.push({
      timestamp: t,
      ssa: +ssa.toFixed(2),
      ema_ssa: +emaSsa.toFixed(2),
    });
  }

  return pts;
}

export const MOCK_SSA: SSADataPoint[] = generateSSA();

// ── Fractals — 10 up (code 119) + 10 down (code 108) ─────────────────────────
// Scattered across the 100-bar range; placed on local highs/lows.
function generateFractals(): FractalPoint[] {
  const fractals: FractalPoint[] = [];
  const bars = MOCK_OHLCV;

  // Up fractals (119) at local highs — indices roughly evenly spaced
  const upIdx = [6, 15, 23, 34, 42, 51, 60, 71, 82, 91];
  const downIdx = [10, 19, 27, 38, 46, 55, 65, 74, 85, 94];

  upIdx.forEach((i) => {
    fractals.push({
      timestamp: BASE_TS + i * M5_SECS,
      price: +(bars[i].high + 1.5).toFixed(2), // slightly above high
      type: 119,
    });
  });

  downIdx.forEach((i) => {
    fractals.push({
      timestamp: BASE_TS + i * M5_SECS,
      price: +(bars[i].low - 1.5).toFixed(2), // slightly below low
      type: 108,
    });
  });

  return fractals;
}

export const MOCK_FRACTALS: FractalPoint[] = generateFractals();

// ── Trendlines — golden plots (3 lines) ──────────────────────────────────────
export const MOCK_TRENDLINES: TrendlineSegment[] = [
  // Ascending support line
  {
    startTime: BASE_TS + 5 * M5_SECS,
    startPrice: 4672.5,
    endTime: BASE_TS + 85 * M5_SECS,
    endPrice: 4718.2,
  },
  // Descending resistance line
  {
    startTime: BASE_TS + 10 * M5_SECS,
    startPrice: 4752.3,
    endTime: BASE_TS + 90 * M5_SECS,
    endPrice: 4724.0,
  },
  // Horizontal congestion zone
  {
    startTime: BASE_TS + 20 * M5_SECS,
    startPrice: 4700.0,
    endTime: BASE_TS + 80 * M5_SECS,
    endPrice: 4700.0,
  },
];

// ── Heat zones — KDE blob polygons ───────────────────────────────────────────
// One high-intensity (red-orange) + one medium-intensity (amber) polygon blob.
// Polygons are closed: first point === last point (guaranteed by Python backend).
function makePolygon(
  centerTs: number,
  centerPrice: number,
  tsRadius: number,
  priceRadius: number,
  points = 12
): [number, number][] {
  const poly: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const ts = centerTs + Math.cos(angle) * tsRadius;
    const price = centerPrice + Math.sin(angle) * priceRadius;
    poly.push([Math.round(ts), +price.toFixed(2)]);
  }
  // Ensure closed polygon
  poly[points] = [...poly[0]];
  return poly;
}

export const MOCK_HEAT_ZONES: HeatZone[] = [
  {
    id: 'zone_high_XAUUSD_M5_4748',
    intensity: 'high',
    color: 'rgba(255, 69, 0, 0.38)',
    polygon: makePolygon(
      BASE_TS + 60 * M5_SECS, // centered around bar 60
      4748.0, // near upper sandwich
      8 * M5_SECS, // ~8 bars wide
      14 // ±14 price points tall
    ),
  },
  {
    id: 'zone_med_XAUUSD_M5_4680',
    intensity: 'medium',
    color: 'rgba(234, 179, 8, 0.28)',
    polygon: makePolygon(BASE_TS + 35 * M5_SECS, 4680.0, 10 * M5_SECS, 18),
  },
];

// ── Master HeatmapApiResponse mock ────────────────────────────────────────────
export const MOCK_HEATMAP_PAYLOAD: HeatmapApiResponse = {
  status: 'success',
  symbol: 'XAUUSD',
  timeframe: 'M5',
  last_updated: BASE_TS + 99 * M5_SECS,

  // Index values (spec: active_hmi: 85, active_rpi: 72, active_bpi: 61)
  active_hmi: 85,
  active_hmi_type: 'Resistance',
  active_rpi: 72,
  active_rpi_type: 'Resistance',
  active_bpi: 61,
  active_bpi_type: 'Resistance Breakout',

  distance_to_active: 4.25,
  entropy: 0.42,
  ssa_regime: 'Transition',

  // Sandwich prices (spec values)
  upper_sandwich_price: 4747.7,
  lower_sandwich_price: 4666.96,

  data: {
    heat_zones: MOCK_HEAT_ZONES,
    ssa_data: MOCK_SSA,
    fractals: MOCK_FRACTALS,
    trendlines: MOCK_TRENDLINES,
  },
};
