# V5 Part P: Utilities & Infrastructure - Implementation Guide

**For:** Trading Alerts SaaS V7
**Part:** 16 - Utilities
**Total Files:** 25 files
**Complexity:** Low
**Last Updated:** 2025-11-21

---

## Overview

Helper functions, validation schemas, error handling, caching, email services, and deployment configuration.

### Key Components

- Validation schemas (Zod)
- Helper utilities
- Error handling
- Caching (Redis)
- Email service (Resend)
- App constants
- Root layout files

---

## Business Requirements

### 1. Validation Schemas (Zod)

**Auth Validations (`lib/validations/auth.ts`):**

```typescript
const signupSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});
```

**Alert Validations (`lib/validations/alert.ts`):**

```typescript
const createAlertSchema = z.object({
  symbol: z.enum([
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
  ]),
  timeframe: z.enum(['M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'D1']),
  conditionType: z.enum(['price_above', 'price_below', 'price_equals']),
  targetValue: z.number().positive('Target value must be positive'),
});
```

**Watchlist Validations (`lib/validations/watchlist.ts`):**

```typescript
const addToWatchlistSchema = z
  .object({
    symbol: z.string(),
    timeframe: z.string(),
  })
  .refine(
    (data) => isValidSymbolTimeframeCombination(data.symbol, data.timeframe),
    { message: 'Invalid symbol/timeframe combination for your tier' }
  );
```

**User Validations (`lib/validations/user.ts`):**

```typescript
const updateProfileSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  email: z.string().email().optional(),
  image: z.string().url().optional(),
});
```

### 2. App Constants

**`lib/utils/constants.ts`:**

```typescript
// V5: Updated timeframes (7 total)
export const TIMEFRAMES = ['M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'D1'] as const;

// V5: All supported symbols (10 for PRO)
export const SYMBOLS = [
  'XAUUSD', // Gold
  'EURUSD', // Euro/USD
  'GBPUSD', // Pound/USD
  'USDJPY', // USD/Yen
  'AUDUSD', // Aussie/USD
  'BTCUSD', // Bitcoin/USD
  'ETHUSD', // Ethereum/USD
  'XAGUSD', // Silver
  'NDX100', // Nasdaq 100
  'US30', // Dow Jones
] as const;

// Tier-based limits
export const TIER_LIMITS = {
  FREE: {
    symbols: ['XAUUSD'],
    timeframes: TIMEFRAMES, // All 7
    maxAlerts: 5,
    maxWatchlists: 3,
  },
  PRO: {
    symbols: SYMBOLS, // All 10
    timeframes: TIMEFRAMES, // All 7
    maxAlerts: 20,
    maxWatchlists: 10,
  },
} as const;

// Pricing
export const PRICING = {
  FREE: 0,
  PRO: 29,
} as const;
```

### 3. Helper Functions

**`lib/utils/helpers.ts`:**

```typescript
// Generate random ID
export function generateId(prefix: string = ''): string {
  const random = Math.random().toString(36).substring(2, 15);
  return prefix ? `${prefix}_${random}` : random;
}

// Sleep utility
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Truncate string
export function truncate(str: string, length: number): string {
  return str.length > length ? `${str.substring(0, length)}...` : str;
}

// Check if value is defined
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
```

**`lib/utils/formatters.ts`:**

```typescript
// Format currency
export function formatCurrency(
  amount: number,
  currency: string = 'USD'
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

// Format date
export function formatDate(
  date: Date | string,
  format: string = 'short'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: format as any,
  }).format(d);
}

// Format relative time (e.g., "2 hours ago")
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
}

// Format number (e.g., 1000 → 1K)
export function formatCompactNumber(num: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(num);
}
```

### 4. Error Handling

**`lib/errors/api-error.ts`:**

