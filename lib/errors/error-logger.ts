/**
 * Error Logging Service
 *
 * Centralized error logging with context information.
 * Supports console logging in development and can be extended
 * for external services (Sentry, LogRocket, etc.) in production.
 */

/**
 * Error context for additional information
 */
export interface ErrorContext {
  userId?: string;
  endpoint?: string;
  method?: string;
  requestId?: string;
  tier?: string;
  [key: string]: unknown;
}

/**
 * Error log entry structure
 */
export interface ErrorLogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info';
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  context?: ErrorContext;
}

/**
 * Log an error with context
 *
 * @param error - The error to log
 * @param context - Additional context information
 */
export function logError(error: unknown, context?: ErrorContext): void {
  const entry = createLogEntry('error', error, context);

  // Always log to console in development
  if (process.env['NODE_ENV'] !== 'production') {
    console.error(JSON.stringify(entry, null, 2));
  } else {
    // In production, log structured JSON
    console.error(JSON.stringify(entry));
  }

  // TODO: Send to external error tracking service
  // sendToSentry(entry);
  // sendToLogRocket(entry);
}

/**
 * Log a warning with context
 *
 * @param message - Warning message
 * @param context - Additional context information
 */
export function logWarning(message: string, context?: ErrorContext): void {
  const entry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    level: 'warn',
    message,
    context,
  };

  if (process.env['NODE_ENV'] !== 'production') {
    console.warn(JSON.stringify(entry, null, 2));
  } else {
    console.warn(JSON.stringify(entry));
  }
}

/**
 * Log info with context
 *
 * @param message - Info message
 * @param context - Additional context information
 */
export function logInfo(message: string, context?: ErrorContext): void {
  const entry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    level: 'info',
    message,
    context,
  };

  // Only log info in development or if explicitly enabled
  if (
    process.env['NODE_ENV'] !== 'production' ||
    process.env['VERBOSE_LOGGING'] === 'true'
  ) {
    console.info(JSON.stringify(entry));
  }
}

/**
 * Create a log entry from an error
 */
function createLogEntry(
  level: 'error' | 'warn' | 'info',
  error: unknown,
  context?: ErrorContext
): ErrorLogEntry {
  const entry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: getErrorMessage(error),
    context,
  };

  if (error instanceof Error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };

    // Include error code if available
    if ('code' in error && typeof error.code === 'string') {
      entry.error.code = error.code;
    }
  } else if (typeof error === 'string') {
    entry.error = {
      name: 'Error',
      message: error,
    };
  }

  return entry;
}

/**
 * Extract error message from unknown error type
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

/**
 * Create a scoped logger with preset context
 *
 * @param baseContext - Context to include in all logs
 * @returns Scoped logger functions
 */
export function createScopedLogger(baseContext: ErrorContext): {
  error: (error: unknown, additionalContext?: ErrorContext) => void;
  warn: (message: string, additionalContext?: ErrorContext) => void;
  info: (message: string, additionalContext?: ErrorContext) => void;
} {
  return {
    error: (error: unknown, additionalContext?: ErrorContext): void => {
      logError(error, { ...baseContext, ...additionalContext });
    },
    warn: (message: string, additionalContext?: ErrorContext): void => {
      logWarning(message, { ...baseContext, ...additionalContext });
    },
    info: (message: string, additionalContext?: ErrorContext): void => {
      logInfo(message, { ...baseContext, ...additionalContext });
    },
  };
}

/**
 * Log API request error with standard context
 *
 * @param error - The error that occurred
 * @param endpoint - API endpoint path
 * @param method - HTTP method
 * @param userId - Optional user ID
 */
export function logAPIError(
  error: unknown,
  endpoint: string,
  method: string,
  userId?: string
): void {
  logError(error, {
    endpoint,
    method,
    userId,
    source: 'api',
  });
}

/**
 * Log database error with query context
 *
 * @param error - The database error
 * @param operation - Database operation (e.g., 'findMany', 'create')
 * @param model - Prisma model name
 */
export function logDatabaseError(
  error: unknown,
  operation: string,
  model: string
): void {
  logError(error, {
    source: 'database',
    operation,
    model,
  });
}

/**
 * Log external service error
 *
 * @param error - The external service error
 * @param service - Service name (e.g., 'stripe', 'resend')
 * @param operation - Operation attempted
 */
export function logExternalServiceError(
  error: unknown,
  service: string,
  operation: string
): void {
  logError(error, {
    source: 'external_service',
    service,
    operation,
  });
}
