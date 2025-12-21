# Phase 2: Build Part 16 (Utilities & Infrastructure) with Minimal Testing

## Context & Mission

You are tasked with building **Part 16: Utilities & Infrastructure** for the Trading Alerts SaaS V7 platform. This is **Tier 3 (Utility)** code, requiring only **2% test coverage** (minimal smoke tests).

**Your mission:** Build essential utility functions and infrastructure code that supports the application, with lightweight testing focused on basic functionality verification.

---

## Prerequisites

✅ **Phase 1 completed:** Parts 1-15 have comprehensive test coverage

- Tier 1: 25%+ coverage
- Tier 2: 10%+ coverage
- Tier 3: 2%+ coverage

**Repository:** https://github.com/ripper7375/trading-alerts-saas-v7

---

## Part 16 Overview: Utilities & Infrastructure

Part 16 consists of cross-cutting concerns and helper utilities that support other parts of the application.

### **What to Build**

#### **1. Middleware (`middleware.ts`)**

**Purpose:** Route protection and request processing

**Required Functionality:**

- ✅ Route protection (authenticated vs public routes)
- ✅ Tier-based access control (FREE vs PRO routes)
- ✅ Rate limiting per tier
- ✅ Request logging (optional)

**File Location:** `middleware.ts` (root directory)

**Example Structure:**

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Protected routes requiring authentication
const protectedRoutes = ['/dashboard', '/api/alerts', '/api/watchlist'];

