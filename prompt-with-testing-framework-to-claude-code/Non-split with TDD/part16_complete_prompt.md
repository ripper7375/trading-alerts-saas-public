# Part 16: Utilities & Infrastructure - Complete Build & Test Prompt

**Project:** Trading Alerts SaaS V7
**Task:** Build Part 16 (Utilities & Infrastructure) with comprehensive testing
**Files to Build:** 25 files + comprehensive test suite
**Estimated Time:** 7-8 days (5 hours building + 2-3 days testing)
**Current Status:** Parts 6-15 complete and merged to main

---

## YOUR MISSION

You are Claude Code, tasked with building **Part 16: Utilities & Infrastructure** for the Trading Alerts SaaS V7 project. You will:

1. **Build 25 files** autonomously following all project policies
2. **Write comprehensive tests** (Unit + Integration + API tests)
3. **Achieve minimum 2% test coverage** for utilities (Tier 3)
4. **Validate and commit** each file individually
5. **Push and create PR** after all files and tests complete

**Quality Standards:**

- TypeScript strict mode (no `any` types)
- All validations must pass
- All tests must pass
- Follow existing patterns from Parts 1-15

---

## ESSENTIAL FILES TO READ FIRST

**CRITICAL:** Read these files in order before writing any code.

### 1. **Project Overview & Current State**

```
PROGRESS-part-2.md                   # Current project status
README.md                            # Project overview
ARCHITECTURE-compress.md             # System architecture
IMPLEMENTATION-GUIDE.md              # Implementation best practices
```

### 2. **Policy Files (YOUR RULES)**

```
docs/policies/00-tier-specifications.md              # FREE vs PRO tier rules (CRITICAL)
docs/policies/01-approval-policies.md                # When to approve/fix/escalate
docs/policies/02-quality-standards.md                # TypeScript, error handling standards
docs/policies/03-architecture-rules.md               # File structure, architecture patterns
docs/policies/04-escalation-triggers.md              # When to ask for human help
docs/policies/05-coding-patterns-part-1.md           # Code patterns (Part 1)
docs/policies/05-coding-patterns-part-2.md           # Code patterns (Part 2)
docs/policies/06-aider-instructions.md               # Build workflow
```

### 3. **Part 16 Requirements**

```
docs/build-orders/part-16-utilities.md               # Build order for all 25 files
docs/implementation-guides/v5_part_p.md              # Utilities business logic
```

### 4. **Seed Code (MUST REFERENCE)**

```
seed-code/v0-components/next-js-marketing-homepage-v2/app/page.tsx
seed-code/v0-components/empty-states-components/components/empty-states.tsx
seed-code/v0-components/user-profile-dropdown/components/user-profile-dropdown.tsx
```

### 5. **OpenAPI & Validation**

```
docs/trading_alerts_openapi.yaml                     # Next.js API contracts
VALIDATION-SETUP-GUIDE.md                            # Validation tools
CLAUDE.md                                            # Automated validation
```

---

## PART 16 - FILES TO BUILD (25 Files)

Build these files in sequence, one by one:

### **Category A: Email & Tokens (2 files)**

#### **File 1/25:** `lib/email/email.ts`

- Send email with Resend
- Reusable email templates (welcome, verification, password reset)
- **Commit:** `feat(email): add email service`

#### **File 2/25:** `lib/tokens.ts`

- Generate verification tokens
- Generate password reset tokens
- Hash tokens for storage
- **Commit:** `feat(auth): add token generation`

---

### **Category B: Error Handling (3 files)**

#### **File 3/25:** `lib/errors/error-handler.ts`

- Global error handler for API routes
- Handle Prisma errors, Zod errors, custom errors
- Return consistent error responses
- **Commit:** `feat(errors): add error handler`

#### **File 4/25:** `lib/errors/api-error.ts`

- APIError class with static factory methods
- badRequest, unauthorized, forbidden, notFound, internal
- Include status codes and error codes
- **Commit:** `feat(errors): add API error classes`

#### **File 5/25:** `lib/errors/error-logger.ts`

- Error logging service
- Log to console (development)
- Log to external service placeholder (production)
- Include context (userId, tier, endpoint)
- **Commit:** `feat(errors): add error logger`

---

### **Category C: Caching (2 files)**

#### **File 6/25:** `lib/redis/client.ts`

