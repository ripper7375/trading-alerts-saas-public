# Part 16: Utilities & Infrastructure - Claude Code Build Prompt

**Project:** Trading Alerts SaaS V7
**Task:** Build Part 16 (Utilities & Infrastructure) autonomously
**Files to Build:** 25 files
**Estimated Time:** 5 hours
**Current Status:** Parts 6-15 complete and merged to main

---

## YOUR MISSION

You are Claude Code, tasked with building **Part 16: Utilities & Infrastructure** for the Trading Alerts SaaS V7 project. You will build 25 files autonomously following all project policies, architecture rules, and quality standards.

**Your approach:**
1. Read ALL essential files listed below (policies, architecture, requirements)
2. Build files one-by-one in the specified order (grouped by category)
3. Follow coding patterns from policy files
4. Reference seed code for landing page component
5. Validate each file after creation (TypeScript, ESLint, Prettier)
6. Commit each file individually with descriptive commit messages
7. Test the utilities after all files are built

---

## ESSENTIAL FILES TO READ FIRST

**CRITICAL:** Read these files in order before writing any code. These files contain the "AI constitution" that guides all development.

### 1. **Project Overview & Current State**
```
PROGRESS-part-2.md                   # Current project status (Parts 6-15 complete)
README.md                            # Project overview
ARCHITECTURE-compress.md             # System architecture and design patterns (compressed)
IMPLEMENTATION-GUIDE.md              # Implementation best practices
```

### 2. **Policy Files (MUST READ - These are your rules)**
```
docs/policies/00-tier-specifications.md              # FREE vs PRO tier rules (CRITICAL)
docs/policies/01-approval-policies.md                # When to approve/fix/escalate
docs/policies/02-quality-standards.md                # TypeScript, error handling standards
docs/policies/03-architecture-rules.md               # File structure, architecture patterns
docs/policies/04-escalation-triggers.md              # When to ask for human help
docs/policies/05-coding-patterns-part-1.md           # Copy-paste ready code patterns (Part 1)
docs/policies/05-coding-patterns-part-2.md           # Copy-paste ready code patterns (Part 2)
docs/policies/06-aider-instructions.md               # Build workflow instructions
```

### 3. **Part 16 Requirements & Build Order**
```
docs/build-orders/part-16-utilities.md               # Build order for all 25 files
docs/implementation-guides/v5_part_p.md              # Utilities & infrastructure business logic
```

### 4. **Seed Code (MUST REFERENCE)**
```
seed-code/v0-components/next-js-marketing-homepage-v2/app/page.tsx         # Landing page reference
seed-code/v0-components/empty-states-components/components/empty-states.tsx # Empty states reference
seed-code/v0-components/user-profile-dropdown/components/user-profile-dropdown.tsx # Profile dropdown
```

### 5. **OpenAPI Specifications**
```
docs/trading_alerts_openapi.yaml                     # Next.js API contracts
```

### 6. **Validation & Testing**
```
VALIDATION-SETUP-GUIDE.md                            # Validation tools and process
CLAUDE.md                                            # Automated validation guide
```

---

## PART 16 - FILES TO BUILD (In Order, Grouped by Category)

Build these 25 files in sequence:

### **Category A: Email & Tokens (2 files)**

### **File 1/25:** `lib/email/email.ts`
- Send email with Resend
- Reusable email templates (welcome, verification, password reset)
- **Commit:** `feat(email): add email service`

### **File 2/25:** `lib/tokens.ts`
- Generate verification tokens
- Generate password reset tokens
- Hash tokens for storage
- **Commit:** `feat(auth): add token generation`

### **Category B: Error Handling (3 files)**

### **File 3/25:** `lib/errors/error-handler.ts`
- Global error handler for API routes
- Handle Prisma errors, Zod errors, custom errors
- Return consistent error responses
- **Commit:** `feat(errors): add error handler`

