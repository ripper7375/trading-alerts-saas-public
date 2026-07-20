//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MARKET DATA V6 — UNIFIED SCHEMA (V8 ARCHITECTURE)
//
// Both tiers have identical access to ALL columns of the
// market_data_v6 table (79 fields). Mirrors prisma MarketDataV6,
// which itself mirrors gateway_contract_market_data.schema.json.
// The old per-tier column interfaces (FreeMarketData /
// CompleteMarketData, 63-column schema) were removed with the
// decommissioned MarketData model.
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * One centroid-regression variant block (8 columns).
 * Six variants exist: best_fit, cherry_a, cherry_b, most_recent, non_a, non_b.
 */
export interface CentroidVariantColumns {
  horiz_high_map: number | null;
  horiz_low_map: number | null;
  ssa: number | null;
  ema_ssa: number | null;
  crossing: number | null;
  base_fl: number | null;
  uoedt: number | null;
  loedt: number | null;
}

/**
 * The six centroid-regression variant prefixes in market_data_v6
 */
export const CENTROID_VARIANTS = [
  'best_fit',
  'cherry_a',
  'cherry_b',
  'most_recent',
  'non_a',
  'non_b',
] as const;

export type CentroidVariant = (typeof CENTROID_VARIANTS)[number];

/**
 * Complete market_data_v6 row — all 79 fields, available to BOTH tiers.
 * Field names/types are a 1:1 mirror of prisma's MarketDataV6 model.
 */
export interface MarketDataV6 {
  id: string;
  terminal_id: string;
  timestamp: number;
  symbol: string;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;

  // Centroid-regression variant: best_fit
  best_fit_horiz_high_map: number | null;
  best_fit_horiz_low_map: number | null;
  best_fit_ssa: number | null;
  best_fit_ema_ssa: number | null;
  best_fit_crossing: number | null;
  best_fit_base_fl: number | null;
  best_fit_uoedt: number | null;
  best_fit_loedt: number | null;

  // Centroid-regression variant: cherry_a
  cherry_a_horiz_high_map: number | null;
  cherry_a_horiz_low_map: number | null;
  cherry_a_ssa: number | null;
  cherry_a_ema_ssa: number | null;
  cherry_a_crossing: number | null;
  cherry_a_base_fl: number | null;
  cherry_a_uoedt: number | null;
  cherry_a_loedt: number | null;

  // Centroid-regression variant: cherry_b
  cherry_b_horiz_high_map: number | null;
  cherry_b_horiz_low_map: number | null;
  cherry_b_ssa: number | null;
  cherry_b_ema_ssa: number | null;
  cherry_b_crossing: number | null;
  cherry_b_base_fl: number | null;
  cherry_b_uoedt: number | null;
  cherry_b_loedt: number | null;

  // Centroid-regression variant: most_recent
  most_recent_horiz_high_map: number | null;
  most_recent_horiz_low_map: number | null;
  most_recent_ssa: number | null;
  most_recent_ema_ssa: number | null;
  most_recent_crossing: number | null;
  most_recent_base_fl: number | null;
  most_recent_uoedt: number | null;
  most_recent_loedt: number | null;

  // Centroid-regression variant: non_a
  non_a_horiz_high_map: number | null;
  non_a_horiz_low_map: number | null;
  non_a_ssa: number | null;
  non_a_ema_ssa: number | null;
  non_a_crossing: number | null;
  non_a_base_fl: number | null;
  non_a_uoedt: number | null;
  non_a_loedt: number | null;

  // Centroid-regression variant: non_b
  non_b_horiz_high_map: number | null;
  non_b_horiz_low_map: number | null;
  non_b_ssa: number | null;
  non_b_ema_ssa: number | null;
  non_b_crossing: number | null;
  non_b_base_fl: number | null;
  non_b_uoedt: number | null;
  non_b_loedt: number | null;

  // Fractal EDT + single best lines (calculated)
  fractal_best_fl: number | null;
  fractal_uoedt: number | null;
  fractal_loedt: number | null;
  best_resistance: number | null;
  best_support: number | null;

  // Z-Score candle (calculated)
  body_direction: number | null; // -1, 0, 1
  body_size: number | null; // |z-score|
  body_classification: number | null; // 0-5

  // ZigZag (pivot = admin layer; metrics + category calculated)
  zigzag_point_type: string | null; // "Peak" | "Bottom"
  zigzag_current_point: number | null;
  zigzag_price_change: number | null;
  zigzag_pct_change: number | null;
  zigzag_pct_change_class: number | null;
  zigzag_bars: number | null;
  zigzag_bars_class: number | null;
  zigzag_price_per_bar: number | null;
  zigzag_price_per_bar_class: number | null;
  zigzag_slope: number | null;
  zigzag_category: string | null; // HH | HL | LH | LL | EQH | EQL

  // Provenance
  cycle_id: number | null;
  collected_at: number | null;
  calculated_at: number | null;

  createdAt: Date | string;
  updatedAt: Date | string;
}
// V8 migration: unified market_data_v6 typing — see prisma/market-data/schema.prisma