- Redis client using ioredis
- Connection to REDIS_URL env variable
- Export redis instance
- **Commit:** `feat(cache): add Redis client`

#### **File 7/25:** `lib/cache/cache-manager.ts`

- Cache manager with get, set, delete
- TTL support (default 5 minutes)
- Price caching functions (cachePrice, getCachedPrice)
- **Commit:** `feat(cache): add cache manager`

---

### **Category D: Validation Schemas (4 files)**

#### **File 8/25:** `lib/validations/auth.ts`

- signupSchema (email, password, name)
- loginSchema (email, password)
- resetPasswordSchema
- **Commit:** `feat(validation): add auth schemas`

#### **File 9/25:** `lib/validations/alert.ts`

- createAlertSchema (symbol, timeframe, conditionType, targetValue)
- updateAlertSchema
- Use tier-based symbol/timeframe enums
- **Commit:** `feat(validation): add alert schemas`

#### **File 10/25:** `lib/validations/watchlist.ts`

- addToWatchlistSchema (symbol, timeframe)
- Symbol+timeframe combination validation
- Tier validation refinement
- **Commit:** `feat(validation): add watchlist schemas`

#### **File 11/25:** `lib/validations/user.ts`

- updateProfileSchema (name, email, image)
- updatePreferencesSchema
- changePasswordSchema
- **Commit:** `feat(validation): add user schemas`

---

### **Category E: Utilities (3 files)**

#### **File 12/25:** `lib/utils/helpers.ts`

- generateId (with optional prefix)
- sleep utility
- truncate string
- isDefined type guard
- pick and omit object utilities
- **Commit:** `feat(utils): add helper functions`

#### **File 13/25:** `lib/utils/formatters.ts`

- formatCurrency
- formatDate
- formatRelativeTime ("2 hours ago")
- formatCompactNumber (1000 → 1K)
- **Commit:** `feat(utils): add formatters`

#### **File 14/25:** `lib/utils/constants.ts`

- TIMEFRAMES array (M15, M30, H1, H2, H4, H8, D1)
- SYMBOLS array (XAUUSD, EURUSD, GBPUSD, etc.)
- TIER_LIMITS (FREE vs PRO symbols, limits)
- PRICING constants
- **Commit:** `feat(utils): add app constants`

---

### **Category F: Root App Files (3 files)**

#### **File 15/25:** `app/layout.tsx`

- Root layout with metadata
- Providers: SessionProvider, QueryClientProvider, ThemeProvider
- Global fonts (Inter)
- **Commit:** `feat(app): add root layout`

#### **File 16/25:** `app/globals.css`

- Tailwind directives
- CSS variables for theming
- Dark mode variables
- Custom utility classes
- **Commit:** `feat(app): add global styles`

#### **File 17/25:** `app/error.tsx`

- Global error page
- "use client" component
- Display error message
- Reset button
- **Commit:** `feat(app): add error page`

---

### **Category G: Marketing (2 files)**

#### **File 18/25:** `app/(marketing)/layout.tsx`

- Marketing layout (public pages)
- Simple header with logo and CTA buttons
- Footer with links
- **Commit:** `feat(marketing): add marketing layout`

#### **File 19/25:** `app/(marketing)/page.tsx`

- Landing page (public)
- Hero section with value proposition
- Features showcase (3 cards)
- Pricing preview (FREE/PRO)
- Affiliate program section
- **CRITICAL:** Reference seed code
- **Commit:** `feat(marketing): add landing page`

---

### **Category H: Public Assets (1 file)**

#### **File 20/25:** `public/manifest.json`

- PWA manifest
- App name, icons, theme colors
- Display mode: standalone
- **Commit:** `feat(pwa): add manifest`

---

### **Category I: GitHub Actions (3 files)**

#### **File 21/25:** `.github/workflows/ci-nextjs.yml`

- Next.js CI pipeline
- Checkout, setup Node, install deps
- Run lint, type-check, tests, build
- **Commit:** `ci: add Next.js CI workflow`

#### **File 22/25:** `.github/workflows/ci-flask.yml`

- Flask CI pipeline for MT5 service
- Checkout, setup Python, install deps
- Run pytest, flake8
- **Commit:** `ci: add Flask CI workflow`

#### **File 23/25:** `.github/workflows/deploy.yml`

- Deployment workflow
- Build Docker images
- Push to registry
- Deploy to server
- **Commit:** `ci: add deployment workflow`

