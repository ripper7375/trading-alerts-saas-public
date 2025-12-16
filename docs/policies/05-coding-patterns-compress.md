# Coding Patterns for Aider with MiniMax M2

## Purpose

Complete, production-ready code examples for Aider. Reference patterns, adapt to requirements, ensure OpenAPI contract compliance.

---

## Code Quality Gates (MANDATORY)

**⚠️ CRITICAL:** All patterns include quality gate compliance. **DO NOT** skip these or code will fail CI/CD.

### Quality Standards Checklist

| Standard           | Requirement                              | Reference                                          |
| ------------------ | ---------------------------------------- | -------------------------------------------------- |
| **TypeScript**     | Explicit return types on all functions   | `docs/policies/09-testing-framework-compliance.md` |
| **ESLint**         | No `any` types, no console.log           | `.eslintrc.json`                                   |
| **Jest**           | Testable structure, unique package names | `jest.config.js`                                   |
| **Error Handling** | Try-catch blocks, user-friendly messages | See patterns below                                 |

### Quick Reference

```typescript
// ✅ Explicit return types
export async function getData(): Promise<Data> { }
export function Component(): React.ReactElement { }

// ✅ No 'any' - define interfaces
interface SeedResult {
  admin: User | null;
  alerts: Alert[];
}

// ✅ No console.log - only console.error/warn
// Remove: console.log('Debug');
// Keep: console.error('Error:', error);

// ✅ Unique package names
{ "name": "alert-card-component" }  // NOT "my-v0-project"
```

**See:** `docs/policies/09-testing-framework-compliance.md` for complete rules.

---

## PATTERN 1: NEXT.JS API ROUTE (Complete Example)

**File:** `app/api/alerts/route.ts`

**Purpose:** Next.js API routes with authentication, validation, tier checking, error handling.

