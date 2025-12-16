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
 * Available indicator types from MT5 service
 */
const INDICATOR_TYPES: IndicatorTypeInfo[] = [
  {
    id: 'FRACTAL_HORIZONTAL',
    name: 'Fractal Horizontal Lines',
    description:
      'Horizontal support and resistance lines based on fractal patterns. Shows 3 peak levels and 3 bottom levels.',
    source: 'Fractal Horizontal Line_V5.mq5',
    dataFields: [
      'peak_1',
      'peak_2',
      'peak_3',
      'bottom_1',
      'bottom_2',
      'bottom_3',
    ],
  },
  {
    id: 'FRACTAL_DIAGONAL',
    name: 'Fractal Diagonal Lines',
    description:
      'Diagonal trend lines connecting fractal points. Shows 3 ascending and 3 descending trend lines.',
    source: 'Fractal Diagonal Line_V4.mq5',
    dataFields: [
      'ascending_1',
      'ascending_2',
      'ascending_3',
      'descending_1',
      'descending_2',
      'descending_3',
    ],
  },
  {
    id: 'FRACTALS',
    name: 'Fractal Points',
    description:
      'Bill Williams fractal markers showing swing highs (peaks) and swing lows (bottoms).',
    source: 'Fractal Horizontal Line_V5.mq5 (buffers 0-1)',
    dataFields: ['peaks', 'bottoms'],
  },
  {
    id: 'OHLC',
    name: 'OHLC Candlestick Data',
    description:
      'Open, High, Low, Close price data with volume for each candle.',
    source: 'MT5 Terminal (CopyRates)',
    dataFields: ['time', 'open', 'high', 'low', 'close', 'volume'],
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