// PRO-only routes requiring PRO tier
const proOnlyRoutes = ['/api/charts', '/api/advanced-alerts'];

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const { pathname } = request.nextUrl;

  // Check if route requires authentication
  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Check if route requires PRO tier
  if (proOnlyRoutes.some((route) => pathname.startsWith(route))) {
    if (!token || token.tier !== 'PRO') {
      return NextResponse.json(
        { error: 'PRO subscription required' },
        { status: 403 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

**Minimal Test (2% coverage):**

```typescript
// __tests__/middleware.test.ts
import { middleware } from '@/middleware';
import { NextRequest } from 'next/server';

describe('Middleware', () => {
  it('should allow access to public routes', async () => {
    const request = new NextRequest('http://localhost:3000/');
    const response = await middleware(request);

    expect(response).toBeDefined();
  });

  it('should redirect unauthenticated users from protected routes', async () => {
    const request = new NextRequest('http://localhost:3000/dashboard');
    const response = await middleware(request);

    expect(response.status).toBe(307); // Redirect
  });
});
```

---

#### **2. Rate Limiting (`lib/rate-limit.ts`)**

**Purpose:** Prevent API abuse with tier-based rate limits

**Required Functionality:**

- ✅ FREE tier: 100 requests/hour
- ✅ PRO tier: 1000 requests/hour
- ✅ IP-based fallback for unauthenticated requests
- ✅ Redis-backed (or in-memory for MVP)

**File Location:** `lib/rate-limit.ts`

**Example Structure:**

```typescript
import { NextRequest } from 'next/server';

// In-memory store (replace with Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

interface RateLimitConfig {
  FREE: number;
  PRO: number;
  ANONYMOUS: number;
}

const RATE_LIMITS: RateLimitConfig = {
  FREE: 100, // requests per hour
  PRO: 1000, // requests per hour
  ANONYMOUS: 20, // requests per hour
};

export async function checkRateLimit(
  identifier: string,
  tier: 'FREE' | 'PRO' | 'ANONYMOUS' = 'ANONYMOUS'
): Promise<{ success: boolean; remaining: number }> {
  const limit = RATE_LIMITS[tier];
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour

  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetAt) {
    // New window
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { success: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0 };
  }

  record.count++;
  return { success: true, remaining: limit - record.count };
}

export function getRateLimitIdentifier(
  request: NextRequest,
  userId?: string
): string {
  return userId || request.ip || 'anonymous';
}
```

**Minimal Test (2% coverage):**

```typescript
// __tests__/lib/rate-limit.test.ts
import { checkRateLimit } from '@/lib/rate-limit';

describe('Rate Limiting', () => {
  it('should allow requests under limit', async () => {
    const result = await checkRateLimit('test-user', 'PRO');

    expect(result.success).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it('should enforce different limits per tier', async () => {
    const freeResult = await checkRateLimit('free-user', 'FREE');
    const proResult = await checkRateLimit('pro-user', 'PRO');

    expect(freeResult.remaining).toBeLessThan(proResult.remaining);
  });
});
```

---

#### **3. Error Handling (`lib/errors.ts`)**

**Purpose:** Standardized error handling and logging

**Required Functionality:**

- ✅ Custom error classes (ValidationError, AuthError, PaymentError)
- ✅ Error formatter for API responses
- ✅ Error logger (optional integration with Sentry/LogRocket)

**File Location:** `lib/errors.ts`

**Example Structure:**

```typescript
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(401, message, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(403, message, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class PaymentError extends AppError {
  constructor(message: string) {
    super(402, message, 'PAYMENT_ERROR');
    this.name = 'PaymentError';
  }
}

export function formatErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return {
      error: {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
      },
    };
  }

  // Unknown error
  return {
    error: {
      message: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    },
  };
}
```

**Minimal Test (2% coverage):**

```typescript
// __tests__/lib/errors.test.ts
import { ValidationError, formatErrorResponse } from '@/lib/errors';

describe('Error Handling', () => {
  it('should create validation error with correct status code', () => {
    const error = new ValidationError('Invalid input');

    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Invalid input');
  });

  it('should format error responses', () => {
    const error = new ValidationError('Test error');
    const formatted = formatErrorResponse(error);

    expect(formatted.error.code).toBe('VALIDATION_ERROR');
    expect(formatted.error.statusCode).toBe(400);
  });
});
```

---

#### **4. Logging Utility (`lib/logger.ts`)**

**Purpose:** Structured logging for debugging and monitoring

**Required Functionality:**

- ✅ Log levels (debug, info, warn, error)
- ✅ Structured logging (JSON format)
- ✅ Context injection (requestId, userId)

**File Location:** `lib/logger.ts`

**Example Structure:**

```typescript
enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

interface LogContext {
  requestId?: string;
  userId?: string;
  [key: string]: any;
}

class Logger {
  private context: LogContext = {};

  setContext(context: LogContext) {
    this.context = { ...this.context, ...context };
  }

  private log(level: LogLevel, message: string, meta?: object) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...meta,
    };

    // In production, send to logging service (Sentry, LogRocket, etc.)
    console[level](JSON.stringify(logEntry));
  }

  debug(message: string, meta?: object) {
    this.log(LogLevel.DEBUG, message, meta);
  }

  info(message: string, meta?: object) {
    this.log(LogLevel.INFO, message, meta);
  }

  warn(message: string, meta?: object) {
    this.log(LogLevel.WARN, message, meta);
  }

  error(message: string, meta?: object) {
    this.log(LogLevel.ERROR, message, meta);
  }
}

export const logger = new Logger();
```

**Minimal Test (2% coverage):**

```typescript
// __tests__/lib/logger.test.ts
import { logger } from '@/lib/logger';

describe('Logger', () => {
  it('should log messages', () => {
    const consoleSpy = jest.spyOn(console, 'info');

    logger.info('Test message');

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should include context in logs', () => {
    const consoleSpy = jest.spyOn(console, 'info');

    logger.setContext({ userId: 'test-123' });
    logger.info('Test with context');

    const logEntry = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(logEntry.userId).toBe('test-123');

    consoleSpy.mockRestore();
  });
});
```

---

#### **5. Data Validation (`lib/validation.ts`)**

**Purpose:** Reusable validation schemas and helpers

**Required Functionality:**

- ✅ Common validation schemas (email, password, symbols)
- ✅ Zod schemas for API request validation
- ✅ Helper functions for validation

**File Location:** `lib/validation.ts`

**Example Structure:**

```typescript
import { z } from 'zod';

// Common schemas
export const emailSchema = z.string().email('Invalid email address');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain uppercase letter')
  .regex(/[a-z]/, 'Password must contain lowercase letter')
  .regex(/[0-9]/, 'Password must contain number');

export const forexSymbolSchema = z
  .string()
  .regex(/^[A-Z]{6}$/, 'Invalid forex symbol format (e.g., EURUSD)');

export const tierSchema = z.enum(['FREE', 'PRO']);

// API request schemas
export const createAlertSchema = z.object({
  symbol: forexSymbolSchema,
  condition: z.enum(['above', 'below']),
  price: z.number().positive(),
  tier: tierSchema.optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: emailSchema.optional(),
  timezone: z.string().optional(),
});

// Validation helper
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
  };
}
```

**Minimal Test (2% coverage):**

```typescript
// __tests__/lib/validation.test.ts
import {
  emailSchema,
  validateRequest,
  createAlertSchema,
} from '@/lib/validation';

describe('Validation', () => {
  it('should validate email addresses', () => {
    expect(emailSchema.safeParse('test@example.com').success).toBe(true);
    expect(emailSchema.safeParse('invalid-email').success).toBe(false);
  });

  it('should validate alert creation data', () => {
    const validData = {
      symbol: 'EURUSD',
      condition: 'above' as const,
      price: 1.1,
    };

    const result = validateRequest(createAlertSchema, validData);

    expect(result.success).toBe(true);
  });
});
```

---

#### **6. Date/Time Utilities (`lib/utils/date.ts`)**

**Purpose:** Date formatting and timezone handling

**Required Functionality:**

- ✅ Format dates for display
- ✅ Calculate relative time ("2 hours ago")
- ✅ Timezone conversion helpers

**File Location:** `lib/utils/date.ts`

**Example Structure:**

```typescript
export function formatDate(
  date: Date | string,
  format: 'short' | 'long' = 'short'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (format === 'short') {
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return formatDate(d, 'short');
}
```

**Minimal Test (2% coverage):**

```typescript
// __tests__/lib/utils/date.test.ts
import { formatDate, getRelativeTime } from '@/lib/utils/date';

describe('Date Utilities', () => {
  it('should format dates', () => {
    const date = new Date('2024-01-15');
    const formatted = formatDate(date);

    expect(formatted).toContain('Jan');
    expect(formatted).toContain('15');
  });

  it('should calculate relative time', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const relative = getRelativeTime(fiveMinutesAgo);

    expect(relative).toContain('minute');
  });
});
```

---

## Testing Strategy for Part 16

### **Coverage Target: 2% (Smoke Tests Only)**

**What to Test:**

- ✅ **Basic functionality works** (happy path)
- ✅ **No runtime errors** (smoke tests)

**What NOT to Test:**

- ⏸️ Edge cases
- ⏸️ Complex error scenarios
- ⏸️ Integration with external services
- ⏸️ Performance testing

**Example Test Coverage:**

```typescript
// One test per utility function is sufficient for 2% coverage
describe('Part 16: Utilities', () => {
  // Middleware
  it('middleware should process requests', () => {
    /* ... */
  });

  // Rate limiting
  it('rate limiting should track requests', () => {
    /* ... */
  });

  // Errors
  it('errors should format correctly', () => {
    /* ... */
  });

  // Logger
  it('logger should log messages', () => {
    /* ... */
  });

  // Validation
  it('validation should validate data', () => {
    /* ... */
  });

  // Date utils
  it('date utils should format dates', () => {
    /* ... */
  });
});
```

---

## Execution Checklist

- [ ] **1. Build middleware.ts**
  - [ ] Route protection logic
  - [ ] Tier-based access control
  - [ ] Basic smoke test

- [ ] **2. Build lib/rate-limit.ts**
  - [ ] Rate limiting logic
  - [ ] Tier-based limits
  - [ ] Basic functionality test

- [ ] **3. Build lib/errors.ts**
  - [ ] Custom error classes
  - [ ] Error formatter
  - [ ] Error creation test

- [ ] **4. Build lib/logger.ts**
  - [ ] Logging methods
  - [ ] Context injection
  - [ ] Logging test

- [ ] **5. Build lib/validation.ts**
  - [ ] Zod schemas
  - [ ] Validation helpers
  - [ ] Schema validation test

- [ ] **6. Build lib/utils/date.ts**
  - [ ] Date formatting
  - [ ] Relative time
  - [ ] Date formatting test

- [ ] **7. Run tests**

  ```bash
  npm run test:coverage
  ```

- [ ] **8. Verify 2% coverage achieved**
  - [ ] Check coverage report
  - [ ] Update jest.config.js if needed

---

## Constraints & Guidelines

### **DO:**

- ✅ Keep code simple and reusable
- ✅ Use TypeScript strict mode
- ✅ Write minimal smoke tests (2% coverage)
- ✅ Follow existing code patterns from Parts 1-15
- ✅ Add JSDoc comments for public functions

### **DON'T:**

- ❌ Over-engineer utilities (keep it simple)
- ❌ Write extensive tests (this is Tier 3)
- ❌ Add complex dependencies
- ❌ Implement features not needed yet
- ❌ Test edge cases (defer to post-MVP)

---

## Deliverables

Upon completion, provide:

1. **Utility files** in appropriate directories
2. **Minimal test suite** achieving 2% coverage
3. **Updated jest.config.js** (if needed)
4. **Documentation** (JSDoc comments)
5. **Summary** of utilities created

---

## Success Criteria

✅ **Phase 2 Complete When:**

- All 6 utility modules built and functional
- Minimum 2% test coverage achieved
- All tests passing
- No TypeScript errors
- CI/CD pipeline succeeds
- Code follows existing patterns from Parts 1-15

---

---

## Step 7: Integration Testing for Utilities

**CRITICAL:** Utilities like middleware and rate limiting must be tested in real request flows, not just in isolation.

### **Why Integration Tests for Part 16?**

Unit tests verify utilities work standalone, but **don't catch:**

- ❌ Middleware blocks valid authenticated requests
- ❌ Rate limiting resets too frequently
- ❌ Error handler loses context in production
- ❌ Logger fails to write to external service

---

### **3 Critical Integration Test Flows**

#### **Integration Flow 1: Middleware + Auth + Tier Protection**

**Test complete request flow through middleware stack.**

```typescript
// __tests__/integration/middleware-auth-flow.test.ts
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

describe('Integration: Middleware Authentication Flow', () => {
  it('should allow authenticated user to access protected routes', async () => {
    // Create authenticated request
    const request = new NextRequest('http://localhost:3000/dashboard', {
      headers: {
        cookie: 'next-auth.session-token=valid-session-token',
      },
    });

    const response = await middleware(request);

    // Should allow access (NextResponse.next())
    expect(response.status).not.toBe(307); // Not redirected
    expect(response.status).not.toBe(401); // Not unauthorized
  });

  it('should redirect unauthenticated users from protected routes', async () => {
    const request = new NextRequest('http://localhost:3000/dashboard');

    const response = await middleware(request);

    expect(response.status).toBe(307); // Redirect
    expect(response.headers.get('location')).toContain('/login');
  });

  it('should enforce PRO tier requirements', async () => {
    // Mock FREE tier user
    const freeUserRequest = new NextRequest(
      'http://localhost:3000/api/charts/EURUSD/H1',
      {
        headers: {
          cookie: 'next-auth.session-token=free-user-token',
        },
      }
    );

    const response = await middleware(freeUserRequest);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('PRO subscription required');
  });

  it('should allow public routes without authentication', async () => {
    const publicRoutes = ['/', '/pricing', '/api/health'];

    for (const route of publicRoutes) {
      const request = new NextRequest(`http://localhost:3000${route}`);
      const response = await middleware(request);

      expect(response.status).not.toBe(307); // Not redirected
      expect(response.status).not.toBe(401); // Not unauthorized
    }
  });
});
```

---

#### **Integration Flow 2: Rate Limiting Across Tiers**

**Test rate limiting enforces different limits for FREE vs PRO users.**

```typescript
// __tests__/integration/rate-limit-flow.test.ts
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