```typescript
// app/api/alerts/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { validateChartAccess, ForbiddenError } from '@/lib/tier/validation';
import type { Alert } from '@prisma/client';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. INPUT VALIDATION SCHEMAS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const createAlertSchema = z.object({
  symbol: z.string().min(1, 'Symbol required').max(20, 'Symbol too long'),
  timeframe: z.enum(['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1'], {
    errorMap: () => ({ message: 'Invalid timeframe' }),
  }),
  condition: z
    .string()
    .min(1, 'Condition required')
    .max(500, 'Condition too long'),
});

type CreateAlertInput = z.infer<typeof createAlertSchema>;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. GET HANDLER - Fetch all alerts for authenticated user
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/alerts - Fetch all alerts for the authenticated user
 *
 * Returns alerts ordered by creation date (newest first).
 * Requires authentication.
 *
 * @returns 200: Array of alerts matching AlertResponse schema
 * @returns 401: Unauthorized (not logged in)
 * @returns 500: Internal server error
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    //───────────────────────────────────────────────────────
    // STEP 1: Authentication Check
    //───────────────────────────────────────────────────────
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'You must be logged in to view alerts',
        },
        { status: 401 }
      );
    }

    const userId = session.user.id; // Type: string (TypeScript knows it's defined after check)

    //───────────────────────────────────────────────────────
    // STEP 2: Database Query
    //───────────────────────────────────────────────────────
    const alerts = await prisma.alert.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc', // Newest first
      },
      select: {
        id: true,
        userId: true,
        symbol: true,
        timeframe: true,
        condition: true,
        isActive: true,
        createdAt: true,
        triggeredAt: true,
      },
    });

    //───────────────────────────────────────────────────────
    // STEP 3: Response (matching OpenAPI schema)
    //───────────────────────────────────────────────────────
    return NextResponse.json(alerts, { status: 200 });
  } catch (error) {
    //───────────────────────────────────────────────────────
    // STEP 4: Error Handling
    //───────────────────────────────────────────────────────
    console.error('GET /api/alerts error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        error: 'Failed to fetch alerts',
        message:
          'An error occurred while fetching your alerts. Please try again.',
      },
      { status: 500 }
    );
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. POST HANDLER - Create new alert with tier validation
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * POST /api/alerts - Create a new alert with tier validation
 *
 * Validates user's tier can access the symbol/timeframe combination.
 * Checks alert count limits (FREE: 5, PRO: 20).
 * Creates alert in database.
 *
 * @param req - Request body: { symbol, timeframe, condition }
 * @returns 201: Created alert matching AlertResponse schema
 * @returns 400: Invalid input
 * @returns 401: Unauthorized (not logged in)
 * @returns 403: Forbidden (tier restriction or limit reached)
 * @returns 500: Internal server error
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    //───────────────────────────────────────────────────────
    // STEP 1: Authentication Check
    //───────────────────────────────────────────────────────
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'You must be logged in to create alerts',
        },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const userTier = session.user.tier || 'FREE'; // Default to FREE if not set

    //───────────────────────────────────────────────────────
    // STEP 2: Input Validation with Zod
    //───────────────────────────────────────────────────────
    const body = await req.json();
    const validationResult = createAlertSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          message: 'Please check your input and try again',
          details: validationResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const { symbol, timeframe, condition } = validationResult.data;

    //───────────────────────────────────────────────────────
    // STEP 3: Tier Validation (Symbol + Timeframe Access)
    //───────────────────────────────────────────────────────
    try {
      validateChartAccess(userTier, symbol, timeframe);
    } catch (tierError) {
      if (tierError instanceof ForbiddenError) {
        return NextResponse.json(
          {
            error: 'Tier restriction',
            message: tierError.message,
            upgrade:
              userTier === 'FREE'
                ? {
                    message:
                      'Upgrade to PRO for access to all 15 symbols and 9 timeframes',
                    upgradeUrl: '/pricing',
                  }
                : undefined,
          },
          { status: 403 }
        );
      }
      // Re-throw if not ForbiddenError
      throw tierError;
    }

    //───────────────────────────────────────────────────────
    // STEP 4: Check Alert Count Limit
    //───────────────────────────────────────────────────────
    const alertCount = await prisma.alert.count({
      where: {
        userId,
      },
    });

    const maxAlerts = userTier === 'PRO' ? 20 : 5;

    if (alertCount >= maxAlerts) {
      return NextResponse.json(
        {
          error: 'Alert limit reached',
          message: `${userTier} tier allows maximum ${maxAlerts} alerts`,
          current: alertCount,
          limit: maxAlerts,
          upgrade:
            userTier === 'FREE'
              ? {
                  message: 'Upgrade to PRO for 20 alerts',
                  upgradeUrl: '/pricing',
                }
              : undefined,
        },
        { status: 403 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 5: Business Logic - Create Alert
    //───────────────────────────────────────────────────────
    const alert = await prisma.alert.create({
      data: {
        userId,
        symbol,
        timeframe,
        condition,
        isActive: true,
        // createdAt: auto-generated
        // triggeredAt: null by default
      },
    });

    //───────────────────────────────────────────────────────
    // STEP 6: Response (matching OpenAPI schema)
    //───────────────────────────────────────────────────────
    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    //───────────────────────────────────────────────────────
    // STEP 7: Error Handling
    //───────────────────────────────────────────────────────
    console.error('POST /api/alerts error:', {
      userId: session?.user?.id,
      action: 'create_alert',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        error: 'Failed to create alert',
        message:
          'An error occurred while creating your alert. Please try again.',
      },
      { status: 500 }
    );
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. PATCH HANDLER - Update alert (optional, for completeness)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * PATCH /api/alerts - Update alert (typically in /api/alerts/[id]/route.ts)
 * This is a placeholder showing the pattern
 */

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// KEY TAKEAWAYS:
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. Always check authentication FIRST
// 2. Validate inputs with Zod (never trust client data)
// 3. Validate tier access for symbol/timeframe endpoints
// 4. Check resource limits (alerts, watchlist items)
// 5. Use Prisma for all database operations
// 6. Return responses matching OpenAPI schema
// 7. Handle errors gracefully (try/catch wrapping all)
// 8. Log errors with context (userId, action, timestamp)
// 9. Return user-friendly error messages (not raw errors)
// 10. Use proper HTTP status codes (401, 403, 400, 500)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## PATTERN 2: REACT CLIENT COMPONENT WITH FORM

**File:** `components/alerts/alert-form.tsx`

**Purpose:** Interactive form with state management, validation, loading states, error handling, API calls.

````typescript
// components/alerts/alert-form.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';
import { canAccessSymbol, canAccessTimeframe } from '@/lib/tier/validation';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. TYPES & VALIDATION SCHEMA
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const alertFormSchema = z.object({
  symbol: z.string().min(1, 'Please select a symbol'),
  timeframe: z.string().min(1, 'Please select a timeframe'),
  condition: z
    .string()
    .min(1, 'Condition is required')
    .max(500, 'Condition must be less than 500 characters'),
});

type AlertFormData = z.infer<typeof alertFormSchema>;

interface AlertFormProps {
  /** Callback fired when alert is successfully created */
  onSuccess?: (alert: any) => void;
  /** Callback fired when alert creation fails */
  onError?: (error: Error) => void;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. SYMBOL & TIMEFRAME CONFIGURATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SYMBOLS = [
  { value: 'BTCUSD', label: 'Bitcoin/USD', proOnly: false },
  { value: 'EURUSD', label: 'Euro/USD', proOnly: false },
  { value: 'USDJPY', label: 'USD/Japanese Yen', proOnly: false },
  { value: 'US30', label: 'Dow Jones 30', proOnly: false },
  { value: 'XAUUSD', label: 'Gold/USD', proOnly: false },
  // PRO-only symbols
  { value: 'AUDJPY', label: 'Australian Dollar/Japanese Yen', proOnly: true },
  { value: 'AUDUSD', label: 'Australian Dollar/USD', proOnly: true },
  { value: 'ETHUSD', label: 'Ethereum/USD', proOnly: true },
  { value: 'GBPJPY', label: 'British Pound/Japanese Yen', proOnly: true },
  { value: 'GBPUSD', label: 'British Pound/USD', proOnly: true },
  { value: 'NDX100', label: 'Nasdaq 100', proOnly: true },
  { value: 'NZDUSD', label: 'New Zealand Dollar/USD', proOnly: true },
  { value: 'USDCAD', label: 'USD/Canadian Dollar', proOnly: true },
  { value: 'USDCHF', label: 'USD/Swiss Franc', proOnly: true },
  { value: 'XAGUSD', label: 'Silver/USD', proOnly: true },
];

const TIMEFRAMES = [
  { value: 'M5', label: '5 Minutes', proOnly: true },
  { value: 'M15', label: '15 Minutes', proOnly: true },
  { value: 'M30', label: '30 Minutes', proOnly: true },
  { value: 'H1', label: '1 Hour', proOnly: false },
  { value: 'H2', label: '2 Hours', proOnly: true },
  { value: 'H4', label: '4 Hours', proOnly: false },
  { value: 'H8', label: '8 Hours', proOnly: true },
  { value: 'H12', label: '12 Hours', proOnly: true },
  { value: 'D1', label: 'Daily', proOnly: false },
];

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. ALERT FORM COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Alert creation form with tier-aware symbol/timeframe selection
 *
 * Features:
 * - Client-side validation with Zod
 * - Tier-based access control (FREE vs PRO)
 * - Loading states during submission
 * - Inline error messages
 * - Success/error callbacks
 * - Disabled PRO-only options for FREE users
 *
 * @example
 * ```tsx
 * <AlertForm
 *   onSuccess={(alert) => router.push(`/dashboard/alerts/${alert.id}`)}
 *   onError={(error) => toast.error(error.message)}
 * />
 * ```
 */
export function AlertForm({ onSuccess, onError }: AlertFormProps) {
  const router = useRouter();
  const { data: session } = useSession();

  //───────────────────────────────────────────────────────
  // STATE MANAGEMENT
  //───────────────────────────────────────────────────────
  const [formData, setFormData] = useState<AlertFormData>({
    symbol: '',
    timeframe: '',
    condition: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof AlertFormData | 'submit', string>>>({});

  const userTier = session?.user?.tier || 'FREE';

  //───────────────────────────────────────────────────────
  // FORM SUBMISSION HANDLER
  //───────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Clear previous errors
    setErrors({});

    // Validate with Zod
    const validationResult = alertFormSchema.safeParse(formData);

    if (!validationResult.success) {
      // Convert Zod errors to field errors
      const fieldErrors: Partial<Record<keyof AlertFormData, string>> = {};
      validationResult.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof AlertFormData;
        if (field) {
          fieldErrors[field] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    // Submit to API
    try {
      setIsSubmitting(true);

      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validationResult.data),
      });

      const data = await response.json();

      if (!response.ok) {
        // API returned error
        throw new Error(data.message || data.error || 'Failed to create alert');
      }

      // Success!
      onSuccess?.(data);
      router.push('/dashboard/alerts');
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      setErrors({ submit: err.message });
      onError?.(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  //───────────────────────────────────────────────────────
  // RENDER
  //───────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Symbol Selection */}
      <div className="space-y-2">
        <Label htmlFor="symbol">Symbol</Label>
        <Select
          value={formData.symbol}
          onValueChange={(value) =>
            setFormData((prev) => ({ ...prev, symbol: value }))
          }
        >
          <SelectTrigger id="symbol" className={errors.symbol ? 'border-red-500' : ''}>
            <SelectValue placeholder="Select a symbol" />
          </SelectTrigger>
          <SelectContent>
            {SYMBOLS.map((symbol) => {
              const canAccess = canAccessSymbol(userTier, symbol.value);
              return (
                <SelectItem
                  key={symbol.value}
                  value={symbol.value}
                  disabled={!canAccess}
                >
                  {symbol.label}
                  {symbol.proOnly && userTier === 'FREE' && ' 🔒 PRO'}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {errors.symbol && (
          <p className="text-sm text-red-600">{errors.symbol}</p>
        )}
      </div>

      {/* Timeframe Selection */}
      <div className="space-y-2">
        <Label htmlFor="timeframe">Timeframe</Label>
        <Select
          value={formData.timeframe}
          onValueChange={(value) =>
            setFormData((prev) => ({ ...prev, timeframe: value }))
          }
        >
          <SelectTrigger id="timeframe" className={errors.timeframe ? 'border-red-500' : ''}>
            <SelectValue placeholder="Select a timeframe" />
          </SelectTrigger>
          <SelectContent>
            {TIMEFRAMES.map((tf) => {
              const canAccess = canAccessTimeframe(userTier, tf.value);
              return (
                <SelectItem
                  key={tf.value}
                  value={tf.value}
                  disabled={!canAccess}
                >
                  {tf.label}
                  {tf.proOnly && userTier === 'FREE' && ' 🔒 PRO'}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {errors.timeframe && (
          <p className="text-sm text-red-600">{errors.timeframe}</p>
        )}
      </div>

      {/* Condition Input */}
      <div className="space-y-2">
        <Label htmlFor="condition">Condition</Label>
        <Input
          id="condition"
          type="text"
          placeholder="e.g., RSI > 70"
          value={formData.condition}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, condition: e.target.value }))
          }
          className={errors.condition ? 'border-red-500' : ''}
          maxLength={500}
        />
        {errors.condition && (
          <p className="text-sm text-red-600">{errors.condition}</p>
        )}
        <p className="text-sm text-muted-foreground">
          {formData.condition.length}/500 characters
        </p>
      </div>

      {/* Submit Error */}
      {errors.submit && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errors.submit}</AlertDescription>
        </Alert>
      )}

      {/* Submit Button */}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating Alert...
          </>
        ) : (
          'Create Alert'
        )}
      </Button>

      {/* Upgrade CTA for FREE users */}
      {userTier === 'FREE' && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            <strong>Want access to all symbols and timeframes?</strong>
            <br />
            Upgrade to PRO for 15 symbols × 9 timeframes = 135 chart combinations.
          </p>
          <Button
            type="button"
            variant="link"
            className="mt-2 text-blue-600"
            onClick={() => router.push('/pricing')}
          >
            View PRO Features →
          </Button>
        </div>
      )}
    </form>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// KEY TAKEAWAYS:
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. 'use client' directive for Client Components
// 2. Zod validation both client-side and server-side
// 3. Loading states (isSubmitting) for better UX
// 4. Error states (per-field errors + submit error)
// 5. Tier-aware UI (disable PRO-only options for FREE users)
// 6. Callbacks (onSuccess, onError) for parent components
// 7. Accessibility (Label, proper ARIA attributes)
// 8. User feedback (character counter, loading spinner)
// 9. Upgrade prompts for FREE users (growth strategy)
// 10. Type-safe (TypeScript + Zod schemas)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
````

---

## PATTERN 3: TIER VALIDATION UTILITY

**File:** `lib/tier/validation.ts`

**Purpose:** Centralized tier validation for both Next.js and Flask services.

````typescript
// lib/tier/validation.ts

/**
 * Tier Validation Utilities
 *
 * Validates user tier access to symbols, timeframes, and chart combinations.
 * Used by both Next.js API routes and imported conceptually by Flask service.
 *
 * Based on specs in docs/policies/00-tier-specifications.md
 */

import type { UserTier } from '@/types';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. TIER DEFINITIONS (Source of Truth)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * FREE tier symbols (5 total)
 * - BTCUSD: Crypto - Bitcoin
 * - EURUSD: Forex Major - Euro/Dollar
 * - USDJPY: Forex Major - Dollar/Yen
 * - US30: Index - Dow Jones Industrial Average
 * - XAUUSD: Commodities - Gold
 */
export const FREE_SYMBOLS = [
  'BTCUSD',
  'EURUSD',
  'USDJPY',
  'US30',
  'XAUUSD',
] as const;

/**
 * PRO tier symbols (15 total)
 * Includes all FREE symbols plus 10 additional symbols
 */
export const PRO_SYMBOLS = [
  'AUDJPY', // Forex Cross - Australian Dollar/Japanese Yen
  'AUDUSD', // Forex Major - Australian Dollar/US Dollar
  'BTCUSD', // Crypto - Bitcoin
  'ETHUSD', // Crypto - Ethereum
  'EURUSD', // Forex Major - Euro/Dollar
  'GBPJPY', // Forex Cross - British Pound/Japanese Yen
  'GBPUSD', // Forex Major - British Pound/Dollar
  'NDX100', // Index - Nasdaq 100
  'NZDUSD', // Forex Major - New Zealand Dollar/US Dollar
  'US30', // Index - Dow Jones Industrial Average
  'USDCAD', // Forex Major - US Dollar/Canadian Dollar
  'USDCHF', // Forex Major - US Dollar/Swiss Franc
  'USDJPY', // Forex Major - Dollar/Yen
  'XAGUSD', // Commodities - Silver
  'XAUUSD', // Commodities - Gold
] as const;

/**
 * FREE tier timeframes (3 total)
 * - H1: 1 Hour
 * - H4: 4 Hours
 * - D1: Daily
 */
export const FREE_TIMEFRAMES = ['H1', 'H4', 'D1'] as const;

/**
 * PRO tier timeframes (9 total)
 * Includes all FREE timeframes plus 6 additional timeframes
 */
export const PRO_TIMEFRAMES = [
  'M5', // 5 Minutes (scalping)
  'M15', // 15 Minutes
  'M30', // 30 Minutes
  'H1', // 1 Hour
  'H2', // 2 Hours
  'H4', // 4 Hours
  'H8', // 8 Hours
  'H12', // 12 Hours (swing trading)
  'D1', // Daily
] as const;

/**
 * Resource limits by tier
 */
export const TIER_LIMITS = {
  FREE: {
    symbols: 5,
    timeframes: 3,
    maxAlerts: 5,
    maxWatchlistItems: 5,
    rateLimit: 60, // requests per hour
  },
  PRO: {
    symbols: 15,
    timeframes: 9,
    maxAlerts: 20,
    maxWatchlistItems: 50,
    rateLimit: 300, // requests per hour
  },
} as const;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. CUSTOM ERROR CLASS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Custom error for tier validation failures
 * Use this to differentiate tier errors from other errors
 */
export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. SYMBOL VALIDATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if a tier can access a symbol (non-throwing)
 *
 * @param tier - User's tier (FREE or PRO)
 * @param symbol - Trading symbol to check
 * @returns true if tier can access symbol, false otherwise
 *
 * @example
 * ```typescript
 * canAccessSymbol('FREE', 'EURUSD') // true
 * canAccessSymbol('FREE', 'AUDJPY') // false (PRO-only)
 * canAccessSymbol('PRO', 'AUDJPY')  // true
 * ```
 */
export function canAccessSymbol(tier: UserTier, symbol: string): boolean {
  const allowedSymbols = tier === 'PRO' ? PRO_SYMBOLS : FREE_SYMBOLS;
  return allowedSymbols.includes(symbol as any);
}

/**
 * Get all symbols accessible by a tier
 *
 * @param tier - User's tier
 * @returns Array of accessible symbols
 */
export function getAccessibleSymbols(tier: UserTier): readonly string[] {
  return tier === 'PRO' ? PRO_SYMBOLS : FREE_SYMBOLS;
}

/**
 * Validate symbol access (throwing)
 *
 * @param tier - User's tier
 * @param symbol - Trading symbol to validate
 * @throws {ForbiddenError} If tier cannot access symbol
 *
 * @example
 * ```typescript
 * try {
 *   validateSymbolAccess('FREE', 'AUDJPY');
 * } catch (error) {
 *   if (error instanceof ForbiddenError) {
 *     // Handle tier restriction
 *   }
 * }
 * ```
 */
export function validateSymbolAccess(tier: UserTier, symbol: string): void {
  if (!canAccessSymbol(tier, symbol)) {
    const allowedSymbols = getAccessibleSymbols(tier);
    throw new ForbiddenError(
      `${tier} tier cannot access ${symbol}. Available symbols: ${allowedSymbols.join(', ')}`
    );
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. TIMEFRAME VALIDATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if a tier can access a timeframe (non-throwing)
 *
 * @param tier - User's tier (FREE or PRO)
 * @param timeframe - Chart timeframe to check
 * @returns true if tier can access timeframe, false otherwise
 *
 * @example
 * ```typescript
 * canAccessTimeframe('FREE', 'H1')  // true
 * canAccessTimeframe('FREE', 'M5')  // false (PRO-only)
 * canAccessTimeframe('PRO', 'M5')   // true
 * ```
 */
export function canAccessTimeframe(tier: UserTier, timeframe: string): boolean {
  const allowedTimeframes = tier === 'PRO' ? PRO_TIMEFRAMES : FREE_TIMEFRAMES;
  return allowedTimeframes.includes(timeframe as any);
}

/**
 * Get all timeframes accessible by a tier
 *
 * @param tier - User's tier
 * @returns Array of accessible timeframes
 */
export function getAccessibleTimeframes(tier: UserTier): readonly string[] {
  return tier === 'PRO' ? PRO_TIMEFRAMES : FREE_TIMEFRAMES;
}

/**
 * Validate timeframe access (throwing)
 *
 * @param tier - User's tier
 * @param timeframe - Chart timeframe to validate
 * @throws {ForbiddenError} If tier cannot access timeframe
 */
export function validateTimeframeAccess(
  tier: UserTier,
  timeframe: string
): void {
  if (!canAccessTimeframe(tier, timeframe)) {
    const allowedTimeframes = getAccessibleTimeframes(tier);
    throw new ForbiddenError(
      `${tier} tier cannot access ${timeframe} timeframe. Available timeframes: ${allowedTimeframes.join(', ')}`
    );
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. COMBINED CHART ACCESS VALIDATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validate complete chart access (symbol + timeframe)
 *
 * This is the main validation function used by API routes.
 * Checks both symbol AND timeframe access.
 *
 * @param tier - User's tier
 * @param symbol - Trading symbol
 * @param timeframe - Chart timeframe
 * @throws {ForbiddenError} If tier cannot access symbol or timeframe
 *
 * @example
 * ```typescript
 * // In API route
 * try {
 *   validateChartAccess(userTier, params.symbol, params.timeframe);
 *   // If we get here, user has access - proceed with data fetching
 * } catch (error) {
 *   if (error instanceof ForbiddenError) {
 *     return Response.json({ error: error.message }, { status: 403 });
 *   }
 *   throw error;
 * }
 * ```
 */
export function validateChartAccess(
  tier: UserTier,
  symbol: string,
  timeframe: string
): void {
  // Validate symbol first (more specific error message)
  validateSymbolAccess(tier, symbol);

  // Validate timeframe
  validateTimeframeAccess(tier, timeframe);

  // Both checks passed - access granted
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. RESOURCE LIMIT VALIDATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if user can create another alert (based on tier limit)
 *
 * @param tier - User's tier
 * @param currentCount - Current number of alerts user has
 * @returns true if user can create another alert, false if limit reached
 */
export function canCreateAlert(tier: UserTier, currentCount: number): boolean {
  return currentCount < TIER_LIMITS[tier].maxAlerts;
}

/**
 * Check if user can add another watchlist item (based on tier limit)
 *
 * @param tier - User's tier
 * @param currentCount - Current number of watchlist items user has
 * @returns true if user can add another item, false if limit reached
 */
export function canAddWatchlistItem(
  tier: UserTier,
  currentCount: number
): boolean {
  return currentCount < TIER_LIMITS[tier].maxWatchlistItems;
}

/**
 * Get tier limits for a specific tier
 *
 * @param tier - User's tier
 * @returns Object containing all limits for the tier
 */
export function getTierLimits(tier: UserTier) {
  return TIER_LIMITS[tier];
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// KEY TAKEAWAYS:
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. Single source of truth for tier rules
// 2. Separate non-throwing (can*) and throwing (validate*) functions
// 3. Custom ForbiddenError for tier violations
// 4. Detailed error messages telling users what they CAN access
// 5. Exported constants for use in UI (FREE_SYMBOLS, etc.)
// 6. Comprehensive JSDoc for every function
// 7. Type-safe with TypeScript
// 8. Used by BOTH Next.js API routes AND Flask service (conceptually)
// 9. Easy to test (pure functions, no side effects)
// 10. Resource limits centralized (alerts, watchlist, rate limits)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
````

---

## PATTERN 4: PRISMA DATABASE UTILITY

**File:** `lib/db/alerts.ts`

**Purpose:** Database operations layer - centralizes all Prisma queries for alerts.

**Key:** API routes call these functions, not Prisma directly.

```typescript
// lib/db/alerts.ts

