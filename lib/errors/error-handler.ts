/**
 * Global Error Handler
 *
 * Handles different error types and returns consistent API responses.
 * Supports APIError, Zod validation errors, Prisma errors, and generic errors.
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { APIError, isAPIError } from './api-error';
import { logError } from './error-logger';

/**
 * Prisma error codes
 */
const PRISMA_ERROR_CODES: Record<string, { status: number; message: string }> = {
  P2002: { status: 409, message: 'Resource already exists' },
  P2003: { status: 400, message: 'Invalid reference' },
  P2025: { status: 404, message: 'Resource not found' },
  P2014: { status: 400, message: 'Invalid relation' },
  P2016: { status: 400, message: 'Query interpretation error' },
  P2021: { status: 500, message: 'Database table not found' },
  P2022: { status: 500, message: 'Database column not found' },
};

/**
 * Error response interface
 */
interface ErrorResponse {
  error: string;
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;
  requestId?: string;
}

/**
 * Generate a unique request ID for error tracking
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Format Zod validation errors into a readable format
 */
function formatZodErrors(error: ZodError): Array<{ field: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * Handle API errors and return appropriate NextResponse
 *
 * @param error - The error to handle
 * @param context - Optional context for error logging
 * @returns NextResponse with appropriate status and error body
 */
export function handleAPIError(
  error: unknown,
  context?: {
    userId?: string;
    endpoint?: string;
    method?: string;
  }
): NextResponse<ErrorResponse> {
  const requestId = generateRequestId();

  // Handle APIError
  if (isAPIError(error)) {
    logError(error, { ...context, requestId });
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        statusCode: error.statusCode,
        details: error.details,
        requestId,
      },
      { status: error.statusCode }
    );
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const validationErrors = formatZodErrors(error);
    logError(error, { ...context, requestId, validationErrors });
    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        details: { errors: validationErrors },
        requestId,
      },
      { status: 400 }
    );
  }

  // Handle Prisma errors
  if (isPrismaError(error)) {
    const prismaInfo = PRISMA_ERROR_CODES[error.code];
    logError(error, { ...context, requestId, prismaCode: error.code });

    if (prismaInfo) {
      return NextResponse.json(
        {
          error: prismaInfo.message,
          code: error.code,
          statusCode: prismaInfo.status,
          requestId,
        },
        { status: prismaInfo.status }
      );
    }

    // Unknown Prisma error
    return NextResponse.json(
      {
        error: 'Database error',
        code: 'DATABASE_ERROR',
        statusCode: 500,
        requestId,
      },
      { status: 500 }
    );
  }

  // Handle generic errors
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  logError(error, { ...context, requestId });

  // Don't expose internal error messages in production
  const isProduction = process.env['NODE_ENV'] === 'production';
  return NextResponse.json(
    {
      error: isProduction ? 'Internal server error' : errorMessage,
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      requestId,
    },
    { status: 500 }
  );
}

/**
 * Check if error is a Prisma error
 */
function isPrismaError(error: unknown): error is { code: string; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as Record<string, unknown>).code === 'string' &&
    (error as Record<string, unknown>).code.toString().startsWith('P')
  );
}

/**
 * Wrapper for API route handlers with automatic error handling
 *
 * @param handler - The route handler function
 * @returns Wrapped handler with error handling
 */
export function withErrorHandling<T>(
  handler: () => Promise<NextResponse<T>>
): () => Promise<NextResponse<T | ErrorResponse>> {
  return async (): Promise<NextResponse<T | ErrorResponse>> => {
    try {
      return await handler();
    } catch (error) {
      return handleAPIError(error);
    }
  };
}

/**
 * Create an error response without NextResponse (for non-API contexts)
 *
 * @param error - The error to handle
 * @returns Plain error response object
 */
export function createErrorResponse(error: unknown): ErrorResponse {
  const requestId = generateRequestId();

  if (isAPIError(error)) {
    return {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
      requestId,
    };
  }

  if (error instanceof ZodError) {
    return {
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      details: { errors: formatZodErrors(error) },
      requestId,
    };
  }

  return {
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    statusCode: 500,
    requestId,
  };
}