### **File 4/25:** `lib/errors/api-error.ts`
- APIError class with static factory methods
- badRequest, unauthorized, forbidden, notFound, internal
- Include status codes and error codes
- **Commit:** `feat(errors): add API error classes`

### **File 5/25:** `lib/errors/error-logger.ts`
- Error logging service
- Log to console (development)
- Log to external service placeholder (production)
- Include context (userId, tier, endpoint)
- **Commit:** `feat(errors): add error logger`

### **Category C: Caching (2 files)**

### **File 6/25:** `lib/redis/client.ts`
- Redis client using ioredis
- Connection to REDIS_URL env variable
- Export redis instance
- **Commit:** `feat(cache): add Redis client`

### **File 7/25:** `lib/cache/cache-manager.ts`
- Cache manager with get, set, delete
- TTL support (default 5 minutes)
- Price caching functions (cachePrice, getCachedPrice)
- **Commit:** `feat(cache): add cache manager`

### **Category D: Validation Schemas (4 files)**

### **File 8/25:** `lib/validations/auth.ts`
- signupSchema (email, password, name)
- loginSchema (email, password)
- resetPasswordSchema
- **Commit:** `feat(validation): add auth schemas`

### **File 9/25:** `lib/validations/alert.ts`
- createAlertSchema (symbol, timeframe, conditionType, targetValue)
- updateAlertSchema
- Use tier-based symbol/timeframe enums
- **Commit:** `feat(validation): add alert schemas`

### **File 10/25:** `lib/validations/watchlist.ts`
- addToWatchlistSchema (symbol, timeframe)
- Symbol+timeframe combination validation
- Tier validation refinement
- **Commit:** `feat(validation): add watchlist schemas`

### **File 11/25:** `lib/validations/user.ts`
- updateProfileSchema (name, email, image)
- updatePreferencesSchema
- changePasswordSchema
- **Commit:** `feat(validation): add user schemas`

### **Category E: Utilities (3 files)**

### **File 12/25:** `lib/utils/helpers.ts`
- generateId (with optional prefix)
- sleep utility
- truncate string
- isDefined type guard
- **Commit:** `feat(utils): add helper functions`

### **File 13/25:** `lib/utils/formatters.ts`
- formatCurrency
- formatDate
- formatRelativeTime ("2 hours ago")
- formatCompactNumber (1000 → 1K)
- **Commit:** `feat(utils): add formatters`

### **File 14/25:** `lib/utils/constants.ts`
- TIMEFRAMES array (M15, M30, H1, H2, H4, H8, D1)
- SYMBOLS array (XAUUSD, EURUSD, GBPUSD, etc.)
- TIER_LIMITS (FREE vs PRO symbols, limits)
- PRICING constants
- **Commit:** `feat(utils): add app constants`

### **Category F: Root App Files (3 files)**

### **File 15/25:** `app/layout.tsx`
- Root layout with metadata
- Providers: SessionProvider, QueryClientProvider, ThemeProvider
- Global fonts (Inter)
- **Commit:** `feat(app): add root layout`

### **File 16/25:** `app/globals.css`
- Tailwind directives
- CSS variables for theming
- Dark mode variables
- Custom utility classes
- **Commit:** `feat(app): add global styles`

### **File 17/25:** `app/error.tsx`
- Global error page
- "use client" component
- Display error message
- Reset button
- **Commit:** `feat(app): add error page`

### **Category G: Marketing (2 files)**

### **File 18/25:** `app/(marketing)/layout.tsx`
- Marketing layout (public pages)
- Simple header with logo and CTA buttons
- Footer with links
- **Commit:** `feat(marketing): add marketing layout`

### **File 19/25:** `app/(marketing)/page.tsx`
- Landing page (public)
- Hero section with value proposition
- Features showcase (3 cards)
- Pricing preview (FREE/PRO)
- Affiliate program section
- **CRITICAL:** Reference seed code at `seed-code/v0-components/next-js-marketing-homepage-v2/app/page.tsx`
- **Commit:** `feat(marketing): add landing page`