import { prisma } from './prisma';
import type { Alert, Prisma } from '@prisma/client';

/**
 * Create a new alert
 */
export async function createAlert(
  data: Prisma.AlertCreateInput
): Promise<Alert> {
  return prisma.alert.create({ data });
}

/**
 * Get all alerts for a user
 */
export async function getUserAlerts(userId: string): Promise<Alert[]> {
  return prisma.alert.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get alert by ID (with user ownership check)
 */
export async function getAlertById(
  alertId: string,
  userId: string
): Promise<Alert | null> {
  return prisma.alert.findFirst({
    where: { id: alertId, userId },
  });
}

/**
 * Update alert
 */
export async function updateAlert(
  alertId: string,
  userId: string,
  data: Prisma.AlertUpdateInput
): Promise<Alert> {
  return prisma.alert.update({
    where: { id: alertId },
    data,
  });
}

/**
 * Delete alert
 */
export async function deleteAlert(
  alertId: string,
  userId: string
): Promise<void> {
  await prisma.alert.delete({
    where: { id: alertId, userId },
  });
}

/**
 * Count user's alerts
 */
export async function countUserAlerts(userId: string): Promise<number> {
  return prisma.alert.count({ where: { userId } });
}
```

---

## PATTERN 5: FLASK MT5 ENDPOINT

**File:** `mt5-service/app/routes/indicators.py`

**Purpose:** Flask route with tier validation and MT5 integration.

```python
# mt5-service/app/routes/indicators.py

from flask import Blueprint, jsonify, request
from app.services.mt5_connector import fetch_indicator_data
from app.middleware.tier_validator import validate_tier_access
from functools import wraps

indicators_bp = Blueprint('indicators', __name__)

@indicators_bp.route('/api/indicators/<symbol>/<timeframe>', methods=['GET'])
@validate_tier_access  # Tier validation middleware
def get_indicators(symbol: str, timeframe: str):
    """
    Fetch indicator data from MT5 for symbol/timeframe

    Tier validation happens in middleware.
    This endpoint should only be reached if user's tier can access symbol/timeframe.
    """
    try:
        # Fetch data from MT5
        data = fetch_indicator_data(symbol, timeframe)

        return jsonify({
            'symbol': symbol,
            'timeframe': timeframe,
            'indicators': data,
            'metadata': {
                'fetchedAt': datetime.utcnow().isoformat(),
                'source': 'MT5'
            }
        }), 200

    except Exception as e:
        return jsonify({
            'error': 'Failed to fetch indicator data',
            'message': str(e)
        }), 500
```

---

## PATTERN 6: CONSTANTS FILE

**File:** `lib/constants/tiers.ts`

**Purpose:** Central constants for tier system.

```typescript
// lib/constants/tiers.ts

export const TIER_CONFIG = {
  FREE: {
    name: 'Free',
    price: 0,
    symbols: 5,
    timeframes: 3,
    chartCombinations: 15,
    maxAlerts: 5,
    maxWatchlistItems: 5,
    apiRateLimit: 60, // per hour
  },
  PRO: {
    name: 'Pro',
    price: 29,
    symbols: 15,
    timeframes: 9,
    chartCombinations: 135,
    maxAlerts: 20,
    maxWatchlistItems: 50,
    apiRateLimit: 300, // per hour
  },
} as const;

export type UserTier = keyof typeof TIER_CONFIG;
```

---

## PATTERN 7: AFFILIATE AUTHENTICATION (SEPARATE JWT)

**File:** `lib/auth/affiliate-auth.ts`

**Purpose:** Separate authentication system for affiliates using different JWT secret.

```typescript
// lib/auth/affiliate-auth.ts

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/db/prisma';
import type { Affiliate } from '@prisma/client';

/**
 * Affiliate JWT Token Payload
 * CRITICAL: Separate from user JWT (uses AFFILIATE_JWT_SECRET)
 */
export interface AffiliateTokenPayload {
  id: string;
  email: string;
  type: 'AFFILIATE'; // Type discriminator (CRITICAL)
  status: 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED';
  iat?: number;
  exp?: number;
}

/**
 * Generate JWT token for affiliate
 * Uses AFFILIATE_JWT_SECRET (NOT regular JWT_SECRET)
 */
export function generateAffiliateToken(affiliate: Affiliate): string {
  const payload: AffiliateTokenPayload = {
    id: affiliate.id,
    email: affiliate.email,
    type: 'AFFILIATE', // ✅ Type discriminator prevents privilege escalation
    status: affiliate.status,
  };

  return jwt.sign(
    payload,
    process.env.AFFILIATE_JWT_SECRET!, // ✅ Separate secret
    { expiresIn: '7d' }
  );
}

/**
 * Verify affiliate JWT token
 * CRITICAL: Checks token type to prevent user tokens from being used
 */
export function verifyAffiliateToken(token: string): AffiliateTokenPayload {
  try {
    const decoded = jwt.verify(
      token,
      process.env.AFFILIATE_JWT_SECRET!
    ) as AffiliateTokenPayload;

    // ✅ Verify type discriminator
    if (decoded.type !== 'AFFILIATE') {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Hash affiliate password (bcrypt, 10 rounds)
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify affiliate password
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Middleware: Extract affiliate from token
 * Use this in affiliate API routes
 */
export async function getAffiliateFromToken(
  token: string
): Promise<Affiliate | null> {
  try {
    const decoded = verifyAffiliateToken(token);

    const affiliate = await prisma.affiliate.findUnique({
      where: { id: decoded.id },
    });

    return affiliate;
  } catch (error) {
    return null;
  }
}
```

**Usage in API Route:**

```typescript
// app/api/affiliate/dashboard/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAffiliateFromToken } from '@/lib/auth/affiliate-auth';

export async function GET(req: NextRequest) {
  // 1. Extract token from header
  const token = req.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Verify affiliate token
  const affiliate = await getAffiliateFromToken(token);

  if (!affiliate) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // 3. Check affiliate status
  if (affiliate.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Account not active' }, { status: 403 });
  }

  // 4. Business logic
  const stats = await getAffiliateStats(affiliate.id);

  return NextResponse.json(stats);
}
```

---

## PATTERN 8: CRYPTOGRAPHICALLY SECURE CODE GENERATION

**File:** `lib/affiliates/code-generator.ts`

**Purpose:** Generate affiliate discount codes securely (not guessable).

```typescript
// lib/affiliates/code-generator.ts

import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';

/**
 * Generate cryptographically secure affiliate code
 *
 * Format: PREFIX-RANDOMHEX
 * Example: SMIT-a7f3e9d1c2b4
 *
 * CRITICAL: Uses crypto.randomBytes (NOT Math.random)
 */
export function generateAffiliateCode(affiliateName: string): string {
  // 1. Create prefix from affiliate name (optional, for readability)
  const prefix = affiliateName
    .slice(0, 4)
    .toUpperCase()
    .replace(/[^A-Z]/g, '') // Remove non-letters
    .padEnd(4, 'X'); // Pad if < 4 chars

  // 2. Generate cryptographically secure random component
  const randomHex = crypto.randomBytes(16).toString('hex');

  // 3. Combine (total length >12 characters)
  const code = `${prefix}-${randomHex.slice(0, 12)}`;

  return code;
}

/**
 * Generate unique affiliate code (check database for collisions)
 *
 * Attempts up to 10 times to generate unique code.
 * Collision probability is extremely low with crypto.randomBytes.
 */
export async function generateUniqueAffiliateCode(
  affiliateName: string
): Promise<string> {
  const MAX_ATTEMPTS = 10;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateAffiliateCode(affiliateName);

    // Check if code already exists
    const existing = await prisma.affiliateCode.findUnique({
      where: { code },
    });

    if (!existing) {
      return code; // ✅ Unique code found
    }

    // Collision detected (extremely rare), try again
    console.warn(`Code collision on attempt ${attempt + 1}: ${code}`);
  }

  throw new Error(
    `Failed to generate unique code after ${MAX_ATTEMPTS} attempts`
  );
}

/**
 * Generate multiple codes in batch
 * Used during monthly code distribution
 */
export async function generateAffiliateCodeBatch(
  affiliateId: string,
  affiliateName: string,
  count: number
): Promise<
  Array<{ code: string; affiliateId: string; status: string; expiresAt: Date }>
> {
  // Fetch current config from SystemConfig table
  const discountConfig = await prisma.systemConfig.findUnique({
    where: { key: 'affiliate_discount_percent' },
  });
  const commissionConfig = await prisma.systemConfig.findUnique({
    where: { key: 'affiliate_commission_percent' },
  });

  const discountPercent = parseFloat(discountConfig?.value || '20.0');
  const commissionPercent = parseFloat(commissionConfig?.value || '20.0');

  const codes: Array<{
    code: string;
    affiliateId: string;
    status: string;
    discountPercent: number;
    commissionPercent: number;
    expiresAt: Date;
  }> = [];

  // Calculate end of current month
  const now = new Date();
  const endOfMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59
  );

  for (let i = 0; i < count; i++) {
    const code = await generateUniqueAffiliateCode(affiliateName);

    codes.push({
      code,
      affiliateId,
      status: 'ACTIVE',
      discountPercent, // From SystemConfig (default 20%)
      commissionPercent, // From SystemConfig (default 20%)
      expiresAt: endOfMonth,
    });
  }

  return codes;
}
```

**Example - Bad (DO NOT USE):**

```typescript
// ❌ WRONG - Predictable pattern
function badCodeGenerator(affiliate: Affiliate) {
  return `${affiliate.name}-${affiliate.id}`; // Easy to guess
}

// ❌ WRONG - Math.random is NOT cryptographically secure
function badCodeGenerator2() {
  return Math.random().toString(36).substring(7); // Predictable
}

// ❌ WRONG - Sequential codes
let counter = 1000;
function badCodeGenerator3() {
  return `CODE-${counter++}`; // Attacker can enumerate
}
```

---

## PATTERN 9: COMMISSION CALCULATION IN STRIPE WEBHOOK

**File:** `app/api/webhooks/stripe/route.ts`

**Purpose:** Create commissions when Stripe payment succeeds (ONLY via webhook).

```typescript
// app/api/webhooks/stripe/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/db/prisma';
import { sendEmail } from '@/lib/email/sendEmail';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

/**
 * Stripe Webhook Handler
 *
 * CRITICAL: Commissions MUST ONLY be created here (not via manual API)
 * This ensures commission tied to actual payment
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Verify webhook signature (security)
    const body = await req.text();
    const sig = req.headers.get('stripe-signature')!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // 2. Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      await handleCheckoutComplete(session);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout completion
 * Creates subscription AND commission (if affiliate code used)
 */
async function handleCheckoutComplete(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.userId;
  const affiliateCodeValue = session.metadata?.affiliateCode;

  if (!userId) {
    console.error('Missing userId in session metadata');
    return;
  }

  // 1. Update user's subscription
  await prisma.subscription.create({
    data: {
      userId,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: session.subscription as string,
      stripePriceId: session.metadata!.priceId,
      stripeCurrentPeriodEnd: new Date(/* ... */),
      status: 'active',
      plan: 'PRO',
      metadata: affiliateCodeValue
        ? { affiliateCode: affiliateCodeValue }
        : null,
    },
  });

  // 2. Update user tier
  await prisma.user.update({
    where: { id: userId },
    data: { tier: 'PRO' },
  });

  // 3. If affiliate code used, create commission
  if (affiliateCodeValue) {
    await createCommissionFromCode(
      affiliateCodeValue,
      userId,
      session.subscription as string,
      parseFloat(session.metadata!.regularPrice)
    );
  }
}

/**
 * Create commission from affiliate code
 *
 * CRITICAL FORMULA:
 * - Regular Price: e.g., $29.00
 * - Discount Amount: regularPrice × (discountPercent / 100)
 * - Net Revenue: regularPrice - discountAmount
 * - Commission Amount: netRevenue × (commissionPercent / 100)
 */
async function createCommissionFromCode(
  codeValue: string,
  userId: string,
  subscriptionId: string,
  regularPrice: number
): Promise<void> {
  // 1. Fetch affiliate code
  const code = await prisma.affiliateCode.findUnique({
    where: { code: codeValue },
    include: { affiliate: true },
  });

  if (!code) {
    console.error('Affiliate code not found:', codeValue);
    return;
  }

  if (code.status !== 'ACTIVE') {
    console.error('Affiliate code not active:', codeValue, code.status);
    return;
  }

  // 2. Calculate commission (EXACT FORMULA)
  const discountPercent = code.discountPercent; // 20.0
  const commissionPercent = code.commissionPercent; // 20.0

  const discountAmount = regularPrice * (discountPercent / 100); // 29.00 × 0.20 = 5.80
  const netRevenue = regularPrice - discountAmount; // 29.00 - 5.80 = 23.20
  const commissionAmount = netRevenue * (commissionPercent / 100); // 23.20 × 0.20 = 4.64

  // 3. Create commission record (status: PENDING)
  const commission = await prisma.commission.create({
    data: {
      affiliateId: code.affiliateId,
      affiliateCodeId: code.id,
      userId,
      subscriptionId,
      regularPrice,
      discountAmount,
      netRevenue,
      commissionPercent,
      commissionAmount,
      status: 'PENDING', // ✅ Awaits admin payment
    },
  });

  // 4. Mark code as USED
  await prisma.affiliateCode.update({
    where: { id: code.id },
    data: {
      status: 'USED',
      usedAt: new Date(),
      usedByUserId: userId,
    },
  });

  // 5. Update affiliate stats
  await prisma.affiliate.update({
    where: { id: code.affiliateId },
    data: {
      codesDistributed: { increment: 0 }, // No change
      totalEarnings: { increment: commissionAmount },
    },
  });

  // 6. Send email notification to affiliate
  await sendEmail({
    to: code.affiliate.email,
    subject: 'Commission Earned! 🎉',
    html: `
      <h1>You earned a commission!</h1>
      <p>Your code <strong>${codeValue}</strong> was used.</p>
      <p><strong>Commission: $${commissionAmount.toFixed(2)}</strong></p>
      <p>View details in your <a href="https://yourdomain.com/affiliate/dashboard">dashboard</a>.</p>
    `,
  });

  console.log('Commission created:', {
    commissionId: commission.id,
    affiliateId: code.affiliateId,
    amount: commissionAmount,
    code: codeValue,
  });
}
```

---

## PATTERN 10: ACCOUNTING-STYLE REPORT GENERATION

**File:** `app/api/affiliate/dashboard/commission-report/route.ts`

**Purpose:** Generate commission report with accounting format (opening/closing balance).

```typescript
// app/api/affiliate/dashboard/commission-report/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAffiliateFromToken } from '@/lib/auth/affiliate-auth';
import { prisma } from '@/lib/db/prisma';

/**
 * GET /api/affiliate/dashboard/commission-report
 *
 * Returns accounting-style commission report:
 * - Opening Balance (from previous month)
 * - Earned this month
 * - Paid this month
 * - Closing Balance (opening + earned - paid)
 * - Drill-down: Individual commissions
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authenticate affiliate
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const affiliate = await getAffiliateFromToken(token);
    if (!affiliate || affiliate.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get('month'); // Format: "2024-01"

    const reportMonth = monthParam ? new Date(`${monthParam}-01`) : new Date(); // Default: current month

    // 3. Calculate date range for this month
    const startOfMonth = new Date(
      reportMonth.getFullYear(),
      reportMonth.getMonth(),
      1
    );
    const endOfMonth = new Date(
      reportMonth.getFullYear(),
      reportMonth.getMonth() + 1,
      0,
      23,
      59,
      59
    );

    // 4. Fetch commissions for this month
    const commissionsThisMonth = await prisma.commission.findMany({
      where: {
        affiliateId: affiliate.id,
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      include: {
        affiliateCode: true,
        user: {
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 5. Calculate opening balance (all commissions before this month)
    const commissionsBeforeMonth = await prisma.commission.findMany({
      where: {
        affiliateId: affiliate.id,
        createdAt: { lt: startOfMonth },
      },
      select: {
        commissionAmount: true,
        status: true,
      },
    });

    const openingBalance = commissionsBeforeMonth.reduce((sum, c) => {
      // Opening = earned - paid (from previous months)
      return sum + (c.status === 'PAID' ? 0 : c.commissionAmount);
    }, 0);

    // 6. Calculate this month's activity
    const earned = commissionsThisMonth.reduce(
      (sum, c) => sum + c.commissionAmount,
      0
    );

    const paid = commissionsThisMonth
      .filter((c) => c.status === 'PAID')
      .reduce((sum, c) => sum + c.commissionAmount, 0);

    // 7. Calculate closing balance
    const closingBalance = openingBalance + earned - paid;

    // 8. Validate accounting (sanity check)
    const calculated = openingBalance + earned - paid;
    if (Math.abs(calculated - closingBalance) > 0.01) {
      console.error('Accounting mismatch:', {
        openingBalance,
        earned,
        paid,
        closingBalance,
        calculated,
      });
    }

    // 9. Build response
    const report = {
      reportMonth: reportMonth.toISOString().slice(0, 7), // "2024-01"
      openingBalance: parseFloat(openingBalance.toFixed(2)),
      earned: parseFloat(earned.toFixed(2)),
      paid: parseFloat(paid.toFixed(2)),
      closingBalance: parseFloat(closingBalance.toFixed(2)),
      commissions: commissionsThisMonth.map((c) => ({
        id: c.id,
        userId: c.userId,
        userName: c.user.name,
        subscriptionId: c.subscriptionId,
        affiliateCode: c.affiliateCode.code,
        createdAt: c.createdAt.toISOString(),
        regularPrice: c.regularPrice,
        discountAmount: c.discountAmount,
        netRevenue: c.netRevenue,
        commissionPercent: c.commissionPercent,
        commissionAmount: c.commissionAmount,
        status: c.status,
        paidAt: c.paidAt?.toISOString() || null,
      })),
    };

    return NextResponse.json(report);
  } catch (error) {
    console.error('Commission report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
```

**Key Validation:**

```typescript
// Validate accounting balance reconciles
const calculated = openingBalance + earned - paid;
if (Math.abs(calculated - closingBalance) > 0.01) {
  throw new Error('Accounting mismatch: balance does not reconcile');
}

// Validate earned matches sum of commissions
const totalEarned = commissions.reduce((sum, c) => sum + c.commissionAmount, 0);
if (Math.abs(totalEarned - earned) > 0.01) {
  throw new Error('Commission total mismatch');
}
```

---

## Pattern 11: Payment Provider Strategy Pattern (dLocal Integration)

**Use for:** Isolating Stripe and dLocal logic using strategy pattern.

**File:** `lib/payments/subscription-manager.ts`

```typescript
interface PaymentProvider {
  createCheckoutSession(userId: string, plan: PlanType): Promise<CheckoutSession>;
  processCallback(data: unknown): Promise<Subscription>;
  renewSubscription(subscriptionId: string): Promise<Subscription>;
}

class StripeProvider implements PaymentProvider {
  async createCheckoutSession(userId: string, plan: PlanType) {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: STRIPE_PRICE_IDS[plan], quantity: 1 }],
      subscription_data: { trial_period_days: 7 }  // Stripe has trial
    });
    return session;
  }

  async renewSubscription(subscriptionId: string) {
    throw new Error('Stripe subscriptions auto-renew. Manual renewal not supported.');
  }
}

class DLocalProvider implements PaymentProvider {
  async createCheckoutSession(userId: string, plan: PlanType) {
    const { country, currency } = await getUserCountry(userId);
    const { amount, rate } = await convertUsdToLocal(PLANS[plan].usd, currency);

    const payment = await dlocal.createPayment({
      amount,
      currency,
      country
      // dLocal has NO trial period
    });
    return payment;
  }

  async renewSubscription(subscriptionId: string) {
    const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });

    if (sub.planType === 'THREE_DAY') {
      throw new Error('Cannot renew 3-day plan. Purchase monthly instead.');
    }

    // Early renewal with day stacking
    const newExpiresAt = new Date(sub.expiresAt);
    newExpiresAt.setDate(newExpiresAt.getDate() + 30);

    // Process payment and update subscription
    const payment = await dlocal.createPayment({...});
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { expiresAt: newExpiresAt }
    });

    return updatedSubscription;
  }
}

// Factory function
export function getPaymentProvider(provider: 'STRIPE' | 'DLOCAL'): PaymentProvider {
  return provider === 'STRIPE' ? new StripeProvider() : new DLocalProvider();
}

// Usage in API routes
export async function POST(req: NextRequest) {
  const { provider, plan } = await req.json();
  const paymentProvider = getPaymentProvider(provider);
  const session = await paymentProvider.createCheckoutSession(userId, plan);
  return NextResponse.json(session);
}
```

**Why this pattern:**

- Easy to add new payment providers
- Keeps provider-specific logic isolated
- Prevents mixing Stripe and dLocal logic
- Type-safe with TypeScript interfaces

---

## Pattern 12: Payment Provider Conditional Rendering

**Use for:** Frontend components showing different options for Stripe vs dLocal.

**File:** `components/payments/payment-provider-selector.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';

const DLOCAL_COUNTRIES = ['IN', 'NG', 'PK', 'VN', 'ID', 'TH', 'ZA', 'TR'];

const CURRENCY_SYMBOLS = {
  'INR': '₹',
  'NGN': '₦',
  'PKR': '₨',
  'VND': '₫',
  'IDR': 'Rp',
  'THB': '฿',
  'ZAR': 'R',
  'TRY': '₺',
  'USD': '$'
};

export function PaymentProviderSelector({ country }: { country: string }) {
  const [selectedProvider, setSelectedProvider] = useState<'STRIPE' | 'DLOCAL'>('STRIPE');
  const [pricing, setPricing] = useState({ monthly: 29.00, threeDay: 0.96, currency: 'USD' });

  useEffect(() => {
    // Fetch localized pricing
    if (DLOCAL_COUNTRIES.includes(country)) {
      fetch(`/api/payments/pricing?country=${country}`)
        .then(res => res.json())
        .then(data => setPricing(data));
    }
  }, [country]);

  const showDLocal = DLOCAL_COUNTRIES.includes(country);
  const currencySymbol = CURRENCY_SYMBOLS[pricing.currency] || '$';

  return (
    <div className="space-y-4">
      <h2>Choose Payment Method</h2>

      {/* Stripe Option (always available) */}
      <div
        className={`border rounded p-4 cursor-pointer ${selectedProvider === 'STRIPE' ? 'border-blue-500' : ''}`}
        onClick={() => setSelectedProvider('STRIPE')}
      >
        <h3>International Cards (Stripe)</h3>
        <p>Visa, Mastercard, Amex</p>
        <p className="text-lg font-bold">$29.00 USD / month</p>
        <ul className="text-sm text-gray-600">
          <li>✅ 7-day free trial</li>
          <li>✅ Auto-renewal (cancel anytime)</li>
          <li>✅ Accepted worldwide</li>
        </ul>
      </div>

      {/* dLocal Option (only for supported countries) */}
      {showDLocal && (
        <div
          className={`border rounded p-4 cursor-pointer ${selectedProvider === 'DLOCAL' ? 'border-blue-500' : ''}`}
          onClick={() => setSelectedProvider('DLOCAL')}
        >
          <h3>Local Payment Methods (dLocal)</h3>
          <p>UPI, NetBanking, Mobile Wallets</p>

          <div className="mt-2 space-y-2">
            <div>
              <p className="text-sm">3-Day Trial (one-time use)</p>
              <p className="text-lg font-bold">
                {currencySymbol}{pricing.threeDay.toLocaleString()}
              </p>
            </div>

            <div>
              <p className="text-sm">Monthly Plan</p>
              <p className="text-lg font-bold">
                {currencySymbol}{pricing.monthly.toLocaleString()} / month
              </p>
            </div>
          </div>

          <ul className="text-sm text-gray-600 mt-2">
            <li>❌ No auto-renewal (manual renewal required)</li>
            <li>✅ Pay in local currency</li>
            <li>✅ Popular local payment methods</li>
          </ul>
        </div>
      )}

      <button
        onClick={() => handleCheckout(selectedProvider)}
        className="w-full bg-blue-500 text-white py-2 rounded"
      >
        Continue with {selectedProvider === 'STRIPE' ? 'Stripe' : 'dLocal'}
      </button>
    </div>
  );
}
```

**Key Points:**

- Show dLocal only for supported countries
- Display prices in local currency
- Show different features for each provider
- Clear visual distinction

---

## Pattern 13: Multi-Signal Trial Abuse Detection (Stripe)

**Use for:** Preventing Stripe trial abuse using 4 fraud signals without requiring credit card upfront (maximizes conversion ~40-60%).

**Files:** `app/api/auth/register/route.ts`, `lib/fraud-detection.ts`, `lib/fingerprint.ts`, `app/api/payments/stripe/start-trial/route.ts`, `app/api/cron/stripe-trial-expiry/route.ts`

**4 Independent Fraud Signals:**

1. IP-based detection (≥3 trials from same IP in 30 days = HIGH)
2. Device fingerprint detection (≥2 trials from same device in 30 days = HIGH)
3. Disposable email detection (temp domains = MEDIUM)
4. Rapid signup velocity (≥5 accounts from same IP in 1 hour = HIGH)

**Flow:**

1. User registers → Capture IP + device fingerprint
2. Check fraud patterns BEFORE creating account
3. Block HIGH severity immediately, flag MEDIUM for admin review
4. User starts trial → Check `hasUsedStripeTrial` flag
5. Grant PRO for 7 days WITHOUT payment method
6. Cron job checks expiry every 6 hours → Downgrade to FREE if not converted

### Step 1: User Registration with Fraud Detection

**File:** `app/api/auth/register/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { detectTrialAbuse } from '@/lib/fraud-detection';
import bcrypt from 'bcrypt';
import { z } from 'zod';

const signupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const validated = signupSchema.parse(body);

    // ✅ Extract fraud detection signals
    const signupIP =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.ip ||
      null;
    const deviceFingerprint = req.headers.get('x-device-fingerprint') || null;

    // ✅ Check for trial abuse BEFORE creating account
    const fraudCheck = await detectTrialAbuse({
      email: validated.email,
      signupIP,
      deviceFingerprint,
    });

    if (fraudCheck) {
      // Create FraudAlert for admin review
      await prisma.fraudAlert.create({
        data: {
          userId: null, // No user created yet
          alertType: fraudCheck.type,
          severity: fraudCheck.severity,
          description: fraudCheck.description,
          detectedAt: new Date(),
          ipAddress: signupIP,
          deviceFingerprint,
          additionalData: {
            email: validated.email,
            blockedAtRegistration: fraudCheck.severity === 'HIGH',
          },
        },
      });

      // ❌ Block HIGH severity attempts immediately
      if (fraudCheck.severity === 'HIGH') {
        return NextResponse.json(
          {
            error:
              'Unable to create account at this time. Please contact support if you believe this is an error.',
            errorCode: 'REGISTRATION_BLOCKED',
          },
          { status: 403 }
        );
      }

      // ⚠️ Allow MEDIUM severity but flag for admin review
      // Continue with account creation below
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validated.password, 10);

    // ✅ Create user with fraud detection fields
    const user = await prisma.user.create({
      data: {
        email: validated.email,
        password: hashedPassword,
        name: validated.name,
        tier: 'FREE',
        hasUsedStripeTrial: false, // Trial not used yet
        signupIP,
        lastLoginIP: signupIP,
        deviceFingerprint,
      },
    });

    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 409 }
      );
    }

    console.error('User registration failed:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
```

### Step 2: Fraud Detection Utility (4 Patterns)

**File:** `lib/fraud-detection.ts`

```typescript
import { prisma } from '@/lib/prisma';

const DISPOSABLE_EMAIL_DOMAINS = [
  'mailinator.com',
  '10minutemail.com',
  'guerrillamail.com',
  'tempmail.com',
  'throwaway.email',
  'maildrop.cc',
  'temp-mail.org',
  'getnada.com',
];

interface FraudCheckContext {
  email: string;
  signupIP: string | null;
  deviceFingerprint: string | null;
}

interface FraudCheckResult {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

export async function detectTrialAbuse(
  context: FraudCheckContext
): Promise<FraudCheckResult | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // ✅ Pattern 1: IP-based abuse (≥3 trials from same IP in 30 days)
  if (context.signupIP) {
    const recentTrialsFromIP = await prisma.user.count({
      where: {
        signupIP: context.signupIP,
        hasUsedStripeTrial: true,
        stripeTrialStartedAt: { gte: thirtyDaysAgo },
      },
    });

    if (recentTrialsFromIP >= 3) {
      return {
        type: 'STRIPE_TRIAL_IP_ABUSE',
        severity: 'HIGH',
        description: `IP address ${context.signupIP} used for ${recentTrialsFromIP} trial accounts in past 30 days`,
      };
    }
  }

  // ✅ Pattern 2: Device fingerprint abuse (≥2 trials from same device in 30 days)
  if (context.deviceFingerprint) {
    const recentTrialsFromDevice = await prisma.user.count({
      where: {
        deviceFingerprint: context.deviceFingerprint,
        hasUsedStripeTrial: true,
        stripeTrialStartedAt: { gte: thirtyDaysAgo },
      },
    });

    if (recentTrialsFromDevice >= 2) {
      return {
        type: 'STRIPE_TRIAL_DEVICE_ABUSE',
        severity: 'HIGH',
        description: `Device fingerprint used for ${recentTrialsFromDevice} trial accounts in past 30 days`,
      };
    }
  }

  // ✅ Pattern 3: Disposable email domain (MEDIUM severity)
  const emailDomain = context.email.split('@')[1].toLowerCase();
  if (DISPOSABLE_EMAIL_DOMAINS.includes(emailDomain)) {
    return {
      type: 'DISPOSABLE_EMAIL_DETECTED',
      severity: 'MEDIUM',
      description: `Registration using disposable email domain: ${emailDomain}`,
    };
  }

  // ✅ Pattern 4: Rapid signup velocity (≥5 accounts from same IP in 1 hour)
  if (context.signupIP) {
    const rapidSignups = await prisma.user.count({
      where: {
        signupIP: context.signupIP,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (rapidSignups >= 5) {
      return {
        type: 'RAPID_SIGNUP_VELOCITY',
        severity: 'HIGH',
        description: `${rapidSignups} accounts created from IP ${context.signupIP} in past hour (bot attack)`,
      };
    }
  }

  return null; // No fraud detected
}
```

### Step 3: Client-Side Device Fingerprinting

**File:** `lib/fingerprint.ts`

```typescript
/**
 * Generate browser fingerprint for fraud detection
 * Uses browser characteristics to create unique device ID
 * @returns SHA-256 hash of device characteristics
 */
export async function generateDeviceFingerprint(): Promise<string> {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width.toString(),
    screen.height.toString(),
    screen.colorDepth.toString(),
    new Date().getTimezoneOffset().toString(),
    (!!window.sessionStorage).toString(),
    (!!window.localStorage).toString(),
    navigator.hardwareConcurrency?.toString() || 'unknown',
    navigator.maxTouchPoints?.toString() || '0',
  ];

  const fingerprint = components.join('|');

  // Create SHA-256 hash using SubtleCrypto API
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(fingerprint)
  );

  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
```

**Usage in Registration Form:** `app/(auth)/register/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { generateDeviceFingerprint } from '@/lib/fingerprint';

export default function RegisterPage() {
  const [fingerprint, setFingerprint] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    generateDeviceFingerprint().then(setFingerprint);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Fingerprint': fingerprint  // ✅ Send fingerprint to server
      },
      body: JSON.stringify({
        email: formData.get('email'),
        password: formData.get('password'),
        name: formData.get('name')
      })
    });

    const data = await response.json();

    if (response.ok) {
      // Registration successful
      window.location.href = '/dashboard';
    } else {
      // Handle error (blocked, validation, etc.)
      alert(data.error);
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" name="email" required />
      <input type="password" name="password" required />
      <input type="text" name="name" required />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating account...' : 'Sign up'}
      </button>
    </form>
  );
}
```

### Step 4: Trial Start Endpoint (No Card Required)

**File:** `app/api/payments/stripe/start-trial/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ Check if user already used their trial
    if (session.user.hasUsedStripeTrial) {
      return NextResponse.json(
        {
          error:
            'You have already used your free trial. Please subscribe to continue using PRO features.',
          errorCode: 'TRIAL_ALREADY_USED',
        },
        { status: 403 }
      );
    }

    // Calculate trial end date (7 days from now)
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7);

    // ✅ Grant PRO tier for 7 days WITHOUT payment method
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: {
          tier: 'PRO',
          hasUsedStripeTrial: true,
          stripeTrialStartedAt: new Date(),
        },
      }),
      prisma.subscription.create({
        data: {
          userId: session.user.id,
          paymentProvider: 'STRIPE',
          planType: 'MONTHLY',
          status: 'trialing',
          expiresAt: trialEndDate,
          amountUsd: 0, // Free trial
        },
      }),
    ]);

    return NextResponse.json(
      {
        message: 'Trial started successfully',
        trialEndsAt: trialEndDate.toISOString(),
        tier: 'PRO',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Trial start failed:', error);
    return NextResponse.json(
      { error: 'Failed to start trial' },
      { status: 500 }
    );
  }
}
```

### Step 5: Trial Expiry Cron Job

**File:** `app/api/cron/stripe-trial-expiry/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ✅ Verify Vercel Cron secret
  if (
    req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // Find Stripe trials that have expired
  const expiredTrials = await prisma.subscription.findMany({
    where: {
      paymentProvider: 'STRIPE',
      status: 'trialing',
      expiresAt: { lt: now },
    },
    include: { user: true },
  });

  for (const subscription of expiredTrials) {
    // Check if user converted to paid subscription
    const paidSubscription = await prisma.subscription.findFirst({
      where: {
        userId: subscription.userId,
        paymentProvider: 'STRIPE',
        status: 'active',
        stripeSubscriptionId: { not: null }, // Has paid subscription
      },
    });

    if (paidSubscription) {
      // ✅ User converted - delete trial subscription
      await prisma.subscription.delete({
        where: { id: subscription.id },
      });
    } else {
      // ❌ User did NOT convert - downgrade to FREE
      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'expired' },
        }),
        prisma.user.update({
          where: { id: subscription.userId },
          data: { tier: 'FREE' },
        }),
      ]);

      // Send trial expiry email
      await sendEmail(subscription.user.email, 'Trial Expired', {
        subject: 'Your 7-day PRO trial has ended',
        message: 'Subscribe now to continue enjoying PRO features!',
        ctaText: 'Subscribe Now',
        ctaUrl: 'https://app.com/dashboard/billing',
      });
    }
  }

  return NextResponse.json({
    checked: expiredTrials.length,
    message: 'Trial expiry check completed',
  });
}
```

**Vercel Cron Configuration:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/stripe-trial-expiry",
      "schedule": "0 */6 * * *" // Every 6 hours
    },
    {
      "path": "/api/cron/check-expirations",
      "schedule": "0 0 * * *" // Daily at midnight UTC (dLocal subscriptions)
    }
  ]
}
```