---

### **Category J: Docker (2 files)**

#### **File 24/25:** `docker-compose.yml`

- All services: next-app, flask-app, postgres, redis
- Networks, volumes, environment variables
- **Commit:** `feat(docker): add docker-compose`

#### **File 25/25:** `.dockerignore`

- Ignore node_modules, .git, .env.local
- Ignore build artifacts
- **Commit:** `feat(docker): add dockerignore`

---

## COMPREHENSIVE TESTING REQUIREMENTS

**Coverage Target:** Minimum 2% (Tier 3 - Utilities)

After building all 25 files, create comprehensive test suite:

---

### **Phase 1: Unit Tests (2% Coverage - Smoke Tests)**

Create smoke tests for each utility module:

#### **Test File 1:** `__tests__/lib/email/email.test.ts`

```typescript
import { sendEmail, getWelcomeEmail } from '@/lib/email/email';

describe('Email Service', () => {
  it('should generate welcome email HTML', () => {
    const html = getWelcomeEmail('John Doe');
    expect(html).toContain('Welcome to Trading Alerts');
    expect(html).toContain('John Doe');
  });

  it('should format email correctly', () => {
    const html = getWelcomeEmail('Test User');
    expect(html).toContain('<div');
    expect(html).toContain('</div>');
  });
});
```

#### **Test File 2:** `__tests__/lib/tokens.test.ts`

```typescript
import { generateVerificationToken, hashToken } from '@/lib/tokens';

describe('Token Generation', () => {
  it('should generate unique tokens', () => {
    const token1 = generateVerificationToken();
    const token2 = generateVerificationToken();
    expect(token1).not.toBe(token2);
  });

  it('should hash tokens consistently', () => {
    const token = 'test-token-123';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    expect(hash1).toBe(hash2);
  });
});
```

#### **Test File 3:** `__tests__/lib/errors/api-error.test.ts`

```typescript
import { APIError } from '@/lib/errors/api-error';

describe('API Error Classes', () => {
  it('should create bad request error', () => {
    const error = APIError.badRequest('Invalid input');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
  });

  it('should create unauthorized error', () => {
    const error = APIError.unauthorized();
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('Unauthorized');
  });

  it('should create not found error', () => {
    const error = APIError.notFound();
    expect(error.statusCode).toBe(404);
  });
});
```

#### **Test File 4:** `__tests__/lib/errors/error-handler.test.ts`

```typescript
import { handleAPIError } from '@/lib/errors/error-handler';
import { APIError } from '@/lib/errors/api-error';
import { ZodError } from 'zod';

describe('Error Handler', () => {
  it('should handle API errors', () => {
    const error = APIError.badRequest('Test error');
    const response = handleAPIError(error);

    expect(response.status).toBe(400);
  });

  it('should handle Zod validation errors', () => {
    const zodError = new ZodError([]);
    const response = handleAPIError(zodError);

    expect(response.status).toBe(400);
  });
});
```

#### **Test File 5:** `__tests__/lib/cache/cache-manager.test.ts`

```typescript
import { getCache, setCache, deleteCache } from '@/lib/cache/cache-manager';

describe('Cache Manager', () => {
  it('should set and get cache', async () => {
    await setCache('test-key', { value: 'test' });
    const result = await getCache('test-key');

    expect(result).toEqual({ value: 'test' });
  });

  it('should delete cache', async () => {
    await setCache('delete-test', 'value');
    await deleteCache('delete-test');
    const result = await getCache('delete-test');

    expect(result).toBeNull();
  });
});
```

#### **Test File 6:** `__tests__/lib/validations/auth.test.ts`

```typescript
import { signupSchema, loginSchema } from '@/lib/validations/auth';

describe('Auth Validation', () => {
  it('should validate signup data', () => {
    const valid = {
      email: 'test@example.com',
      password: 'SecurePass123',
      name: 'John Doe',
    };

    expect(() => signupSchema.parse(valid)).not.toThrow();
  });

  it('should reject invalid email', () => {
    const invalid = {
      email: 'invalid-email',
      password: 'SecurePass123',
      name: 'John',
    };

    expect(() => signupSchema.parse(invalid)).toThrow();
  });
});
```

#### **Test File 7:** `__tests__/lib/validations/alert.test.ts`

