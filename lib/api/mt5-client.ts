/**
 * MT5 API Client
 *
 * Client library for communicating with the MT5 data service.
 * Provides functions for fetching indicator data, health checks,
 * and symbol/timeframe information.
 *
 * Part 7: Indicators API - PRO Indicators Implementation
 */

import type { Timeframe, UserTier } from '@/types/tier';

// ============================================================================
// Constants
// ============================================================================

const MT5_SERVICE_BASE_URL =
  process.env.MT5_SERVICE_URL || 'http://localhost:5000';
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_BARS = 1000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown when MT5 service returns an error response
 */
export class MT5ServiceError extends Error {
  statusCode: number;
  responseBody?: unknown;

  constructor(message: string, statusCode: number, responseBody?: unknown) {
    super(message);
    this.name = 'MT5ServiceError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, MT5ServiceError.prototype);
  }
}

/**
 * Error thrown when user's tier doesn't have access to requested data
 */
export class MT5AccessDeniedError extends Error {
  tier: UserTier;
  accessibleSymbols?: string[];
  accessibleTimeframes?: string[];

  constructor(
    message: string,
    tier: UserTier,
    accessibleSymbols?: string[],
    accessibleTimeframes?: string[]
  ) {
    super(message);
    this.name = 'MT5AccessDeniedError';
    this.tier = tier;
    this.accessibleSymbols = accessibleSymbols;
    this.accessibleTimeframes = accessibleTimeframes;

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, MT5AccessDeniedError.prototype);
  }
}

// ============================================================================
// Types
// ============================================================================

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

export interface MT5SymbolsResponse {
  success: boolean;
  tier: UserTier;
  symbols: string[];
}

export interface MT5TimeframesResponse {
  success: boolean;
  tier: UserTier;
  timeframes: Timeframe[];
}

export interface OHLCBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface HorizontalTrendlines {
  peak_1: Array<{ time: number; price: number }>;
  peak_2: Array<{ time: number; price: number }>;
  peak_3: Array<{ time: number; price: number }>;
  bottom_1: Array<{ time: number; price: number }>;
  bottom_2: Array<{ time: number; price: number }>;
  bottom_3: Array<{ time: number; price: number }>;
}

export interface DiagonalTrendlines {
  ascending_1: Array<{
    start_time: number;
    end_time: number;
    start_price: number;
    end_price: number;
  }>;
  ascending_2: Array<{
    start_time: number;
    end_time: number;
    start_price: number;
    end_price: number;
  }>;
  ascending_3: Array<{
    start_time: number;
    end_time: number;
    start_price: number;
    end_price: number;
  }>;
  descending_1: Array<{
    start_time: number;
    end_time: number;
    start_price: number;
    end_price: number;
  }>;
  descending_2: Array<{
    start_time: number;
    end_time: number;
    start_price: number;
    end_price: number;
  }>;
  descending_3: Array<{
    start_time: number;
    end_time: number;
    start_price: number;
    end_price: number;
  }>;
}

export interface FractalsData {
  peaks: Array<{ time: number; price: number }>;
  bottoms: Array<{ time: number; price: number }>;
}

export interface IndicatorMetadata {
  symbol: string;
  timeframe: Timeframe;
  tier: UserTier;
  bars_returned: number;
}

export interface MT5IndicatorData {
  ohlc: OHLCBar[];
  horizontal: HorizontalTrendlines;
  diagonal: DiagonalTrendlines;
  fractals: FractalsData;
  metadata: IndicatorMetadata;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create fetch request with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Check if error is retryable (5xx server errors)
 */
function isRetryableError(status: number): boolean {
  return status >= 500 && status < 600;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make request with retry logic
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options);

      // Don't retry client errors (4xx)
      if (!response.ok && !isRetryableError(response.status)) {
        return response;
      }

      // Retry server errors (5xx)
      if (!response.ok && isRetryableError(response.status)) {
        if (attempt < retries - 1) {
          await sleep(RETRY_DELAY * (attempt + 1));
          continue;
        }
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      if (attempt < retries - 1) {
        await sleep(RETRY_DELAY * (attempt + 1));
      }
    }
  }

  throw lastError || new Error('Request failed after retries');
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Check MT5 service health
 */
export async function checkMT5Health(): Promise<MT5HealthResponse> {
  const url = `${MT5_SERVICE_BASE_URL}/api/health`;

  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new MT5ServiceError(
      body.error || `Health check failed with status ${response.status}`,
      response.status,
      body
    );
  }

  return response.json();
}

/**
 * Get available symbols for a tier
 */
export async function getMT5Symbols(
  tier: UserTier
): Promise<MT5SymbolsResponse> {
  const url = `${MT5_SERVICE_BASE_URL}/api/symbols`;

  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Tier': tier,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new MT5ServiceError(
      body.error || `Failed to fetch symbols with status ${response.status}`,
      response.status,
      body
    );
  }

  return response.json();
}

/**
 * Get available timeframes for a tier
 */
export async function getMT5Timeframes(
  tier: UserTier
): Promise<MT5TimeframesResponse> {
  const url = `${MT5_SERVICE_BASE_URL}/api/timeframes`;

  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Tier': tier,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new MT5ServiceError(
      body.error || `Failed to fetch timeframes with status ${response.status}`,
      response.status,
      body
    );
  }

  return response.json();
}

/**
 * Fetch indicator data for a symbol and timeframe
 */
export async function fetchIndicatorData(
  symbol: string,
  timeframe: Timeframe,
  tier: UserTier,
  bars: number = DEFAULT_BARS
): Promise<MT5IndicatorData> {
  const url = `${MT5_SERVICE_BASE_URL}/api/indicators/${symbol}/${timeframe}?bars=${bars}`;

  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Tier': tier,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));

    // Handle access denied (403)
    if (response.status === 403) {
      throw new MT5AccessDeniedError(
        body.error || 'Access denied',
        body.tier || tier,
        body.accessible_symbols,
        body.accessible_timeframes
      );
    }

    throw new MT5ServiceError(
      body.error ||
        `Failed to fetch indicator data with status ${response.status}`,
      response.status,
      body
    );
  }

  const result = await response.json();

  // Check for success: false in response
  if (result.success === false) {
    throw new MT5ServiceError(
      result.error || 'Failed to fetch indicator data',
      500,
      result
    );
  }

  // Validate response has data
  if (!result.data) {
    throw new MT5ServiceError('Response missing data field', 500, result);
  }

  return result.data;
}

/**
 * Check if MT5 service is available
 */
export async function isMT5ServiceAvailable(): Promise<boolean> {
  try {
    const health = await checkMT5Health();
    return health.status === 'ok' || health.status === 'degraded';
  } catch {
    return false;
  }
}
