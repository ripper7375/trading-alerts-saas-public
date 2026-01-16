/**
 * Indicators List API Route
 *
 * GET /api/indicators
 * Returns list of available indicator types and their descriptions.
 *
 * @module app/api/indicators/route
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface IndicatorTypeInfo {
  id: string;
  name: string;
  description: string;
  source: string;
  dataFields: string[];
}

interface IndicatorsListResponse {
  success: boolean;
  indicators: IndicatorTypeInfo[];
  count: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INDICATOR DEFINITIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Available indicator types - 57-Column Database Schema
 *
 * Data source: PostgreSQL database via Part 20 (SQLite-Sync Script)
 *
 * FREE tier: 2 indicator groups (16 columns)
 * PRO tier: 8 indicator groups total (49 columns + 8 system columns = 57 total)
 */
const INDICATOR_TYPES: IndicatorTypeInfo[] = [
  // ========================================
  // FREE TIER INDICATORS (2 groups)
  // ========================================
  {
    id: 'FRACTAL_DIAGONAL',
    name: 'Fractal Diagonal Lines',
    description:
      'Dynamic trendlines based on fractal analysis. Shows 3 ascending and 3 descending trend lines with mapping data.',
    source: 'Part 20 SQLite-Sync (57-column schema)',
    dataFields: [
      'diag_asc_line_1',
      'diag_asc_line_2',
      'diag_asc_line_3',
      'diag_desc_line_1',
      'diag_desc_line_2',
      'diag_desc_line_3',
      'diag_high_map',
      'diag_low_map',
    ],
  },
  {
    id: 'FRACTAL_HORIZONTAL',
    name: 'Fractal Horizontal Lines',
    description:
      'Horizontal support and resistance levels from fractals. Shows 3 peak levels and 3 bottom levels with mapping data.',
    source: 'Part 20 SQLite-Sync (57-column schema)',
    dataFields: [
      'horiz_peak_line_1',
      'horiz_peak_line_2',
      'horiz_peak_line_3',
      'horiz_bottom_line_1',
      'horiz_bottom_line_2',
      'horiz_bottom_line_3',
      'horiz_high_map',
      'horiz_low_map',
    ],
  },

  // ========================================
  // PRO TIER INDICATORS (6 groups)
  // ========================================
  {
    id: 'MOVING_AVERAGES',
    name: 'Moving Averages (TEMA/HRMA/SMMA)',
    description:
      'Three advanced moving averages: Triple Exponential (TEMA), Hull-like Responsive (HRMA), and Smoothed (SMMA).',
    source: 'Part 20 SQLite-Sync (57-column schema)',
    dataFields: ['tema', 'hrma', 'smma'],
  },
  {
    id: 'BODY_MOMENTUM',
    name: 'Body Size Momentum',
    description:
      'Candle body size analysis with Z-score classification. Identifies normal, large, and extreme body sizes.',
    source: 'Part 20 SQLite-Sync (57-column schema)',
    dataFields: ['z_score_of_body_size', 'candle_classification'],
  },
  {
    id: 'HEIKEN_ASHI',
    name: 'Heiken Ashi',
    description:
      'Smoothed candlesticks with body size classification. Includes OHLC data, classification, and Z-score analysis.',
    source: 'Part 20 SQLite-Sync (57-column schema)',
    dataFields: [
      'ha_open',
      'ha_high',
      'ha_low',
      'ha_close',
      'ha_classification',
      'ha_body_size',
      'ha_body_zscore',
    ],
  },
  {
    id: 'KELTNER_CHANNELS',
    name: 'Keltner Channels',
    description:
      '10-band ATR-based volatility channel system. From ultra-extreme to middle bands, both upper and lower.',
    source: 'Part 20 SQLite-Sync (57-column schema)',
    dataFields: [
      'kc_ultra_extreme_upper',
      'kc_extreme_upper',
      'kc_uppermost',
      'kc_upper',
      'kc_upper_middle',
      'kc_lower_middle',
      'kc_lower',
      'kc_lowermost',
      'kc_extreme_lower',
      'kc_ultra_extreme_lower',
    ],
  },
  {
    id: 'SUPPORT_RESISTANCE',
    name: 'Support & Resistance',
    description:
      'Fractal-based support and resistance levels. 4 support levels and 4 resistance levels.',
    source: 'Part 20 SQLite-Sync (57-column schema)',
    dataFields: [
      'sr_support_1',
      'sr_support_2',
      'sr_support_3',
      'sr_support_4',
      'sr_resistance_1',
      'sr_resistance_2',
      'sr_resistance_3',
      'sr_resistance_4',
    ],
  },
  {
    id: 'ZIGZAG',
    name: 'ZigZag + EMA',
    description:
      'Market structure with swing highs/lows and EMA trend. Identifies peaks, bottoms, and includes 26-period EMA.',
    source: 'Part 20 SQLite-Sync (57-column schema)',
    dataFields: ['zigzag_peak', 'zigzag_bottom', 'ema_26'],
  },

  // ========================================
  // SYSTEM DATA (8 columns)
  // ========================================
  {
    id: 'OHLC',
    name: 'System Columns (OHLCV)',
    description:
      'Core market data: timestamp, open, high, low, close, volume, timeframe, and collection timestamp.',
    source: 'MT5 Terminal via Part 06 (copy_rates_from_pos)',
    dataFields: [
      'timestamp',
      'open',
      'high',
      'low',
      'close',
      'volume',
      'timeframe',
      'collected_at',
    ],
  },
];

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET HANDLER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/indicators
 *
 * Returns list of available indicator types with descriptions.
 * This endpoint provides metadata about what indicator data is available
 * from the Flask MT5 service.
 *
 * @returns 200: List of indicator types
 * @returns 401: Unauthorized (not logged in)
 * @returns 500: Internal server error
 *
 * @example Response:
 * {
 *   "success": true,
 *   "indicators": [
 *     {
 *       "id": "FRACTAL_HORIZONTAL",
 *       "name": "Fractal Horizontal Lines",
 *       "description": "...",
 *       "source": "Fractal Horizontal Line_V5.mq5",
 *       "dataFields": ["peak_1", "peak_2", ...]
 *     },
 *     ...
 *   ],
 *   "count": 4
 * }
 */
export async function GET(): Promise<NextResponse> {
  try {
    //───────────────────────────────────────────────────────
    // STEP 1: Authentication Check
    //───────────────────────────────────────────────────────
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'You must be logged in to view indicator types',
        },
        { status: 401 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 2: Build Response
    //───────────────────────────────────────────────────────
    const response: IndicatorsListResponse = {
      success: true,
      indicators: INDICATOR_TYPES,
      count: INDICATOR_TYPES.length,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    //───────────────────────────────────────────────────────
    // Error Handling
    //───────────────────────────────────────────────────────
    console.error('GET /api/indicators error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch indicator types',
        message:
          'An error occurred while fetching indicator types. Please try again.',
      },
      { status: 500 }
    );
  }
}
