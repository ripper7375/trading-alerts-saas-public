/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: ApiError;
  message?: string;
}

/**
 * API error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  field?: string; // For validation errors
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Error response from API
 */
export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path?: string;
  validationErrors?: ValidationError[];
}

/**
 * Success response with message
 */
export interface SuccessResponse {
  success: true;
  message: string;
  data?: unknown;
}

/**
 * Generic filter parameters
 */
export interface FilterParams {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  [key: string]: string | number | boolean | undefined;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MARKET DATA RESPONSES (V8 — market_data_v6, no tier filtering)
//
// Both tiers receive identical data: all market_data_v6 columns for
// XAUUSD M5/M15. The old ColumnAccessInfo / IndicatorAccessInfo /
// TierUpgradePrompt types were removed — column/indicator gating no
// longer exists.
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import type { Tier, Symbol, Timeframe } from './tier';
import type { MarketDataV6 } from './indicator';

/**
 * Market data response — identical shape for both tiers
 */
export interface MarketDataResponse {
  symbol: Symbol;
  timeframe: Timeframe;
  tier: Tier;
  data: MarketDataV6[];
  metadata: {
    total: number;
    returned: number;
  };
}
