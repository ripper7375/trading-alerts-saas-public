/**
 * Error Handler Tests
 *
 * Tests for the global error handler.
 */

import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { handleAPIError, createErrorResponse } from '@/lib/errors/error-handler';
import { APIError, ValidationError } from '@/lib/errors/api-error';

// Mock console.error to prevent test output noise
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalConsoleError;
});

describe('Error Handler', () => {
  describe('handleAPIError', () => {
    it('should handle APIError correctly', () => {
      const error = APIError.badRequest('Invalid input');
      const response = handleAPIError(error);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(400);
    });

    it('should handle APIError with custom message', () => {
      const error = APIError.notFound('User not found');
      const response = handleAPIError(error);

      expect(response.status).toBe(404);
    });

    it('should handle ValidationError', () => {
      const error = new ValidationError('Validation failed', {
        field: 'email',
      });
      const response = handleAPIError(error);

      expect(response.status).toBe(400);
    });

    it('should handle ZodError', () => {
      const schema = z.object({
        email: z.string().email(),
      });

      let zodError: ZodError | null = null;
      try {
        schema.parse({ email: 'invalid' });
      } catch (e) {
        zodError = e as ZodError;
      }

      if (zodError) {
        const response = handleAPIError(zodError);
        expect(response.status).toBe(400);
      }
    });

    it('should handle generic Error', () => {
      const error = new Error('Something went wrong');
      const response = handleAPIError(error);

      expect(response.status).toBe(500);
    });

    it('should handle unknown error types', () => {
      const response = handleAPIError('string error');

      expect(response.status).toBe(500);
    });

    it('should handle null error', () => {
      const response = handleAPIError(null);

      expect(response.status).toBe(500);
    });

    it('should include context in logs', () => {
      const error = APIError.unauthorized();
      const context = {
        userId: 'user-123',
        endpoint: '/api/test',
        method: 'POST',
      };

      handleAPIError(error, context);

      expect(console.error).toHaveBeenCalled();
    });

    it('should handle unauthorized errors', () => {
      const error = APIError.unauthorized();
      const response = handleAPIError(error);

      expect(response.status).toBe(401);
    });

    it('should handle forbidden errors', () => {
      const error = APIError.forbidden();
      const response = handleAPIError(error);

      expect(response.status).toBe(403);
    });

    it('should handle internal errors', () => {
      const error = APIError.internal();
      const response = handleAPIError(error);

      expect(response.status).toBe(500);
    });

    it('should handle too many requests errors', () => {
      const error = APIError.tooManyRequests();
      const response = handleAPIError(error);

      expect(response.status).toBe(429);
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response for APIError', () => {
      const error = APIError.badRequest('Invalid');
      const response = createErrorResponse(error);

      expect(response.error).toBe('Invalid');
      expect(response.code).toBe('BAD_REQUEST');
      expect(response.statusCode).toBe(400);
      expect(response.requestId).toBeDefined();
    });

    it('should create error response for ZodError', () => {
      const schema = z.object({
        name: z.string().min(1),
      });

      let zodError: ZodError | null = null;
      try {
        schema.parse({ name: '' });
      } catch (e) {
        zodError = e as ZodError;
      }

      if (zodError) {
        const response = createErrorResponse(zodError);

        expect(response.error).toBe('Validation failed');
        expect(response.code).toBe('VALIDATION_ERROR');
        expect(response.statusCode).toBe(400);
        expect(response.details).toBeDefined();
      }
    });

    it('should create error response for generic error', () => {
      const error = new Error('Generic error');
      const response = createErrorResponse(error);

      expect(response.error).toBe('Internal server error');
      expect(response.code).toBe('INTERNAL_ERROR');
      expect(response.statusCode).toBe(500);
    });

    it('should always include requestId', () => {
      const response1 = createErrorResponse(new Error('test1'));
      const response2 = createErrorResponse(new Error('test2'));

      expect(response1.requestId).toBeDefined();
      expect(response2.requestId).toBeDefined();
      expect(response1.requestId).not.toBe(response2.requestId);
    });

    it('should handle string errors', () => {
      const response = createErrorResponse('something went wrong');

      expect(response.statusCode).toBe(500);
    });

    it('should include APIError details in response', () => {
      const error = APIError.unprocessable('Invalid data', 'INVALID_DATA', {
        field: 'email',
        reason: 'must be unique',
      });
      const response = createErrorResponse(error);

      expect(response.details).toEqual({
        field: 'email',
        reason: 'must be unique',
      });
    });
  });
});

describe('Prisma Error Handling', () => {
  // Mock Prisma-like errors
  const createPrismaError = (code: string): { code: string; message: string } => ({
    code,
    message: `Prisma error: ${code}`,
  });

  it('should handle P2002 (unique constraint) as 409 Conflict', () => {
    const error = createPrismaError('P2002');
    const response = handleAPIError(error);

    expect(response.status).toBe(409);
  });

  it('should handle P2025 (record not found) as 404 Not Found', () => {
    const error = createPrismaError('P2025');
    const response = handleAPIError(error);

    expect(response.status).toBe(404);
  });

  it('should handle P2003 (foreign key constraint) as 400 Bad Request', () => {
    const error = createPrismaError('P2003');
    const response = handleAPIError(error);

    expect(response.status).toBe(400);
  });

  it('should handle unknown Prisma errors as 500', () => {
    const error = createPrismaError('P9999');
    const response = handleAPIError(error);

    expect(response.status).toBe(500);
  });
});
