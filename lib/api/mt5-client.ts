/**
 * MT5 Flask Service Client
 *
 * HTTP client for communicating with the Flask MT5 service.
 * Handles indicator data fetching with retry logic and error handling.
 *
 * @module lib/api/mt5-client
 */

import type { Tier } from '@/types/tier';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIGURATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * MT5 Service URL - defaults to localhost:5001 in development
 */
const MT5_SERVICE_URL =
  process.env['MT5_SERVICE_URL'] || 'http://localhost:5001';

/**
 * API key for authenticating with MT5 service
 */
const MT5_API_KEY = process.env['MT5_API_KEY'] || '';

/**
 * Request timeout in milliseconds
 */
const REQUEST_TIMEOUT = 30000; // 30 seconds

/**
 * Maximum retry attempts for failed requests
 */
const MAX_RETRIES = 3;

/**
 * Base delay between retries in milliseconds (exponential backoff)
 */
const RETRY_BASE_DELAY = 1000;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * OHLC bar data from MT5
 */
export interface OHLCBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Line point for horizontal/diagonal lines
 */
export interface LinePoint {
  index: number;
  value: number;
}

/**
 * Fractal point
 */
export interface FractalPoint {
  time: number;
  price: number;
}

/**
 * Horizontal lines data
 */
export interface HorizontalLines {
  peak_1: LinePoint[];
  peak_2: LinePoint[];
  peak_3: LinePoint[];
  bottom_1: LinePoint[];
  bottom_2: LinePoint[];
  bottom_3: LinePoint[];
}

/**
 * Diagonal lines data
 */
export interface DiagonalLines {
  ascending_1: LinePoint[];
  ascending_2: LinePoint[];
  ascending_3: LinePoint[];
  descending_1: LinePoint[];
  descending_2: LinePoint[];
  descending_3: LinePoint[];
}

/**
 * Fractals data
 */
export interface Fractals {
  peaks: FractalPoint[];
  bottoms: FractalPoint[];
}

/**
 * Indicator metadata
 */
export interface IndicatorMetadata {
  symbol: string;
  timeframe: string;
  tier: Tier;
  bars_returned: number;
}

/**
 * PRO indicator data from MT5 (raw format from Flask)
 */
export interface MT5ProIndicators {
  momentum_candles?: Array<{
    index: number;
    type: number;
    zscore: number;
  }>;
  keltner_channels?: {
    ultra_extreme_upper: (number | null)[];
    extreme_upper: (number | null)[];
    upper_most: (number | null)[];
    upper: (number | null)[];
    upper_middle: (number | null)[];
    lower_middle: (number | null)[];
    lower: (number | null)[];
    lower_most: (number | null)[];
    extreme_lower: (number | null)[];
    ultra_extreme_lower: (number | null)[];
  };
  tema?: (number | null)[];
  hrma?: (number | null)[];
  smma?: (number | null)[];
  zigzag?: {
    peaks: Array<{ index: number; price: number; timestamp?: number }>;
    bottoms: Array<{ index: number; price: number; timestamp?: number }>;
  };
}

/**
 * Complete indicator data from MT5
 */
export interface MT5IndicatorData {
  ohlc: OHLCBar[];
  horizontal: HorizontalLines;
  diagonal: DiagonalLines;
  fractals: Fractals;
  proIndicators?: MT5ProIndicators;
  metadata: IndicatorMetadata;
}

/**
 * MT5 service response wrapper
 */
export interface MT5Response<T> {
  success: boolean;
  data?: T;
  error?: string;
  tier?: Tier;
  accessible_symbols?: string[];
  accessible_timeframes?: string[];
  upgrade_required?: boolean;
}

/**
 * Health check response from MT5 service
 */
export interface MT5HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  total_terminals: number;
  connected_terminals: number;
  terminals: Record<
    string,
    {
      connected: boolean;
      terminal_id: string;
      last_check: string;
      error?: string;
    }
  >;
}

/**
 * Symbols response from MT5 service
 */
export interface MT5SymbolsResponse {
  success: boolean;
  tier: Tier;
  symbols: string[];
}

/**
 * Timeframes response from MT5 service
 */
export interface MT5TimeframesResponse {
  success: boolean;
  tier: Tier;
  timeframes: string[];
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CUSTOM ERRORS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Error thrown when MT5 service request fails
 */
export class MT5ServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody?: unknown
  ) {
    super(message);
    this.name = 'MT5ServiceError';
  }
}

/**
 * Error thrown when tier access is denied
 */
export class MT5AccessDeniedError extends Error {
  constructor(
    message: string,
    public tier: Tier,
    public accessibleSymbols?: string[],
    public accessibleTimeframes?: string[]
  ) {
    super(message);
    this.name = 'MT5AccessDeniedError';
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create headers for MT5 service requests
 */
function createHeaders(tier: Tier): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-User-Tier': tier,
  };

  if (MT5_API_KEY) {
    headers['X-API-Key'] = MT5_API_KEY;
  }

  return headers;
}

