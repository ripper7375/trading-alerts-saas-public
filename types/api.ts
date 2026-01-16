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
// TIER-AWARE MARKET DATA RESPONSES (57-COLUMN SCHEMA)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import type { Tier, Symbol, Timeframe } from './tier';
import type { CompleteMarketData, FreeMarketData } from './indicator';

/**
 * Market data response - automatically filtered by user's tier
 */
export interface MarketDataResponse {
  symbol: Symbol;
  timeframe: Timeframe;
  tier: Tier;
  data: CompleteMarketData[] | FreeMarketData[]; // Type depends on tier
  filteredColumns?: string[]; // Which columns were removed (for FREE tier)
  metadata: {
    total: number;
    returned: number;
    columnCount: number; // 24 for FREE, 57 for PRO
  };
}

/**
 * Indicator access info for tier upgrade prompts
 */
export interface IndicatorAccessInfo {
  indicator: string;
  accessible: boolean;
  tier: Tier;
  requiredTier?: Tier;
  columns: string[];
  description: string;
  label: string;
}

/**
 * Column access info for tier upgrade prompts
 */
export interface ColumnAccessInfo {
  columnName: string;
  accessible: boolean;
  tier: Tier;
  requiredTier?: Tier;
  indicator: string;
  description: string;
}

/**
 * Tier upgrade prompt response
 */
export interface TierUpgradePrompt {
  upgradeRequired: boolean;
  currentTier: Tier;
  lockedIndicators: string[];
  lockedColumns: string[];
  accessibleIndicators: string[];
  accessibleColumns: string[];
  message: string;
}