```typescript
import { createAlertSchema } from '@/lib/validations/alert';

describe('Alert Validation', () => {
  it('should validate alert creation', () => {
    const valid = {
      symbol: 'XAUUSD',
      timeframe: 'H1',
      conditionType: 'price_above',
      targetValue: 2000,
    };

    expect(() => createAlertSchema.parse(valid)).not.toThrow();
  });
});
```

#### **Test File 8:** `__tests__/lib/utils/helpers.test.ts`

```typescript
import { generateId, truncate, isDefined } from '@/lib/utils/helpers';

describe('Helper Utilities', () => {
  it('should generate unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });

  it('should truncate strings', () => {
    const long = 'This is a very long string';
    const short = truncate(long, 10);
    expect(short.length).toBeLessThanOrEqual(13); // 10 + '...'
  });

  it('should check if value is defined', () => {
    expect(isDefined(null)).toBe(false);
    expect(isDefined(undefined)).toBe(false);
    expect(isDefined('value')).toBe(true);
  });
});
```

#### **Test File 9:** `__tests__/lib/utils/formatters.test.ts`

```typescript
import {
  formatCurrency,
  formatDate,
  formatRelativeTime,
} from '@/lib/utils/formatters';

describe('Formatters', () => {
  it('should format currency', () => {
    expect(formatCurrency(29)).toBe('$29.00');
    expect(formatCurrency(1000)).toBe('$1,000.00');
  });

  it('should format dates', () => {
    const date = new Date('2024-01-15');
    const formatted = formatDate(date);
    expect(formatted).toContain('Jan');
  });

  it('should format relative time', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const relative = formatRelativeTime(fiveMinutesAgo);
    expect(relative).toContain('minute');
  });
});
```

#### **Test File 10:** `__tests__/lib/utils/constants.test.ts`

```typescript
import { TIMEFRAMES, SYMBOLS, TIER_LIMITS } from '@/lib/utils/constants';

describe('Constants', () => {
  it('should have correct timeframes', () => {
    expect(TIMEFRAMES).toContain('M15');
    expect(TIMEFRAMES).toContain('H1');
    expect(TIMEFRAMES).toContain('D1');
  });

  it('should have correct symbols', () => {
    expect(SYMBOLS).toContain('XAUUSD');
    expect(SYMBOLS.length).toBe(10);
  });

  it('should have correct tier limits', () => {
    expect(TIER_LIMITS.FREE.maxAlerts).toBe(5);
    expect(TIER_LIMITS.PRO.maxAlerts).toBe(20);
  });
});
```

**Unit Test Execution:**

```bash
npm run test:unit
```

---

### **Phase 2: Integration Tests (3 Critical Flows)**

Create integration tests for key utility flows:

#### **Integration Test 1:** `__tests__/integration/middleware-auth-flow.test.ts`

```typescript
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

describe('Integration: Middleware Authentication Flow', () => {
  it('should allow authenticated user to access protected routes', async () => {
    const request = new NextRequest('http://localhost:3000/dashboard', {
      headers: {
        cookie: 'next-auth.session-token=valid-session-token',
      },
    });

    const response = await middleware(request);

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

      expect(response.status).not.toBe(307);
      expect(response.status).not.toBe(401);
    }
  });
});
```

#### **Integration Test 2:** `__tests__/integration/rate-limit-flow.test.ts`

```typescript
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

    // Fast-forward time by 1 hour
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

    const result = await checkRateLimit(identifier, 'ANONYMOUS');
    expect(result.success).toBe(true);
    expect(result.remaining).toBeLessThan(100);
  });
});
```

#### **Integration Test 3:** `__tests__/integration/error-logging-flow.test.ts`

```typescript
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
    const invalidAlertData = {
      symbol: 'INVALID',
      condition: 'above',
      price: -100,
    };

    try {
      await fetch('/api/alerts', {
        method: 'POST',
        body: JSON.stringify(invalidAlertData),
      });
    } catch (error) {
      const formattedError = formatErrorResponse(error);

      expect(formattedError.error.code).toBe('VALIDATION_ERROR');
      expect(formattedError.error.statusCode).toBe(400);

      expect(logSpy).toHaveBeenCalled();
      const logEntry = JSON.parse(logSpy.mock.calls[0][0]);
      expect(logEntry.level).toBe('error');
      expect(logEntry.message).toContain('Validation failed');
    }
  });

  it('should handle payment error with proper context', async () => {
    const paymentError = new PaymentError('Insufficient funds');

    logger.setContext({ userId: 'user-123', amount: 2900 });
    logger.error('Payment failed', { error: paymentError });

    const logEntry = JSON.parse(logSpy.mock.calls[0][0]);
    expect(logEntry.userId).toBe('user-123');
    expect(logEntry.amount).toBe(2900);
    expect(logEntry.message).toBe('Payment failed');

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

    logger.error('Unexpected error', { error: unknownError });
    const logEntry = JSON.parse(logSpy.mock.calls[0][0]);
    expect(logEntry.level).toBe('error');
  });
});
```

