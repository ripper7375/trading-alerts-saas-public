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