describe('Integration: Rate Limiting Flow', () => {
  it('should enforce FREE tier rate limits (100/hour)', async () => {
    const freeUserId = 'free-user-123';
    const identifier = freeUserId;

    // Make 100 requests (at limit)
    const requests = [];
    for (let i = 0; i < 100; i++) {
      requests.push(checkRateLimit(identifier, 'FREE'));
    }
    const results = await Promise.all(requests);

    // All 100 should succeed
    expect(results.every((r) => r.success)).toBe(true);

    // 101st request should fail
    const blockedRequest = await checkRateLimit(identifier, 'FREE');
    expect(blockedRequest.success).toBe(false);
    expect(blockedRequest.remaining).toBe(0);
  });

  it('should enforce PRO tier rate limits (1000/hour)', async () => {
    const proUserId = 'pro-user-456';
    const identifier = proUserId;

    // Make 500 requests (well within limit)
    const requests = [];
    for (let i = 0; i < 500; i++) {
      requests.push(checkRateLimit(identifier, 'PRO'));
    }
    const results = await Promise.all(requests);

    // All 500 should succeed
    expect(results.every((r) => r.success)).toBe(true);

    // Should still have ~500 remaining
    const nextRequest = await checkRateLimit(identifier, 'PRO');
    expect(nextRequest.success).toBe(true);
    expect(nextRequest.remaining).toBeGreaterThan(400);
  });

  it('should reset rate limits after time window', async () => {
    const userId = 'reset-test-user';

    // Exhaust limit
    for (let i = 0; i < 100; i++) {
      await checkRateLimit(userId, 'FREE');
    }

    // Next request should fail
    const blockedRequest = await checkRateLimit(userId, 'FREE');
    expect(blockedRequest.success).toBe(false);

    // Fast-forward time by 1 hour (mock Date.now())
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 60 * 60 * 1000);

    // Rate limit should reset
    const afterResetRequest = await checkRateLimit(userId, 'FREE');
    expect(afterResetRequest.success).toBe(true);
    expect(afterResetRequest.remaining).toBe(99);

    jest.restoreAllMocks();
  });

  it('should use IP address for anonymous users', async () => {
    const request = new NextRequest('http://localhost:3000/api/alerts', {
      headers: { 'x-forwarded-for': '192.168.1.100' },
    });

    const identifier = getRateLimitIdentifier(request);
    expect(identifier).toBe('192.168.1.100');

    // Rate limit anonymous users more strictly
    const result = await checkRateLimit(identifier, 'ANONYMOUS');
    expect(result.success).toBe(true);
    expect(result.remaining).toBeLessThan(100); // ANONYMOUS has lower limit
  });
});
```

---

#### **Integration Flow 3: Error Handling + Logging Pipeline**

**Test errors are properly caught, formatted, logged, and returned.**

```typescript
// __tests__/integration/error-logging-flow.test.ts
import {
  AppError,
  ValidationError,
  PaymentError,
  formatErrorResponse,
} from '@/lib/errors';
import { logger } from '@/lib/logger';