**Integration Test Execution:**

```bash
npm run test:integration
```

---

### **Phase 3: API Tests with Supertest (5 Test Groups)**

Create end-to-end API tests:

#### **Setup File:** `__tests__/helpers/supertest-setup.ts`

```typescript
import {
  setupSupertestApp,
  teardownSupertestApp,
} from '../helpers/supertest-setup';
import { prisma } from '@/lib/db';

export async function setupSupertestApp() {
  // Start test server
  const app = require('../../app');
  const request = require('supertest')(app);
  return request;
}

export async function teardownSupertestApp() {
  // Clean database
  await prisma.$disconnect();
}

export async function cleanDatabase() {
  await prisma.user.deleteMany({
    where: { email: { contains: 'test@example.com' } },
  });
  await prisma.alert.deleteMany();
  await prisma.notification.deleteMany();
}

export async function createTestUser(tier: 'FREE' | 'PRO' = 'FREE') {
  return await prisma.user.create({
    data: {
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      tier,
    },
  });
}
```

#### **API Test 1:** `__tests__/api/middleware.supertest.ts`

```typescript
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
        expect(response.status).not.toBe(307);
      }
    });

    it('should redirect unauthenticated users from /dashboard', async () => {
      const response = await request.get('/dashboard').expect(307);

      expect(response.headers.location).toContain('/login');
    });

    it('should allow authenticated users to /dashboard', async () => {
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

#### **API Test 2:** `__tests__/api/rate-limiting.supertest.ts`

```typescript
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
    const requests = [];
    for (let i = 0; i < 100; i++) {
      requests.push(
        request
          .get('/api/watchlist')
          .set('Authorization', `Bearer ${freeUserToken}`)
      );
    }
    await Promise.all(requests);

    const response = await request
      .get('/api/watchlist')
      .set('Authorization', `Bearer ${freeUserToken}`)
      .expect(429);

    expect(response.body.error).toContain('Rate limit exceeded');
    expect(response.headers['retry-after']).toBeDefined();
  });

  it('should enforce PRO tier limit (1000/hour)', async () => {
    const requests = [];
    for (let i = 0; i < 200; i++) {
      requests.push(
        request
          .get('/api/charts/EURUSD/H1')
          .set('Authorization', `Bearer ${proUserToken}`)
      );
    }
    const responses = await Promise.all(requests);

    responses.forEach((res) => {
      expect(res.status).toBe(200);
    });

    const lastResponse = responses[responses.length - 1];
    const remaining = parseInt(lastResponse.headers['x-ratelimit-remaining']);
    expect(remaining).toBeGreaterThan(700);
  });
});
```

#### **API Test 3:** `__tests__/api/error-handling.supertest.ts`

```typescript
describe('API Tests: Error Handling', () => {
  let request: any;

  beforeAll(async () => {
    request = await setupSupertestApp();
  });

  it('should return standardized error format', async () => {
    const response = await request
      .post('/api/alerts')
      .send({ invalid: 'data' })
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
        symbol: 'INVALID',
        condition: 'above',
        price: -100,
      })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toContain('symbol');
  });

  it('should include request ID in error response', async () => {
    const response = await request.get('/api/nonexistent').expect(404);

    expect(response.body.error).toHaveProperty('requestId');
    expect(response.headers).toHaveProperty('x-request-id');
  });
});
```

#### **API Test 4:** `__tests__/api/logging.supertest.ts`

```typescript
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
});
```

#### **API Test 5:** `__tests__/api/health.supertest.ts`

```typescript
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
});
```

**API Test Execution:**

```bash
npm run test:api
```

---

## GIT WORKFLOW

### **Branch Strategy**

```bash
# Create new branch (MUST start with 'claude/' and end with session ID)
git checkout -b claude/utilities-infrastructure-{SESSION_ID}