### **Category H: Public Assets (1 file)**

### **File 20/25:** `public/manifest.json`
- PWA manifest
- App name, icons, theme colors
- Display mode: standalone
- **Commit:** `feat(pwa): add manifest`

### **Category I: GitHub Actions (3 files)**

### **File 21/25:** `.github/workflows/ci-nextjs.yml`
- Next.js CI pipeline
- Checkout, setup Node, install deps
- Run lint, type-check, tests, build
- **Commit:** `ci: add Next.js CI workflow`

### **File 22/25:** `.github/workflows/ci-flask.yml`
- Flask CI pipeline for MT5 service
- Checkout, setup Python, install deps
- Run pytest, flake8
- **Commit:** `ci: add Flask CI workflow`

### **File 23/25:** `.github/workflows/deploy.yml`
- Deployment workflow
- Build Docker images
- Push to registry
- Deploy to server
- **Commit:** `ci: add deployment workflow`

### **Category J: Docker (2 files)**

### **File 24/25:** `docker-compose.yml`
- All services: next-app, flask-app, postgres, redis
- Networks, volumes, environment variables
- **Commit:** `feat(docker): add docker-compose`

### **File 25/25:** `.dockerignore`
- Ignore node_modules, .git, .env.local
- Ignore build artifacts
- **Commit:** `feat(docker): add dockerignore`

---

## GIT WORKFLOW

### **Branch Strategy**
```bash
# Create new branch (MUST start with 'claude/' and end with session ID)
git checkout -b claude/utilities-infrastructure-{SESSION_ID}

# Build files one by one, commit each file individually
# After all 25 files complete:
git push -u origin claude/utilities-infrastructure-{SESSION_ID}
```

### **Commit Message Format**
Use conventional commits:
```
feat(email): add email service
feat(utils): add helper functions
feat(app): add root layout
ci: add Next.js CI workflow
feat(docker): add docker-compose
```

### **Push Requirements**
- Branch MUST start with `claude/`
- Branch MUST end with session ID
- Push ONLY after all validations pass
- Create PR after push (do NOT merge to main directly)

---

## VALIDATION REQUIREMENTS

After building each file, run validation:

```bash
# Validate TypeScript types
npm run validate:types

# Validate code quality
npm run validate:lint

# Validate formatting
npm run validate:format

# Run all validations together
npm run validate
```

### **Auto-Fix Minor Issues**
```bash
# Auto-fix ESLint and Prettier issues
npm run fix
```

### **Validation Must Pass Before Committing**
- 0 TypeScript errors
- 0 ESLint errors (warnings OK if < 3)
- All files properly formatted
- No unused imports
- All functions have return types

---

## KEY REQUIREMENTS FOR PART 16

### **1. Tier Constants (CRITICAL)**

```typescript
// lib/utils/constants.ts

// V5: 7 Timeframes
export const TIMEFRAMES = ['M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'D1'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

// V5: 10 Symbols for PRO
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
  'US30',   // Dow Jones
] as const;
export type Symbol = (typeof SYMBOLS)[number];

// V5: FREE tier symbols (1 only)
export const FREE_SYMBOLS = ['XAUUSD'] as const;

// Tier-based limits
export const TIER_LIMITS = {
  FREE: {
    symbols: FREE_SYMBOLS,
    timeframes: TIMEFRAMES, // All 7
    maxAlerts: 5,
    maxWatchlists: 3,
    maxWatchlistItems: 5,
  },
  PRO: {
    symbols: SYMBOLS, // All 10
    timeframes: TIMEFRAMES, // All 7
    maxAlerts: 20,
    maxWatchlists: 10,
    maxWatchlistItems: 50,
  },
} as const;

// Pricing
export const PRICING = {
  FREE: 0,
  PRO: 29, // Monthly price in USD
} as const;
```

### **2. Zod Validation Schemas**

```typescript
// lib/validations/auth.ts
import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
```