describe('Integration: Error Handling + Logging Flow', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should handle validation error end-to-end', async () => {
    // Simulate API request with invalid data
    const invalidAlertData = {
      symbol: 'INVALID', // Should be 6 chars like EURUSD
      condition: 'above',
      price: -100, // Should be positive
    };

    try {
      // This should throw ValidationError
      await fetch('/api/alerts', {
        method: 'POST',
        body: JSON.stringify(invalidAlertData),
      });
    } catch (error) {
      // Error should be caught and formatted
      const formattedError = formatErrorResponse(error);

      expect(formattedError.error.code).toBe('VALIDATION_ERROR');
      expect(formattedError.error.statusCode).toBe(400);

      // Error should be logged
      expect(logSpy).toHaveBeenCalled();
      const logEntry = JSON.parse(logSpy.mock.calls[0][0]);
      expect(logEntry.level).toBe('error');
      expect(logEntry.message).toContain('Validation failed');
    }
  });

  it('should handle payment error with proper context', async () => {
    const paymentError = new PaymentError('Insufficient funds');

    // Log with context
    logger.setContext({ userId: 'user-123', amount: 2900 });
    logger.error('Payment failed', { error: paymentError });

    // Verify log includes context
    const logEntry = JSON.parse(logSpy.mock.calls[0][0]);
    expect(logEntry.userId).toBe('user-123');
    expect(logEntry.amount).toBe(2900);
    expect(logEntry.message).toBe('Payment failed');

    // Format error for API response
    const response = formatErrorResponse(paymentError);
    expect(response.error.code).toBe('PAYMENT_ERROR');
    expect(response.error.statusCode).toBe(402);
  });

  it('should handle unknown errors gracefully', async () => {
    const unknownError = new Error('Database connection lost');

    const formatted = formatErrorResponse(unknownError);

    expect(formatted.error.code).toBe('INTERNAL_ERROR');
    expect(formatted.error.statusCode).toBe(500);
    expect(formatted.error.message).toBe('An unexpected error occurred');

    // Original error should be logged for debugging
    logger.error('Unexpected error', { error: unknownError });
    const logEntry = JSON.parse(logSpy.mock.calls[0][0]);
    expect(logEntry.level).toBe('error');
  });

  it('should propagate errors through middleware stack', async () => {
    // Simulate request that triggers error in middleware
    const request = new NextRequest('http://localhost:3000/api/alerts', {
      method: 'POST',
      body: JSON.stringify({ invalid: 'data' }),
    });

    // Process through middleware
    const response = await fetch('/api/alerts', {
      method: 'POST',
      body: JSON.stringify({ invalid: 'data' }),
    });

    // Should return properly formatted error
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
    expect(data.error.code).toBeDefined();

    // Error should be logged
    expect(logSpy).toHaveBeenCalled();
  });
});
```

---

### **Integration Test Execution Checklist**

Add this to your Phase 2 checklist:

#### **Integration Tests (3 Flows)**

- [ ] **Flow 1: Middleware + Auth + Tier Protection**
  - [ ] Authenticated users access protected routes
  - [ ] Unauthenticated users redirected to login
  - [ ] PRO tier enforcement works
  - [ ] Public routes accessible without auth

- [ ] **Flow 2: Rate Limiting**
  - [ ] FREE tier limited to 100 requests/hour
  - [ ] PRO tier limited to 1000 requests/hour
  - [ ] Rate limits reset after time window
  - [ ] Anonymous users rate limited by IP

- [ ] **Flow 3: Error Handling + Logging**
  - [ ] Validation errors caught and formatted
  - [ ] Payment errors logged with context
  - [ ] Unknown errors handled gracefully
  - [ ] Errors propagate through middleware

---

### **Integration Test Setup**

Create test utilities for integration tests:

```typescript
// __tests__/integration/setup.ts
import { prisma } from '@/lib/db';