# Build files one by one, commit each file individually
# After all 25 files + all tests complete:
git push -u origin claude/utilities-infrastructure-{SESSION_ID}
```

### **Commit Message Format**

```
feat(email): add email service
feat(utils): add helper functions
test(unit): add email service tests
test(integration): add middleware auth flow tests
test(api): add rate limiting API tests
```

### **Push Requirements**

- Branch MUST start with `claude/`
- Branch MUST end with session ID
- Push ONLY after all validations pass
- Create PR after push (do NOT merge to main directly)

---

## VALIDATION REQUIREMENTS

### **After Building Each File:**

```bash
npm run validate:types    # TypeScript check
npm run validate:lint     # ESLint check
npm run validate:format   # Prettier check
npm run validate          # All validations
npm run fix               # Auto-fix issues
```

### **After Writing All Tests:**

```bash
npm run test:unit         # Unit tests
npm run test:integration  # Integration tests
npm run test:api          # API tests with Supertest
npm run test:coverage     # Coverage report
npm run test              # All tests
```

### **Validation Must Pass:**

- ✅ 0 TypeScript errors
- ✅ 0 ESLint errors (warnings OK if < 3)
- ✅ All files properly formatted
- ✅ No unused imports
- ✅ All functions have return types
- ✅ All tests passing
- ✅ Minimum 2% test coverage achieved

---

## KEY CODE PATTERNS

### **Pattern 1: Constants (CRITICAL)**

```typescript
// lib/utils/constants.ts
export const TIMEFRAMES = ['M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'D1'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const SYMBOLS = [
  'XAUUSD',
  'EURUSD',
  'GBPUSD',
  'USDJPY',
  'AUDUSD',
  'BTCUSD',
  'ETHUSD',
  'XAGUSD',
  'NDX100',
  'US30',
] as const;
export type Symbol = (typeof SYMBOLS)[number];

export const FREE_SYMBOLS = ['XAUUSD'] as const;

export const TIER_LIMITS = {
  FREE: {
    symbols: FREE_SYMBOLS,
    timeframes: TIMEFRAMES,
    maxAlerts: 5,
    maxWatchlists: 3,
    maxWatchlistItems: 5,
  },
  PRO: {
    symbols: SYMBOLS,
    timeframes: TIMEFRAMES,
    maxAlerts: 20,
    maxWatchlists: 10,
    maxWatchlistItems: 50,
  },
} as const;

export const PRICING = {
  FREE: 0,
  PRO: 29,
} as const;
```

### **Pattern 2: API Error Classes**

```typescript
// lib/errors/api-error.ts
export class APIError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'APIError';
  }

  static badRequest(message: string, code = 'BAD_REQUEST'): APIError {
    return new APIError(400, code, message);
  }

  static unauthorized(message = 'Unauthorized'): APIError {
    return new APIError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Forbidden'): APIError {
    return new APIError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Not found'): APIError {
    return new APIError(404, 'NOT_FOUND', message);
  }

  static internal(message = 'Internal server error'): APIError {
    return new APIError(500, 'INTERNAL_ERROR', message);
  }
}
```

### **Pattern 3: Error Handler**

```typescript
// lib/errors/error-handler.ts
import { NextResponse } from 'next/server';
import { APIError } from './api-error';
import { ZodError } from 'zod';