### **3. API Error Classes**

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

  static conflict(message: string, code = 'CONFLICT'): APIError {
    return new APIError(409, code, message);
  }

  static internal(message = 'Internal server error'): APIError {
    return new APIError(500, 'INTERNAL_ERROR', message);
  }
}
```

### **4. Error Handler**

```typescript
// lib/errors/error-handler.ts
import { NextResponse } from 'next/server';
import { APIError } from './api-error';
import { ZodError } from 'zod';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

export function handleAPIError(error: unknown): NextResponse {
  // Handle custom API errors
  if (error instanceof APIError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  // Handle Zod validation errors
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

  // Handle Prisma errors
  if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Resource already exists', code: 'DUPLICATE' },
        { status: 409 }
      );
    }
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Resource not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }
  }

  // Default: Internal server error
  console.error('Unhandled error:', error);
  return NextResponse.json(
    { error: 'Internal server error', code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}
```

### **5. Cache Manager**

```typescript
// lib/cache/cache-manager.ts
import { redis } from '@/lib/redis/client';

export async function getCache<T>(key: string): Promise<T | null> {
  const value = await redis.get(key);
  return value ? JSON.parse(value) : null;
}

export async function setCache(
  key: string,
  value: unknown,
  ttl = 300 // 5 minutes default
): Promise<void> {
  await redis.setex(key, ttl, JSON.stringify(value));
}

export async function deleteCache(key: string): Promise<void> {
  await redis.del(key);
}

// Price caching (1 minute TTL)
export async function cachePrice(
  symbol: string,
  timeframe: string,
  price: number
): Promise<void> {
  const key = `price:${symbol}:${timeframe}`;
  await setCache(key, price, 60);
}

export async function getCachedPrice(
  symbol: string,
  timeframe: string
): Promise<number | null> {
  const key = `price:${symbol}:${timeframe}`;
  return getCache<number>(key);
}
```

### **6. Email Service**

```typescript
// lib/email/email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = 'Trading Alerts <noreply@tradingalerts.com>';

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html,
  });
}

export function getWelcomeEmail(name: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #3b82f6;">Welcome to Trading Alerts!</h1>
      <p>Hi ${name},</p>
      <p>Your account has been created successfully.</p>
      <p>Start by setting up your first price alert to get notified when your targets are hit.</p>
      <a href="${process.env.NEXTAUTH_URL}/dashboard"
         style="display: inline-block; background: #3b82f6; color: white;
                padding: 12px 24px; border-radius: 8px; text-decoration: none;">
        Go to Dashboard
      </a>
      <p style="color: #6b7280; margin-top: 24px;">
        - The Trading Alerts Team
      </p>
    </div>
  `;
}

export function getVerificationEmail(name: string, token: string): string {
  const verifyUrl = `${process.env.NEXTAUTH_URL}/verify-email?token=${token}`;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #3b82f6;">Verify Your Email</h1>
      <p>Hi ${name},</p>
      <p>Please click the button below to verify your email address:</p>
      <a href="${verifyUrl}"
         style="display: inline-block; background: #3b82f6; color: white;
                padding: 12px 24px; border-radius: 8px; text-decoration: none;">
        Verify Email
      </a>
      <p style="color: #6b7280; margin-top: 24px;">
        This link will expire in 24 hours.
      </p>
    </div>
  `;
}