/**
 * Make HTTP request to MT5 service with retry logic
 */
async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      // Handle error responses
      if (!response.ok) {
        // Check for access denied (403)
        if (response.status === 403 && data.upgrade_required) {
          throw new MT5AccessDeniedError(
            data.error || 'Access denied',
            data.tier || 'FREE',
            data.accessible_symbols,
            data.accessible_timeframes
          );
        }

        throw new MT5ServiceError(
          data.error || `Request failed with status ${response.status}`,
          response.status,
          data
        );
      }

      return data as T;
    } catch (error) {
      lastError = error as Error;

      // Don't retry for access denied errors
      if (error instanceof MT5AccessDeniedError) {
        throw error;
      }

      // Don't retry for 4xx errors (client errors)
      if (
        error instanceof MT5ServiceError &&
        error.statusCode >= 400 &&
        error.statusCode < 500
      ) {
        throw error;
      }

      // Retry for network errors and 5xx errors
      if (attempt < retries) {
        const delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('Request failed after retries');
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CLIENT FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check MT5 service health status
 *
 * @returns Health response with terminal status
 * @throws MT5ServiceError if service is unavailable
 *
 * @example
 * ```typescript
 * const health = await checkMT5Health();
 * if (health.status === 'ok') {
 *   console.log('All terminals connected');
 * }
 * ```
 */
export async function checkMT5Health(): Promise<MT5HealthResponse> {
  const url = `${MT5_SERVICE_URL}/api/health`;

  return fetchWithRetry<MT5HealthResponse>(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Get symbols accessible by a tier from MT5 service
 *
 * @param tier - User tier (FREE or PRO)
 * @returns List of accessible symbols
 * @throws MT5ServiceError if request fails
 *
 * @example
 * ```typescript
 * const response = await getMT5Symbols('FREE');
 * console.log(response.symbols); // ['BTCUSD', 'EURUSD', ...]
 * ```
 */
export async function getMT5Symbols(tier: Tier): Promise<MT5SymbolsResponse> {
  const url = `${MT5_SERVICE_URL}/api/symbols`;

  return fetchWithRetry<MT5SymbolsResponse>(url, {
    method: 'GET',
    headers: createHeaders(tier),
  });
}

/**
 * Get timeframes accessible by a tier from MT5 service
 *
 * @param tier - User tier (FREE or PRO)
 * @returns List of accessible timeframes
 * @throws MT5ServiceError if request fails
 *
 * @example
 * ```typescript
 * const response = await getMT5Timeframes('PRO');
 * console.log(response.timeframes); // ['M5', 'M15', 'M30', ...]
 * ```
 */
export async function getMT5Timeframes(
  tier: Tier
): Promise<MT5TimeframesResponse> {
  const url = `${MT5_SERVICE_URL}/api/timeframes`;

  return fetchWithRetry<MT5TimeframesResponse>(url, {
    method: 'GET',
    headers: createHeaders(tier),
  });
}

/**
 * Fetch indicator data from MT5 service
 *
 * This is the main function for retrieving chart data with indicators.
 * It validates tier access on the Flask side before returning data.
 *
 * @param symbol - Trading symbol (e.g., 'XAUUSD')
 * @param timeframe - Chart timeframe (e.g., 'H1')
 * @param tier - User tier for access validation
 * @param bars - Number of bars to retrieve (default: 1000)
 * @returns Indicator data including OHLC, lines, and fractals
 * @throws MT5AccessDeniedError if tier cannot access symbol/timeframe
 * @throws MT5ServiceError if service request fails
 *
 * @example
 * ```typescript
 * try {
 *   const data = await fetchIndicatorData('XAUUSD', 'H1', 'FREE', 500);
 *   console.log(`Received ${data.ohlc.length} bars`);
 * } catch (error) {
 *   if (error instanceof MT5AccessDeniedError) {
 *     console.log('Upgrade required:', error.accessibleSymbols);
 *   }
 * }
 * ```
 */
export async function fetchIndicatorData(
  symbol: string,
  timeframe: string,
  tier: Tier,
  bars = 1000
): Promise<MT5IndicatorData> {
  const url = `${MT5_SERVICE_URL}/api/indicators/${symbol}/${timeframe}?bars=${bars}`;

  const response = await fetchWithRetry<MT5Response<MT5IndicatorData>>(url, {
    method: 'GET',
    headers: createHeaders(tier),
  });

  if (!response.success || !response.data) {
    throw new MT5ServiceError(
      response.error || 'Failed to fetch indicator data',
      500
    );
  }

  return response.data;
}

/**
 * Check if MT5 service is available
 *
 * @returns True if service is reachable and healthy
 *
 * @example
 * ```typescript
 * const available = await isMT5ServiceAvailable();
 * if (!available) {
 *   console.log('MT5 service is down');
 * }
 * ```
 */
export async function isMT5ServiceAvailable(): Promise<boolean> {
  try {
    const health = await checkMT5Health();
    return health.status !== 'error';
  } catch {
    return false;
  }
}