export function handleAPIError(error: unknown): NextResponse {
  if (error instanceof APIError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      },
      { status: 400 }
    );
  }

  console.error('Unhandled error:', error);
  return NextResponse.json(
    { error: 'Internal server error', code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}
```

### **Pattern 4: Middleware**

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const protectedRoutes = ['/dashboard', '/api/alerts', '/api/watchlist'];
const proOnlyRoutes = ['/api/charts', '/api/advanced-alerts'];

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const { pathname } = request.nextUrl;

  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

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
```

### **Pattern 5: Rate Limiting**

```typescript
// lib/rate-limit.ts
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMITS = {
  FREE: 100,
  PRO: 1000,
  ANONYMOUS: 20,
};

export async function checkRateLimit(
  identifier: string,
  tier: 'FREE' | 'PRO' | 'ANONYMOUS' = 'ANONYMOUS'
): Promise<{ success: boolean; remaining: number }> {
  const limit = RATE_LIMITS[tier];
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;

  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetAt) {
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
```

---

## TESTING CHECKLIST

### **Unit Tests (10 files)**

- [ ] Email service tests
- [ ] Token generation tests
- [ ] API error class tests
- [ ] Error handler tests
- [ ] Cache manager tests
- [ ] Auth validation tests
- [ ] Alert validation tests
- [ ] Helper utilities tests
- [ ] Formatters tests
- [ ] Constants tests

### **Integration Tests (3 flows)**

- [ ] Middleware + Auth flow
- [ ] Rate limiting flow
- [ ] Error handling + Logging flow

### **API Tests (5 groups)**

- [ ] Middleware protection
- [ ] Rate limiting headers & enforcement
- [ ] Error handling & response format
- [ ] Logging & monitoring
- [ ] Health check endpoints

---

## EXECUTION TIMELINE

| Phase       | Tasks                   | Duration |
| ----------- | ----------------------- | -------- |
| **Phase 1** | Build 25 files          | 5 hours  |
| **Phase 2** | Write unit tests        | 1 day    |
| **Phase 3** | Write integration tests | 1 day    |
| **Phase 4** | Write API tests         | 1-2 days |
| **Phase 5** | Fix issues & validate   | 0.5 day  |

**Total:** 7-8 days

---

## SUCCESS CRITERIA

Part 16 is complete when:

### **Build Phase:**

- ✅ All 25 files created and committed
- ✅ All TypeScript validations pass (0 errors)
- ✅ All ESLint checks pass
- ✅ Constants export correct tier limits
- ✅ Landing page renders correctly
- ✅ Docker compose runs without errors
- ✅ GitHub Actions CI configured

### **Testing Phase:**

- ✅ All 10 unit tests passing
- ✅ All 3 integration tests passing
- ✅ All 5 API test groups passing
- ✅ Minimum 2% test coverage achieved
- ✅ Coverage report generated

### **Final Phase:**

- ✅ All validations pass
- ✅ All tests pass
- ✅ Code pushed to feature branch
- ✅ PR created (ready for review)

---

## PROGRESS TRACKING

Use the TodoWrite tool to track progress:

```
BUILD PHASE:
1. Read all policy files
2. Read seed code
3. Files 1-2: Email & Tokens
4. Files 3-5: Error Handling
5. Files 6-7: Caching
6. Files 8-11: Validation Schemas
7. Files 12-14: Utilities
8. Files 15-17: Root App Files
9. Files 18-19: Marketing
10. File 20: PWA Manifest
11. Files 21-23: GitHub Actions
12. Files 24-25: Docker

TESTING PHASE:
13. Unit Test 1-5
14. Unit Test 6-10
15. Integration Test 1-3
16. API Test 1-3
17. API Test 4-5

VALIDATION PHASE:
18. Run full validation suite
19. Generate coverage report
20. Fix any issues
21. Push to feature branch
22. Create pull request
```

---

## START HERE

### **Step 1: Read Essential Files**

```
1. PROGRESS-part-2.md
2. docs/policies/00-tier-specifications.md (CRITICAL)
3. docs/policies/05-coding-patterns-part-1.md
4. docs/policies/05-coding-patterns-part-2.md
5. docs/build-orders/part-16-utilities.md
6. seed-code/v0-components/next-js-marketing-homepage-v2/app/page.tsx
```

### **Step 2: Create Git Branch**

```bash
git checkout main
git pull origin main
git checkout -b claude/utilities-infrastructure-{SESSION_ID}
```

### **Step 3: Build Files 1-25**

For each file:

1. Read build order
2. Write file following patterns
3. Validate: `npm run validate`
4. Fix: `npm run fix`
5. Commit: `git commit -m "feat(...)"`

### **Step 4: Write All Tests**

1. Unit tests (10 files)
2. Integration tests (3 flows)
3. API tests (5 groups)
4. Run: `npm run test:coverage`

### **Step 5: Final Validation & Push**

```bash
npm run validate
npm run test
git push -u origin claude/utilities-infrastructure-{SESSION_ID}
```

---

## WHEN TO ASK FOR HELP

Escalate to the user if:

- Critical security issues found
- Ambiguous requirements
- Missing dependencies
- Validation errors you can't resolve
- Environment variable questions
- Docker/CI configuration questions
- Test failures you can't debug

Otherwise, work autonomously!

---

**Good luck! Build Part 16 with quality, comprehensive testing, and precision. The user trusts you to deliver production-ready code with full test coverage.**