export function getPasswordResetEmail(name: string, token: string): string {
  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #3b82f6;">Reset Your Password</h1>
      <p>Hi ${name},</p>
      <p>We received a request to reset your password. Click the button below:</p>
      <a href="${resetUrl}"
         style="display: inline-block; background: #3b82f6; color: white;
                padding: 12px 24px; border-radius: 8px; text-decoration: none;">
        Reset Password
      </a>
      <p style="color: #6b7280; margin-top: 24px;">
        This link will expire in 1 hour. If you didn't request this, ignore this email.
      </p>
    </div>
  `;
}
```

### **7. TypeScript Compliance (CRITICAL)**
- NO `any` types allowed
- All function parameters typed
- All return types specified
- Export TypeScript types with schemas
- Use `as const` for constant arrays

---

## TESTING REQUIREMENTS

After building all 25 files:

### **1. Start Development Server**
```bash
npm run dev
# Should start on http://localhost:3000
```

### **2. Manual Testing Checklist**
- [ ] Landing page renders at `/`
- [ ] Hero section displays
- [ ] Features cards display
- [ ] Pricing section shows FREE and PRO
- [ ] Affiliate section displays
- [ ] Navigation links work
- [ ] CTA buttons work
- [ ] Error page works (`/test-error`)

### **3. Validation Checks**
```bash
# Test validation schemas
import { signupSchema } from '@/lib/validations/auth';
signupSchema.parse({ email: 'test@test.com', password: 'Test1234', name: 'John' });

# Test formatters
import { formatCurrency, formatRelativeTime } from '@/lib/utils/formatters';
formatCurrency(29); // "$29.00"
formatRelativeTime(new Date(Date.now() - 3600000)); // "1 hour ago"

# Test constants
import { TIER_LIMITS } from '@/lib/utils/constants';
console.log(TIER_LIMITS.FREE.maxAlerts); // 5
console.log(TIER_LIMITS.PRO.symbols); // All 10 symbols
```

### **4. Docker Test**
```bash
# Build and run with docker-compose
docker-compose up -d
docker-compose ps
docker-compose logs
docker-compose down
```

### **5. TypeScript Build**
```bash
npm run build
# Should complete with 0 errors
```

---

## CODING PATTERNS TO FOLLOW

### **Pattern 1: Formatters**
```typescript
// lib/utils/formatters.ts
export function formatCurrency(
  amount: number,
  currency = 'USD'
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatDate(
  date: Date | string,
  format: 'short' | 'medium' | 'long' = 'short'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: format,
  }).format(d);
}

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

export function formatCompactNumber(num: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(num);
}
```

### **Pattern 2: Helpers**
```typescript
// lib/utils/helpers.ts
export function generateId(prefix = ''): string {
  const random = Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now().toString(36);
  const id = `${timestamp}${random}`;
  return prefix ? `${prefix}_${id}` : id;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return `${str.substring(0, length)}...`;
}

export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
}

export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((key) => {
    delete result[key];
  });
  return result as Omit<T, K>;
}
```

### **Pattern 3: Root Layout**
```typescript
// app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Trading Alerts - Never Miss a Trading Setup',
  description:
    'Get real-time alerts when price reaches key support/resistance levels based on fractal analysis.',
  keywords: ['trading', 'alerts', 'forex', 'crypto', 'gold', 'XAUUSD'],
  openGraph: {
    title: 'Trading Alerts',
    description: 'Never miss a trading setup again',
    type: 'website',
    url: 'https://tradingalerts.com',
  },
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### **Pattern 4: Global CSS**
```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-feature-settings:
      'rlig' 1,
      'calt' 1;
  }
}
```

### **Pattern 5: Error Page**
```typescript
// app/error.tsx
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="text-6xl mb-6">⚠️</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Something went wrong
        </h1>
        <p className="text-gray-600 mb-6">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <div className="space-x-4">
          <Button onClick={reset}>Try Again</Button>
          <Button variant="outline" onClick={() => (window.location.href = '/')}>
            Go Home
          </Button>
        </div>
        {error.digest && (
          <p className="text-xs text-gray-400 mt-6">Error ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
```

### **Pattern 6: Docker Compose**
```yaml
# docker-compose.yml
version: '3.8'

services:
  next-app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - '3000:3000'
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/trading_alerts
      - REDIS_URL=redis://redis:6379
      - NEXTAUTH_URL=http://localhost:3000
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
    depends_on:
      - db
      - redis
    networks:
      - app-network

  flask-app:
    build:
      context: ./mt5-service
      dockerfile: Dockerfile
    ports:
      - '5000:5000'
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/trading_alerts
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    networks:
      - app-network

  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=trading_alerts
    ports:
      - '5432:5432'
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis-data:/data
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  postgres-data:
  redis-data:
```

### **Pattern 7: GitHub Actions CI**
```yaml
# .github/workflows/ci-nextjs.yml
name: Next.js CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run TypeScript check
        run: npm run validate:types

      - name: Run tests
        run: npm test --passWithNoTests

      - name: Build application
        run: npm run build
        env:
          SKIP_ENV_VALIDATION: true
```

---

## CRITICAL RULES

### **DO:**
- Read ALL policy files before writing code
- Reference seed code for landing page
- Use correct tier limits from constants
- Export TypeScript types with schemas
- Use `as const` for constant arrays
- Implement proper error handling
- Use Zod for all validation
- Add proper HTML email templates
- Validate after each file
- Commit each file individually

### **DON'T:**
- Use `any` types
- Hardcode tier limits (use constants)
- Skip TypeScript type exports
- Use plain objects without validation
- Skip error handling in API routes
- Commit multiple files at once
- Push without validation passing
- Push to main branch directly
- Skip testing

---

## SUCCESS CRITERIA

Part 16 is complete when:

- All 25 files created and committed
- All TypeScript validations pass (0 errors)
- All ESLint checks pass
- Constants export correct tier limits
- Validation schemas work correctly
- Formatters work correctly
- Email templates render properly
- Error handler catches all error types
- Landing page renders correctly
- Docker compose runs without errors
- GitHub Actions CI passes
- All manual tests pass
- Code pushed to feature branch
- PR created (ready for review)

---

## PROGRESS TRACKING

Use the TodoWrite tool to track your progress:

```
1. Read all policy and architecture files
2. Read seed code for landing page
3. Build Files 1-2: Email & Tokens
4. Build Files 3-5: Error Handling
5. Build Files 6-7: Caching
6. Build Files 8-11: Validation Schemas
7. Build Files 12-14: Utilities
8. Build Files 15-17: Root App Files
9. Build Files 18-19: Marketing
10. Build File 20: PWA Manifest
11. Build Files 21-23: GitHub Actions
12. Build Files 24-25: Docker
13. Run full validation suite
14. Test all utilities manually
15. Test landing page
16. Test Docker Compose
17. Push to feature branch
18. Create pull request
```

---

## START HERE

1. **First, read these files in order:**
   - `PROGRESS-part-2.md` - Understand current state
   - `docs/policies/00-tier-specifications.md` - Learn tier system (CRITICAL)
   - `docs/policies/05-coding-patterns-part-1.md` - Learn code patterns
   - `docs/policies/05-coding-patterns-part-2.md` - More code patterns
   - `docs/build-orders/part-16-utilities.md` - Understand Part 16
   - `docs/implementation-guides/v5_part_p.md` - Utilities business logic
   - `seed-code/v0-components/next-js-marketing-homepage-v2/app/page.tsx` - Landing page reference

2. **Then, create your git branch:**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b claude/utilities-infrastructure-{SESSION_ID}
   ```

3. **Start building File 1/25:**
   - Read the build order for File 1
   - Write the file following patterns
   - Validate: `npm run validate`
   - Fix any issues: `npm run fix`
   - Commit: `git commit -m "feat(email): add email service"`

4. **Repeat for Files 2-25**

5. **After all files complete:**
   - Run final validation
   - Test manually
   - Push to remote
   - Create PR

---

## WHEN TO ASK FOR HELP

Escalate to the user if:

- Critical security issues found
- Ambiguous requirements (can't determine correct approach)
- Missing dependencies (resend, ioredis, etc.)
- Validation errors you can't resolve
- Environment variable questions
- Docker/CI configuration questions
- Landing page design decisions

Otherwise, work autonomously following the policies!

---

**Good luck! Build Part 16 with quality and precision. The user trusts you to follow all policies and deliver production-ready code.**