```typescript
export class APIError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'APIError';
  }

  static badRequest(message: string, code: string = 'BAD_REQUEST') {
    return new APIError(400, code, message);
  }

  static unauthorized(message: string = 'Unauthorized') {
    return new APIError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message: string = 'Forbidden') {
    return new APIError(403, 'FORBIDDEN', message);
  }

  static notFound(message: string = 'Not found') {
    return new APIError(404, 'NOT_FOUND', message);
  }

  static internal(message: string = 'Internal server error') {
    return new APIError(500, 'INTERNAL_ERROR', message);
  }
}
```

**`lib/errors/error-handler.ts`:**

```typescript
export function handleAPIError(error: unknown) {
  if (error instanceof APIError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  // Prisma errors
  if (error.code === 'P2002') {
    return Response.json(
      { error: 'Resource already exists', code: 'DUPLICATE' },
      { status: 409 }
    );
  }

  // Default error
  console.error('Unhandled error:', error);
  return Response.json(
    { error: 'Internal server error', code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}
```

### 5. Caching (Redis)

**`lib/redis/client.ts`:**

```typescript
import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL!);
```

**`lib/cache/cache-manager.ts`:**

```typescript
import { redis } from '@/lib/redis/client';

export async function getCache<T>(key: string): Promise<T | null> {
  const value = await redis.get(key);
  return value ? JSON.parse(value) : null;
}

export async function setCache(
  key: string,
  value: any,
  ttl: number = 300 // 5 minutes default
): Promise<void> {
  await redis.setex(key, ttl, JSON.stringify(value));
}

export async function deleteCache(key: string): Promise<void> {
  await redis.del(key);
}

// Cache MT5 prices for 1 minute
export async function cachePrice(
  symbol: string,
  timeframe: string,
  price: number
) {
  const key = `price:${symbol}:${timeframe}`;
  await setCache(key, price, 60);
}

export async function getCachedPrice(
  symbol: string,
  timeframe: string
): Promise<number | null> {
  const key = `price:${symbol}:${timeframe}`;
  return await getCache<number>(key);
}
```

### 6. Email Service

**`lib/email/email.ts`:**

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(to: string, subject: string, html: string) {
  await resend.emails.send({
    from: 'Trading Alerts <noreply@tradingalerts.com>',
    to,
    subject,
    html,
  });
}

// Reusable templates
export function getWelcomeEmail(name: string): string {
  return `
    <h1>Welcome to Trading Alerts, ${name}!</h1>
    <p>Your account has been created successfully.</p>
    <p>Start by setting up your first alert.</p>
  `;
}
```

**`lib/tokens.ts`:**

```typescript
import crypto from 'crypto';

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
```

### 7. Root Layout

**`app/layout.tsx`:**

- Metadata configuration (title, description, OG tags)
- Global providers (SessionProvider, QueryClientProvider, ThemeProvider)
- Global styles
- Font loading (Inter, system fonts)
- Analytics scripts (if applicable)

**`app/globals.css`:**

- Tailwind directives (@tailwind base, components, utilities)
- CSS variables for theming
- Custom utility classes
- Dark mode overrides

**`app/page.tsx`:**

- Landing page (public)
- Hero section with value proposition
- Features showcase
- Pricing preview
- CTA buttons (Sign Up, View Demo)

---

## Environment Variables

**Required:**

```
DATABASE_URL=
NEXTAUTH_URL=
NEXTAUTH_SECRET=
REDIS_URL=
RESEND_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
MT5_API_URL=
MT5_API_KEY=
```

**Optional:**

```
SENTRY_DSN=
ANALYTICS_ID=
```

---

## Summary

Utilities & Infrastructure provides foundation for entire app:

1. ✅ **Validation** - Zod schemas for all inputs
2. ✅ **Constants** - Tier limits, symbols, timeframes
3. ✅ **Helpers** - Reusable utility functions
4. ✅ **Error Handling** - Consistent error responses
5. ✅ **Caching** - Redis for performance
6. ✅ **Email** - Resend integration
7. ✅ **Root Files** - Layout, globals, landing page

**Priority:** High - Required before building other parts.

---

**Reference:** This guide works with `docs/build-orders/part-16-utilities.md` for file-by-file build instructions.
