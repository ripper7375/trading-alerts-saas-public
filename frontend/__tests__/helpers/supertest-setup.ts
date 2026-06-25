/**
 * API Testing Helpers - Supertest-style Setup for Next.js API Routes
 *
 * Provides utilities for testing API route handlers without running
 * a full HTTP server. Uses next/test utilities and mock request/response.
 *
 * @module __tests__/helpers/supertest-setup
 */

import { NextRequest } from 'next/server';
import type { Session } from 'next-auth';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE DEFINITIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface MockRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown> | string;
  headers?: Record<string, string>;
  searchParams?: Record<string, string>;
}

export interface MockSession extends Session {
  user: {
    id: string;
    email: string;
    name?: string;
    tier: 'FREE' | 'PRO';
    role: string;
    isAffiliate: boolean;
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REQUEST BUILDER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create a mock NextRequest for testing API routes
 *
 * @param url - The URL path for the request
 * @param options - Request configuration options
 * @returns NextRequest instance
 *
 * @example
 * ```typescript
 * const request = createMockRequest('/api/affiliate/dashboard/stats', {
 *   method: 'GET',
 *   headers: { 'Authorization': 'Bearer token' }
 * });
 * ```
 */
export function createMockRequest(
  url: string,
  options: MockRequestOptions = {}
): NextRequest {
  const { method = 'GET', body, headers = {}, searchParams = {} } = options;

  // Build URL with search params
  const baseUrl = 'http://localhost:3000';
  const fullUrl = new URL(url, baseUrl);

  Object.entries(searchParams).forEach(([key, value]) => {
    fullUrl.searchParams.set(key, value);
  });

  // Prepare request init
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  // Add body for non-GET requests
  if (body && method !== 'GET') {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  return new NextRequest(fullUrl, init);
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SESSION MOCKING
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create a mock session for testing authenticated routes
 *
 * @param overrides - Override default session values
 * @returns Mock session object
 */
export function createMockSession(
  overrides: Partial<MockSession['user']> = {}
): MockSession {
  return {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      tier: 'FREE',
      role: 'USER',
      isAffiliate: false,
      ...overrides,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Create a mock affiliate session
 */
export function createMockAffiliateSession(
  overrides: Partial<MockSession['user']> = {}
): MockSession {
  return createMockSession({
    isAffiliate: true,
    ...overrides,
  });
}

/**
 * Create a mock admin session
 */
export function createMockAdminSession(
  overrides: Partial<MockSession['user']> = {}
): MockSession {
  return createMockSession({
    role: 'ADMIN',
    ...overrides,
  });
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RESPONSE HELPERS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Extract JSON body from NextResponse
 *
 * @param response - NextResponse from API handler
 * @returns Parsed JSON body
 */
export async function getResponseBody<T = unknown>(
  response: Response
): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

/**
 * Assert response status and return body
 */
export async function expectStatus<T = unknown>(
  response: Response,
  expectedStatus: number
): Promise<T> {
  expect(response.status).toBe(expectedStatus);
  return getResponseBody<T>(response);
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ENVIRONMENT SETUP
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Setup test environment variables
 */
export function setupTestEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.NEXTAUTH_SECRET = 'test-secret';
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
}

/**
 * Clean up after tests
 */
export function teardownTestEnv(): void {
  jest.clearAllMocks();
  jest.resetModules();
}