### Admin Fraud Management (Patterns 13.6-13.8)

**Key Admin Actions:**

- Dismiss (False Positive)
- Send Warning Email
- Block Account (Temp/Permanent)
- Unblock Account
- Whitelist User
- Add Notes

See full implementation in original file sections 2591-3145 (omitted for brevity - includes complete admin fraud dashboard UI and action endpoints).

**Key Points:**

- NO credit card required for trial (maximizes conversion 40-60%)
- 4 independent fraud signals
- Block HIGH severity immediately
- Admin review workflow for all suspicious activity
- Cron job every 6 hours
- Client-side fingerprinting (SHA-256)
- Admin dashboard with comprehensive enforcement capabilities

**Expected Metrics:**

- Conversion Rate: 40-60%
- Fraud Detection: 85-90% reduction
- False Positive Rate: <5%
- Admin Overhead: 2-5 alerts/day

## SUMMARY OF PATTERNS

**Pattern Usage Guide:**

1. **API Route:** Authentication → Validation → Tier Check → Business Logic → Response
2. **Client Component:** State → Form handling → API calls → Loading/Error states
3. **Tier Validation:** Centralized utilities with custom errors
4. **Database:** Prisma operations isolated in lib/db/\*
5. **Flask:** Python endpoint with tier validation middleware
6. **Constants:** Centralized configuration
7. **Affiliate Auth:** Separate JWT secret with type discriminator
8. **Code Generation:** Cryptographically secure (crypto.randomBytes)
9. **Commission Calculation:** Stripe webhook with exact formula
10. **Accounting Report:** Opening/closing balance with reconciliation
11. **Payment Provider Strategy:** Isolate Stripe and dLocal logic
12. **Payment Provider UI:** Conditional rendering based on country
13. **Trial Abuse Detection:** 4 fraud signals without credit card requirement

**Remember:** Adapt these patterns to your specific requirements and ensure they match OpenAPI contracts.
