/**
 * Standard API response wrapper
 *
 * @template T - The type of data returned in the response
 * @example
 * // Successful response with user data
 * const response: ApiResponse<User> = {
 *   data: { id: '123', name: 'John', email: 'john@example.com' },
 *   message: 'User fetched successfully'
 * };
 *
 * @example
 * // Error response
 * const errorResponse: ApiResponse<never> = {
 *   error: { code: 'NOT_FOUND', message: 'User not found' }
 * };
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
 *
 * @template T - The type of items in the paginated data array
 * @example
 * // Paginated list of alerts
 * const response: PaginatedResponse<Alert> = {
 *   data: [
 *     { id: '1', symbol: 'EURUSD', ... },
 *     { id: '2', symbol: 'GBPUSD', ... }
 *   ],
 *   pagination: {
 *     page: 1,
 *     limit: 10,
 *     total: 50,
 *     totalPages: 5,
 *     hasNext: true,
 *     hasPrevious: false
 *   }
 * };
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
 * Generic filter parameters for API queries
 *
 * @example
 * // Filter users by date range and status
 * const filters: FilterParams = {
 *   search: 'john',
 *   dateFrom: '2024-01-01',
 *   dateTo: '2024-12-31',
 *   status: 'active',
 *   tier: 'pro'
 * };
 */
export interface FilterParams {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  [key: string]: string | number | boolean | undefined;
}