// Clean database before each integration test
export async function cleanDatabase() {
  await prisma.user.deleteMany({
    where: { email: { contains: 'test@example.com' } },
  });
  await prisma.alert.deleteMany();
  await prisma.notification.deleteMany();
}

// Create test user with specific tier
export async function createTestUser(tier: 'FREE' | 'PRO' = 'FREE') {
  return await prisma.user.create({
    data: {
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      tier,
    },
  });
}

// Generate valid JWT token for testing
export function generateTestToken(userId: string, tier: 'FREE' | 'PRO') {
  // Implementation depends on your auth setup
  return 'test-token';
}
```

Use in integration tests:

```typescript
import { cleanDatabase, createTestUser } from './setup';

describe('Integration Test Suite', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('should test something', async () => {
    const user = await createTestUser('PRO');
    // ... test logic
  });
});
```

---

---

## Step 8: API Testing with Supertest for Utilities

**CRITICAL:** Middleware and rate limiting must be tested through actual HTTP requests, not just function calls.

### **Why Supertest for Part 16?**

Utilities affect HTTP layer behavior, but integration tests **don't catch:**

- ❌ Middleware not registered in Next.js config
- ❌ Rate limit headers not set correctly
- ❌ Error responses missing CORS headers
- ❌ Logger not capturing request metadata

---

### **5 Critical API Tests for Utilities**

#### **API Test 1: Middleware Protection**

```typescript
// __tests__/api/middleware.supertest.ts
import {
  setupSupertestApp,
  teardownSupertestApp,
} from '../helpers/supertest-setup';

