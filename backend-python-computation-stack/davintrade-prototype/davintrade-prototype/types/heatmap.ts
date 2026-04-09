// types/heatmap.ts
// Aligned with davintrade-heatmap-expansion-stack-v2.md Section 6 TypeScript interfaces

export interface HeatZone {
  id: string;
  intensity: 'high' | 'medium' | 'low';
  color: string; // e.g. "rgba(255, 69, 0, 0.45)"
  polygon: [number, number][]; // [unix_seconds, price] — closed (first === last)
}

export interface SSADataPoint {
  timestamp: number; // Unix seconds
  ssa: number;
  ema_ssa: number;
}

export interface FractalPoint {
  timestamp: number; // Unix seconds
  price: number;
  type: 108 | 119; // 108 = fractal low ▼, 119 = fractal high ▲
}

export interface TrendlineSegment {
  startTime: number; // Unix seconds
  startPrice: number;
  endTime: number; // Unix seconds
  endPrice: number;
}

export interface SandwichPrices {
  upper: number; // upper_sandwich_price from API payload
  lower: number; // lower_sandwich_price from API payload
}

export interface HeatmapApiResponse {
  status: 'success' | 'pending';
  symbol: string;
  timeframe: string;
  last_updated: number;
  active_hmi: number;
  active_hmi_type: string;
  active_rpi: number;
  active_rpi_type: string;
  active_bpi: number;
  active_bpi_type: string;
  distance_to_active: number;
  entropy: number;
  ssa_regime: 'Trend' | 'Transition' | 'Chaotic';
  upper_sandwich_price: number;
  lower_sandwich_price: number;
  data: {
    heat_zones: HeatZone[];
    ssa_data?: SSADataPoint[];
    fractals?: FractalPoint[];
    trendlines?: TrendlineSegment[];
  };
}