describe('API Tests: Middleware Protection', () => {
  let request: any;

  beforeAll(async () => {
    request = await setupSupertestApp();
  });

  afterAll(async () => {
    await teardownSupertestApp();
  });

  describe('Route Protection', () => {
    it('should allow public routes without auth', async () => {
      const publicRoutes = ['/', '/pricing', '/about'];

      for (const route of publicRoutes) {
        const response = await request.get(route);
        expect(response.status).not.toBe(401);
        expect(response.status).not.toBe(307); // Not redirected
      }
    });

    it('should redirect unauthenticated users from /dashboard', async () => {
      const response = await request.get('/dashboard').expect(307); // Redirect

      expect(response.headers.location).toContain('/login');
    });

    it('should allow authenticated users to /dashboard', async () => {
      // Create and login user
      await request.post('/api/auth/signup').send({
        email: 'middleware-test@example.com',
        password: 'SecurePass123!',
        name: 'Test User',
      });

      const loginRes = await request.post('/api/auth/signin').send({
        email: 'middleware-test@example.com',
        password: 'SecurePass123!',
      });

      const token = loginRes.body.token;

      const response = await request
        .get('/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).not.toBe(307);
      expect(response.status).not.toBe(401);
    });

    it('should block PRO routes for FREE users', async () => {
      // Create FREE user
      await request.post('/api/auth/signup').send({
        email: 'free-middleware@example.com',
        password: 'SecurePass123!',
        name: 'Free User',
      });

      const loginRes = await request.post('/api/auth/signin').send({
        email: 'free-middleware@example.com',
        password: 'SecurePass123!',
      });

      const response = await request
        .get('/api/charts/EURUSD/H1')
        .set('Authorization', `Bearer ${loginRes.body.token}`)
        .expect(403);

      expect(response.body.error).toContain('PRO subscription required');
    });
  });
});
```

---

#### **API Test 2: Rate Limiting Headers & Enforcement**

```typescript
// __tests__/api/rate-limiting.supertest.ts
describe('API Tests: Rate Limiting', () => {
  let request: any;
  let freeUserToken: string;
  let proUserToken: string;

  beforeAll(async () => {
    request = await setupSupertestApp();

    // Create FREE user
    await request.post('/api/auth/signup').send({
      email: 'ratelimit-free@example.com',
      password: 'SecurePass123!',
      name: 'Free User',
    });
    const freeLogin = await request.post('/api/auth/signin').send({
      email: 'ratelimit-free@example.com',
      password: 'SecurePass123!',
    });
    freeUserToken = freeLogin.body.token;

    // Create PRO user
    await request.post('/api/auth/signup').send({
      email: 'ratelimit-pro@example.com',
      password: 'SecurePass123!',
      name: 'Pro User',
    });
    await prisma.user.update({
      where: { email: 'ratelimit-pro@example.com' },
      data: { tier: 'PRO' },
    });
    const proLogin = await request.post('/api/auth/signin').send({
      email: 'ratelimit-pro@example.com',
      password: 'SecurePass123!',
    });
    proUserToken = proLogin.body.token;
  });

  it('should return rate limit headers', async () => {
    const response = await request
      .get('/api/alerts')
      .set('Authorization', `Bearer ${freeUserToken}`);

    expect(response.headers).toHaveProperty('x-ratelimit-limit');
    expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    expect(response.headers).toHaveProperty('x-ratelimit-reset');
  });

  it('should enforce FREE tier limit (100/hour)', async () => {
    // Make 100 requests
    const requests = [];
    for (let i = 0; i < 100; i++) {
      requests.push(
        request
          .get('/api/watchlist')
          .set('Authorization', `Bearer ${freeUserToken}`)
      );
    }
    await Promise.all(requests);

    // 101st request should be blocked
    const response = await request
      .get('/api/watchlist')
      .set('Authorization', `Bearer ${freeUserToken}`)
      .expect(429);

    expect(response.body.error).toContain('Rate limit exceeded');
    expect(response.headers['retry-after']).toBeDefined();
  });

  it('should enforce PRO tier limit (1000/hour)', async () => {
    // Make 200 requests (within PRO limit)
    const requests = [];
    for (let i = 0; i < 200; i++) {
      requests.push(
        request
          .get('/api/charts/EURUSD/H1')
          .set('Authorization', `Bearer ${proUserToken}`)
      );
    }
    const responses = await Promise.all(requests);

    // All should succeed
    responses.forEach((res) => {
      expect(res.status).toBe(200);
    });

    // Should still have requests remaining
    const lastResponse = responses[responses.length - 1];
    const remaining = parseInt(lastResponse.headers['x-ratelimit-remaining']);
    expect(remaining).toBeGreaterThan(700);
  });

  it('should rate limit anonymous users by IP', async () => {
    // Make 20 requests (ANONYMOUS limit)
    const requests = [];
    for (let i = 0; i < 20; i++) {
      requests.push(request.get('/api/health'));
    }
    await Promise.all(requests);

    // 21st request should be blocked
    const response = await request.get('/api/health').expect(429);

    expect(response.body.error).toContain('Rate limit exceeded');
  });
});
```

---

#### **API Test 3: Error Handling & Response Format**

```typescript
// __tests__/api/error-handling.supertest.ts
describe('API Tests: Error Handling', () => {
  let request: any;

  beforeAll(async () => {
    request = await setupSupertestApp();
  });

  it('should return standardized error format', async () => {
    const response = await request
      .post('/api/alerts')
      .send({ invalid: 'data' }) // No auth token, invalid data
      .expect(401);

    expect(response.body).toMatchObject({
      error: {
        message: expect.any(String),
        code: expect.any(String),
        statusCode: 401,
      },
    });
  });

  it('should return validation errors with details', async () => {
    // Create and login user
    await request.post('/api/auth/signup').send({
      email: 'error-test@example.com',
      password: 'SecurePass123!',
      name: 'Test User',
    });
    const loginRes = await request.post('/api/auth/signin').send({
      email: 'error-test@example.com',
      password: 'SecurePass123!',
    });

    const response = await request
      .post('/api/alerts')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({
        symbol: 'INVALID', // Should be 6 chars
        condition: 'above',
        price: -100, // Should be positive
      })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toContain('symbol');
    expect(response.body.error.message).toContain('price');
  });

  it('should include request ID in error response', async () => {
    const response = await request.get('/api/nonexistent').expect(404);

    expect(response.body.error).toHaveProperty('requestId');
    expect(response.headers).toHaveProperty('x-request-id');
  });

  it('should set CORS headers on error responses', async () => {
    const response = await request
      .options('/api/alerts')
      .set('Origin', 'https://example.com');

    expect(response.headers).toHaveProperty('access-control-allow-origin');
    expect(response.headers).toHaveProperty('access-control-allow-methods');
  });
});
```

---

#### **API Test 4: Logging & Monitoring**

```typescript
// __tests__/api/logging.supertest.ts
describe('API Tests: Logging', () => {
  let request: any;
  let logSpy: jest.SpyInstance;

  beforeAll(async () => {
    request = await setupSupertestApp();
  });

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'info').mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should log API requests with metadata', async () => {
    await request.get('/api/health');

    expect(logSpy).toHaveBeenCalled();
    const logEntry = JSON.parse(logSpy.mock.calls[0][0]);

    expect(logEntry).toMatchObject({
      level: 'info',
      message: expect.stringContaining('API request'),
      method: 'GET',
      path: '/api/health',
      timestamp: expect.any(String),
    });
  });

  it('should log with user context when authenticated', async () => {
    // Create and login user
    await request.post('/api/auth/signup').send({
      email: 'logging-test@example.com',
      password: 'SecurePass123!',
      name: 'Test User',
    });
    const loginRes = await request.post('/api/auth/signin').send({
      email: 'logging-test@example.com',
      password: 'SecurePass123!',
    });

    await request
      .get('/api/watchlist')
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    const logEntry = JSON.parse(logSpy.mock.calls[0][0]);
    expect(logEntry).toHaveProperty('userId');
    expect(logEntry).toHaveProperty('userTier');
  });

  it('should log errors with stack traces', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Trigger an error
    await request.post('/api/alerts').send({ invalid: 'data' });

    expect(errorSpy).toHaveBeenCalled();
    const errorLog = JSON.parse(errorSpy.mock.calls[0][0]);

    expect(errorLog.level).toBe('error');
    expect(errorLog.error).toBeDefined();

    errorSpy.mockRestore();
  });
});
```

---

#### **API Test 5: Health Check & Monitoring Endpoints**

```typescript
// __tests__/api/health.supertest.ts
describe('API Tests: Health & Monitoring', () => {
  let request: any;

  beforeAll(async () => {
    request = await setupSupertestApp();
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request.get('/api/health').expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
      });
    });

    it('should include database status', async () => {
      const response = await request.get('/api/health');

      expect(response.body).toHaveProperty('database');
      expect(response.body.database).toMatchObject({
        connected: true,
        latency: expect.any(Number),
      });
    });

    it('should not require authentication', async () => {
      const response = await request.get('/api/health');
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/metrics', () => {
    it('should return basic metrics', async () => {
      const response = await request.get('/api/metrics').expect(200);

      expect(response.body).toMatchObject({
        requests: {
          total: expect.any(Number),
          perMinute: expect.any(Number),
        },
        errors: {
          count: expect.any(Number),
          rate: expect.any(Number),
        },
      });
    });
  });
});
```

---

### **API Test Execution Checklist**

Add this to your Phase 2 checklist:

#### **Supertest API Tests (5 Tests)**

- [ ] **Middleware Protection**
  - [ ] Public routes accessible
  - [ ] Protected routes redirect to login
  - [ ] Authenticated users allowed
  - [ ] PRO tier enforcement works

- [ ] **Rate Limiting**
  - [ ] Headers returned correctly
  - [ ] FREE tier limited to 100/hour
  - [ ] PRO tier limited to 1000/hour
  - [ ] Anonymous users limited by IP

- [ ] **Error Handling**
  - [ ] Standardized error format
  - [ ] Validation errors include details
  - [ ] Request IDs included
  - [ ] CORS headers set

- [ ] **Logging**
  - [ ] API requests logged
  - [ ] User context included when authenticated
  - [ ] Errors logged with stack traces

- [ ] **Health & Monitoring**
  - [ ] Health endpoint returns status
  - [ ] Database status included
  - [ ] Metrics endpoint works

---

## Timeline Estimate (Updated with Supertest)

| Task            | Unit Tests | Integration Tests | **Supertest API** | Total         |
| --------------- | ---------- | ----------------- | ----------------- | ------------- |
| Middleware      | 2 hours    | 2 hours           | **1.5 hours**     | **5.5 hours** |
| Rate limiting   | 2 hours    | 2 hours           | **1.5 hours**     | **5.5 hours** |
| Error handling  | 1 hour     | 1.5 hours         | **1 hour**        | **3.5 hours** |
| Logger          | 1 hour     | 0.5 hours         | **1 hour**        | **2.5 hours** |
| Validation      | 2 hours    | 0.5 hours         | **0.5 hours**     | **3 hours**   |
| Date utils      | 1 hour     | 0 hours           | **0 hours**       | **1 hour**    |
| Setup & Cleanup | -          | 1 hour            | **0.5 hours**     | **1.5 hours** |

**Total: 4-5 days** (including Supertest API tests)

---

## Success Criteria (Updated)

✅ **Phase 2 Complete When:**

- **Unit Tests:**
  - All 6 utility modules have 2%+ smoke test coverage
- **Integration Tests:**
  - 3 critical flows passing (Middleware + Auth, Rate Limiting, Error Handling)
- **Supertest API Tests:**
  - 5 API test groups passing
  - Middleware protection verified via HTTP
  - Rate limiting headers and enforcement tested
  - Error responses validated
  - Logging and health checks working
- All tests passing
- CI/CD pipeline succeeds

---

**Ready to begin? Start with middleware.ts unit tests → integration tests → then add Supertest API tests.**
